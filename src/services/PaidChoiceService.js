const User = require("../models/User");
const DiamondTransaction = require("../models/DiamondTransaction");
const logger = require("../utils/logger");

class PaidChoiceService {
  /**
   * Calculate diamond cost for a choice based on AI analysis
   * @param {Object} choiceData - Choice data including text, context, etc.
   * @returns {number} Diamond cost (1-5)
   */
  static calculateChoiceCost(choiceData) {
    // This is a placeholder for AI logic
    // In a real implementation, you would send this to an AI service
    // For now, we'll use a simple algorithm based on choice characteristics
    
    let baseCost = 1;
    
    // Factors that increase cost:
    // 1. Choice length (longer choices might be more detailed)
    if (choiceData.text && choiceData.text.length > 50) {
      baseCost += 1;
    }
    
    // 2. Special keywords that indicate premium content
    const premiumKeywords = ['romantic', 'intimate', 'special', 'exclusive', 'premium'];
    const hasPremiumKeywords = premiumKeywords.some(keyword => 
      choiceData.text && choiceData.text.toLowerCase().includes(keyword)
    );
    if (hasPremiumKeywords) {
      baseCost += 1;
    }
    
    // 3. Context-based pricing (romantic scenes might cost more)
    if (choiceData.context === 'romantic' || choiceData.context === 'intimate') {
      baseCost += 1;
    }
    
    // 4. Story progression (later choices might cost more)
    if (choiceData.storyProgress && choiceData.storyProgress > 0.7) {
      baseCost += 1;
    }
    
    // Ensure cost is between 1-5
    return Math.min(Math.max(baseCost, 1), 5);
  }

  /**
   * Process a paid choice purchase
   * @param {string} userId - User ID
   * @param {Object} choiceData - Choice data
   * @returns {Promise<Object>} Result of the purchase
   */
  static async processPaidChoice(userId, choiceData) {
    try {
      // Calculate cost
      const diamondCost = this.calculateChoiceCost(choiceData);
      
      // Check if user has enough diamonds
      const user = await User.findOne({ _id: userId, isDeleted: false });
      if (!user) {
        throw new Error('User not found');
      }
      
      if (user.diamonds < diamondCost) {
        return {
          success: false,
          message: 'Not enough diamonds',
          required: diamondCost,
          available: user.diamonds
        };
      }
      
      // Deduct diamonds from user
      user.diamonds -= diamondCost;
      await user.save();
      
      // Create diamond transaction record
      const transaction = await DiamondTransaction.create({
        userId,
        diamondAmount: -diamondCost,
        amount: 0,
        currency: 'DIAMONDS',
        type: 'DEBIT',
        source: 'SPENT',
        status: 'SUCCESS',
        paymentTransactionId: `paid_choice_${Date.now()}`,
        metadata: {
          choiceType: 'PAID_CHOICE',
          choiceText: choiceData.text,
          choiceContext: choiceData.context,
          storyId: choiceData.storyId,
          chapterId: choiceData.chapterId,
          sceneId: choiceData.sceneId
        }
      });
      
      logger.info(`Paid choice processed for user ${userId}: ${diamondCost} diamonds spent`);
      
      return {
        success: true,
        diamondCost,
        userDiamonds: user.diamonds,
        transactionId: transaction._id,
        choiceData
      };
      
    } catch (error) {
      logger.error(`Error processing paid choice: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get choice cost without processing the purchase
   * @param {Object} choiceData - Choice data
   * @returns {number} Diamond cost
   */
  static getChoiceCost(choiceData) {
    return this.calculateChoiceCost(choiceData);
  }

  /**
   * Validate if user can afford a choice
   * @param {string} userId - User ID
   * @param {Object} choiceData - Choice data
   * @returns {Promise<Object>} Validation result
   */
  static async validateChoicePurchase(userId, choiceData) {
    try {
      const diamondCost = this.calculateChoiceCost(choiceData);
      const user = await User.findOne({ _id: userId, isDeleted: false });
      
      if (!user) {
        return {
          canAfford: false,
          message: 'User not found',
          required: diamondCost,
          available: 0
        };
      }
      
      return {
        canAfford: user.diamonds >= diamondCost,
        required: diamondCost,
        available: user.diamonds,
        message: user.diamonds >= diamondCost ? 'Can afford' : 'Not enough diamonds'
      };
      
    } catch (error) {
      logger.error(`Error validating choice purchase: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all paid choices for a scene with their costs
   * @param {Array} choices - Array of choice objects
   * @param {Object} context - Scene context
   * @returns {Array} Choices with calculated costs
   */
  static getChoicesWithCosts(choices, context = {}) {
    return choices.map(choice => ({
      ...choice,
      diamondCost: this.calculateChoiceCost({
        text: choice.choiceText,
        context: context.sceneType,
        storyProgress: context.storyProgress,
        storyId: context.storyId,
        chapterId: context.chapterId,
        sceneId: context.sceneId
      }),
      isPaid: true
    }));
  }
}

module.exports = PaidChoiceService; 