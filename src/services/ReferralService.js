const Referral = require("../models/Referral");
const User = require("../models/User");
const DiamondTransaction = require("../models/DiamondTransaction");
const mongoose = require("mongoose");
const logger = require("../utils/logger");

class ReferralService {
  // Reward amounts
  static REFERRED_USER_REWARD = 10; // +10 💎 for new user
  static REFERRER_REWARD = 5; // +5 💎 for referring user

  /**
   * Process new user referral login
   * @param {string} userId - New user's ID
   * @param {string} referralUrl - Referral URL used
   * @returns {Promise<Object>} Result of processing
   */
  async processNewUserReferral(userId, referralUrl) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find referrer by referral URL
      const referrer = await User.findOne({
        referralUrl: referralUrl,
        isDeleted: false
      });
      if (!referrer) {
        throw new Error("Referrer user not found or invalid referral URL");
      }

      // Check if new user exists
      const newUser = await User.findOne({
        _id: userId,
        isDeleted: false
      }).session(session);
      if (!newUser) {
        throw new Error("New user not found");
      }

      // Check if user is trying to refer themselves
      if (referrer._id.toString() === userId) {
        throw new Error("Users cannot refer themselves");
      }

      // Check if this user has already been referred
      const existingReferral = await Referral.findOne({
        referredUserId: userId
      });

      if (existingReferral) {
        logger.info(`User ${userId} already has an existing referral from user ${existingReferral.referrerUserId}`);
        await session.abortTransaction();
        return {
          success: false,
          message: "This user has already been referred by someone else. Each user can only be referred once.",
          existingReferral: {
            referrerId: existingReferral.referrerUserId,
            referralDate: existingReferral.createdAt
          }
        };
      }

      // Create referral record
      const referral = new Referral({
        referrerUserId: referrer._id,
        referredUserId: userId,
        referralUrl: referralUrl,
        referredUserReward: ReferralService.REFERRED_USER_REWARD,
        referrerReward: ReferralService.REFERRER_REWARD
      });

      await referral.save({ session });

      await session.commitTransaction();

      logger.info(
        `Referral processed successfully: ${userId} referred by ${referrer._id}. Rewards available for claiming.`
      );

      return {
        success: true,
        referralId: referral._id,
        referredUserReward: {
          amount: ReferralService.REFERRED_USER_REWARD,
          claimable: true
        },
        referrerReward: {
          amount: ReferralService.REFERRER_REWARD,
          claimable: true
        },
        message:
          "Referral processed successfully - rewards available for claiming"
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(
        `Error processing referral for user ${userId}: ${error.message}`
      );

      // Handle duplicate key error (user already referred)
      if (error.code === 11000 || error.message.includes("duplicate key")) {
        return {
          success: false,
          message: "This user has already been referred"
        };
      }

      return {
        success: false,
        message: error.message
      };
    } finally {
      session.endSession();
    }
  }

  /**
   * Check reward availability for referred user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Available rewards
   */
  async checkReferredUserRewards(userId) {
    try {
      const referral = await Referral.findOne({
        referredUserId: userId,
        referredUserRewardClaimed: false
      }).populate("referrerUserId", "username displayName");

      if (!referral) {
        return {
          totalRewards: 0,
          availableReward: null
        };
      }

      return {
        totalRewards: referral.referredUserReward,
        availableReward: {
          referralId: referral._id,
          amount: referral.referredUserReward,
          referrerName:
            referral.referrerUserId?.displayName ||
            referral.referrerUserId?.username ||
            "Unknown",
          createdAt: referral.createdAt
        }
      };
    } catch (error) {
      logger.error(
        `Error checking referred user rewards for ${userId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Check reward availability for referrer
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Available rewards
   */
  async checkReferrerRewards(userId) {
    try {
      const referrals = await Referral.find({
        referrerUserId: userId,
        referrerRewardClaimed: false
      }).populate("referredUserId", "username displayName");

      const totalAvailable = referrals.reduce(
        (sum, r) => sum + r.referrerReward,
        0
      );

      return {
        totalRewards: totalAvailable,
        availableRewards: referrals.map((r) => ({
          referralId: r._id,
          amount: r.referrerReward,
          referredUserName:
            r.referredUserId?.displayName ||
            r.referredUserId?.username ||
            "Unknown",
          createdAt: r.createdAt
        }))
      };
    } catch (error) {
      logger.error(
        `Error checking referrer rewards for ${userId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Check all reward availability for a user (both as referred user and referrer)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} All available rewards
   */
  async checkAllUserRewards(userId) {
    try {
      // Get rewards as a referred user (can only be one)
      const referredRewards = await this.checkReferredUserRewards(userId);

      // Get rewards as a referrer (can be multiple)
      const referrerRewards = await this.checkReferrerRewards(userId);

      return {
        asReferredUser: {
          totalRewards: referredRewards.totalRewards,
          availableReward: referredRewards.availableReward
        },
        asReferrer: {
          totalRewards: referrerRewards.totalRewards,
          availableRewards: referrerRewards.availableRewards
        },
        totalPendingRewards:
          referredRewards.totalRewards + referrerRewards.totalRewards
      };
    } catch (error) {
      logger.error(
        `Error checking all user rewards for ${userId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Claim reward for user (automatically detects if user is referred or referrer for this referral)
   * @param {string} userId - User ID
   * @param {string} referralId - Referral ID
   * @returns {Promise<Object>} Claim result
   */
  async claimReward(userId, referralId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find the referral and check user's role
      const referral = await Referral.findById(referralId).session(session);

      if (!referral) {
        throw new Error("Referral not found");
      }

      const isReferredUser = referral.referredUserId.toString() === userId;
      const isReferrer = referral.referrerUserId.toString() === userId;

      if (!isReferredUser && !isReferrer) {
        throw new Error("User not authorized for this referral");
      }

      let rewardAmount;
      let rewardType;
      let alreadyClaimed;

      if (isReferredUser) {
        rewardAmount = referral.referredUserReward;
        rewardType = "referred_user";
        alreadyClaimed = referral.referredUserRewardClaimed;
      } else {
        rewardAmount = referral.referrerReward;
        rewardType = "referrer";
        alreadyClaimed = referral.referrerRewardClaimed;
      }

      if (alreadyClaimed) {
        await session.abortTransaction();
        return {
          success: false,
          message: "Reward already claimed"
        };
      }

      // Create diamond transaction

      // Add diamonds to user
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, isDeleted: false },
        { $inc: { diamonds: rewardAmount } },
        { new: true, session }
      );

      // Mark reward as claimed
      if (isReferredUser) {
        referral.referredUserRewardClaimed = true;
        referral.referredUserRewardClaimedAt = new Date();
      } else {
        referral.referrerRewardClaimed = true;
        referral.referrerRewardClaimedAt = new Date();
      }
      await referral.save({ session });

      await session.commitTransaction();

      logger.info(
        `${rewardType} reward claimed: ${rewardAmount} diamonds by user ${userId}`
      );

      return {
        success: true,
        amount: rewardAmount,
        newBalance: updatedUser.diamonds,
        rewardType: rewardType
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error claiming reward: ${error.message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get or create user's referral link
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Referral link info
   */
  async getUserReferralLink(userId) {
    try {
      // Check if user exists
      const user = await User.findOne({ _id: userId, isDeleted: false });
      if (!user) {
        throw new Error("User not found");
      }

      // Generate referral URL if it doesn't exist
      if (!user.referralUrl) {
        const baseUrl = "https://app.troak.club";
        const referralUrl = `${baseUrl}?referrer=${userId}`;

        user.referralUrl = referralUrl;
        await user.save();

        logger.info(
          `Generated referral link for user ${userId}: ${referralUrl}`
        );
      }

      return {
        referralUrl: user.referralUrl
      };
    } catch (error) {
      logger.error(
        `Error getting referral link for user ${userId}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Claim multiple rewards for a user in a single transaction
   * @param {string} userId - User ID
   * @param {string[]} referralIds - Array of Referral IDs
   * @returns {Promise<Object>} Claim results
   */
  async claimMultipleRewards(userId, referralIds) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let totalRewardAmount = 0;
      const claimedRewards = [];
      const errors = [];

      // Find all referrals and validate them first
      const referrals = await Referral.find({
        _id: { $in: referralIds }
      }).session(session);

      // Check if all referrals were found
      if (referrals.length !== referralIds.length) {
        throw new Error("One or more referrals not found");
      }

      // Process each referral
      for (const referral of referrals) {
        const isReferredUser = referral.referredUserId.toString() === userId;
        const isReferrer = referral.referrerUserId.toString() === userId;

        if (!isReferredUser && !isReferrer) {
          errors.push(`Not authorized for referral: ${referral._id}`);
          continue;
        }

        let rewardAmount;
        let rewardType;
        let alreadyClaimed;

        if (isReferredUser) {
          rewardAmount = referral.referredUserReward;
          rewardType = "referred_user";
          alreadyClaimed = referral.referredUserRewardClaimed;
        } else {
          rewardAmount = referral.referrerReward;
          rewardType = "referrer";
          alreadyClaimed = referral.referrerRewardClaimed;
        }

        if (alreadyClaimed) {
          errors.push(`Reward already claimed for referral: ${referral._id}`);
          continue;
        }

        // Mark reward as claimed
        if (isReferredUser) {
          referral.referredUserRewardClaimed = true;
          referral.referredUserRewardClaimedAt = new Date();
        } else {
          referral.referrerRewardClaimed = true;
          referral.referrerRewardClaimedAt = new Date();
        }

        await referral.save({ session });
        totalRewardAmount += rewardAmount;
        claimedRewards.push({
          referralId: referral._id,
          amount: rewardAmount,
          rewardType
        });
      }

      // If no valid rewards were found, abort
      if (claimedRewards.length === 0) {
        throw new Error(errors.join(", "));
      }

      // Add total diamonds to user
      const updatedUser = await User.findOneAndUpdate(
        { _id: userId, isDeleted: false },
        { $inc: { diamonds: totalRewardAmount } },
        { new: true, session }
      );

      await session.commitTransaction();

      logger.info(
        `Multiple rewards claimed: ${totalRewardAmount} diamonds by user ${userId}`
      );

      return {
        success: true,
        totalAmount: totalRewardAmount,
        newBalance: updatedUser.diamonds,
        claimedRewards,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error claiming multiple rewards: ${error.message}`);
      return {
        success: false,
        message: error.message
      };
    } finally {
      session.endSession();
    }
  }
}

module.exports = new ReferralService();
