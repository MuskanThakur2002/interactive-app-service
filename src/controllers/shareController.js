const ReferralService = require("../services/ReferralService");
const logger = require("../utils/logger");

/**
 * POST /share/process-referral
 * Process new user referral login
 * Receives userID and referralUrl from frontend
 * Immediately rewards both users
 */
const processReferral = async (req, res) => {
  try {
    const { userId, referralUrl } = req.body;

    if (!userId || !referralUrl) {
      return res.status(400).json({
        success: false,
        message: "User ID and referral URL are required"
      });
    }

    // Process the referral
    const result = await ReferralService.processNewUserReferral(
      userId,
      referralUrl
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        referredUserReward: result.referredUserReward,
        referrerReward: result.referrerReward,
        referralId: result.referralId
      },
      message:
        "Referral processed successfully - rewards available for claiming"
    });
  } catch (error) {
    logger.error(`Error processing referral: ${error.message}`);

    return res.status(500).json({
      success: false,
      message: "Failed to process referral",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/**
 * GET /share/rewards/:userId
 * Check all reward availability for user (both as referred user and referrer)
 */
const checkAllUserRewards = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const result = await ReferralService.checkAllUserRewards(userId);

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(
      `Error checking all user rewards for ${req.params.userId}: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      message: "Failed to check rewards",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/**
 * POST /share/claim
 * Claim reward for user (automatically detects referred vs referrer)
 */
const claimReward = async (req, res) => {
  try {
    const { userId, referralIds } = req.body;

    if (!userId || !Array.isArray(referralIds) || referralIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "User ID and at least one referral ID are required"
      });
    }

    // Process single referral using existing method
    if (referralIds.length === 1) {
      const result = await ReferralService.claimReward(userId, referralIds[0]);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          amount: result.amount,
          newBalance: result.newBalance,
          rewardType: result.rewardType
        },
        message: "Reward claimed successfully"
      });
    }

    // Process multiple referrals
    const results = await ReferralService.claimMultipleRewards(
      userId,
      referralIds
    );

    if (!results.success) {
      return res.status(400).json({
        success: false,
        message: results.message
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalAmount: results.totalAmount,
        newBalance: results.newBalance,
        claimedRewards: results.claimedRewards
      },
      message: "Multiple rewards claimed successfully"
    });
  } catch (error) {
    logger.error(`Error claiming reward: ${error.message}`);

    return res.status(500).json({
      success: false,
      message: "Failed to claim reward",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

/**
 * GET /share/link/:userId
 * Get user's referral link
 */
const getUserReferralLink = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const result = await ReferralService.getUserReferralLink(userId);

    return res.status(200).json({
      success: true,
      data: {
        referralUrl: result.referralUrl
      },
      message: "Referral link retrieved successfully"
    });
  } catch (error) {
    logger.error(
      `Error getting referral link for user ${req.params.userId}: ${error.message}`
    );

    return res.status(500).json({
      success: false,
      message: "Failed to get referral link",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

module.exports = {
  processReferral,
  checkAllUserRewards,
  claimReward,
  getUserReferralLink
};
