const WeeklyStreak = require("../models/WeeklyStreak");
const User = require("../models/User");
const logger = require("../utils/logger");

// Mark user as logged in for the current day
const markDayLoggedIn = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentDate = new Date();

    const weekStartDate = WeeklyStreak.getWeekStartDate(currentDate);
    const weekEndDate = WeeklyStreak.getWeekEndDate(currentDate);

    let weeklyStreak = await WeeklyStreak.findOne({
      userId,
      weekStartDate: { $lte: currentDate },
      weekEndDate: { $gt: currentDate }
    });

    if (!weeklyStreak) {
      weeklyStreak = new WeeklyStreak({
        userId,
        weekStartDate,
        weekEndDate,
        daysLoggedIn: 0,
        totalDaysInWeek: 7,
        weeklyStreakCompleted: false,
        weeklyRewardClaimed: false,
        weeklyRewardAmount: 0,
        lastLoginDate: null,
        weekdays: {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        },
        // Initialize weekly story completion fields
        storiesCompletedThisWeek: 0,
        weeklyStoryRewardClaimed: false,
        weeklyStoryRewardAmount: 0,
        completedStoriesThisWeek: []
      });
      
      // Initialize weekdays for the new week
      weeklyStreak.initializeWeekdays();
    }
    
    // Mark the day as logged in
    const wasLoggedIn = weeklyStreak.markDayLoggedIn(currentDate);
    
    if (wasLoggedIn) {
      await weeklyStreak.save();
      
      logger.info(`User ${userId} marked as logged in for ${currentDate.toDateString()}`);
      
      res.json({
        success: true,
        message: "Day marked as logged in successfully",
        data: weeklyStreak
      });
    } else {
      res.json({
        success: true,
        message: "Already logged in today or date not in current week",
        data: weeklyStreak
      });
    }
  } catch (error) {
    logger.error("Error marking day as logged in:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark day as logged in",
      error: error.message
    });
  }
};

// Claim weekly reward
const claimWeeklyReward = async (req, res) => {
  try {
    const { userId, weeklyStreakId } = req.params;
    
    // Find weekly streak record by _id
    const weeklyStreak = await WeeklyStreak.findOne({
      _id: weeklyStreakId,
      userId: userId
    });
    
    if (!weeklyStreak) {
      return res.status(404).json({
        success: false,
        message: "Weekly streak record not found"
      });
    }
    
    if (!weeklyStreak.canClaimWeeklyReward()) {
      return res.status(400).json({
        success: false,
        message: "Weekly reward cannot be claimed. Complete all 7 days first or reward already claimed.",
        data: {
          weekSummary: weeklyStreak
        }
      });
    }
    
    // Claim the reward
    const rewardAmount = weeklyStreak.claimWeeklyReward();
    await weeklyStreak.save();
    
    // Update user's diamond balance
    const user = await User.findById(userId);
    if (user) {
      user.diamonds = (user.diamonds || 0) + rewardAmount;
      await user.save();
      
      logger.info(`User ${userId} claimed weekly reward of ${rewardAmount} diamonds`);
    }
    
    res.json({
      success: true,
      message: `Weekly reward claimed successfully! You earned ${rewardAmount} diamonds.`,
      data: {
        rewardAmount,
        newDiamondBalance: user?.diamonds || 0,
        weekSummary: weeklyStreak
      }
    });
  } catch (error) {
    logger.error("Error claiming weekly reward:", error);
    res.status(500).json({
      success: false,
      message: "Failed to claim weekly reward",
      error: error.message
    });
  }
};

// Get current week's progress
const getCurrentWeekProgress = async (req, res) => {
  try {
    const { userId, weeklyStreakId } = req.params;
    
    // Find weekly streak record by _id
    let weeklyStreak = await WeeklyStreak.findOne({
      _id: weeklyStreakId,
      userId: userId
    });
    
    if (!weeklyStreak) {
      // Return empty week data
      return res.json({
        success: true,
        message: "Weekly streak record not found",
        data: null
      });
    }
    const missedWeekdays = weeklyStreak.getMissedWeekdays();

    res.json({
      success: true,
      message: "Weekly streak progress retrieved successfully",
      data: {
        weekSummary: weeklyStreak,
        missedWeekdays,
        isNewWeek: false
      }
    });
  } catch (error) {
    logger.error("Error getting current week progress:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get current week progress",
      error: error.message
    });
  }
};

// Get user's weekly streak history
const getWeeklyStreakHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, page = 1 } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Get weekly streak history
    const weeklyStreaks = await WeeklyStreak.find({ userId })
      .sort({ weekStartDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await WeeklyStreak.countDocuments({ userId });
    
    const history = weeklyStreaks.map(streak => ({
      weekStartDate: streak.weekStartDate,
      weekEndDate: streak.weekEndDate,
      weekdays: streak.weekdays,
      daysLoggedIn: streak.daysLoggedIn,
      totalDaysInWeek: streak.totalDaysInWeek,
      progressPercentage: streak.getProgressPercentage(),
      weeklyStreakCompleted: streak.weeklyStreakCompleted,
      weeklyRewardClaimed: streak.weeklyRewardClaimed,
      weeklyRewardAmount: streak.weeklyRewardAmount,
      weeklyRewardClaimedAt: streak.weeklyRewardClaimedAt,
      missedWeekdays: streak.getMissedWeekdays()
    }));
    
    res.json({
      success: true,
      message: "Weekly streak history retrieved successfully",
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalRecords: total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error("Error getting weekly streak history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get weekly streak history",
      error: error.message
    });
  }
};

// Get weekly streak statistics
const getWeeklyStreakStats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get total completed weeks
    const totalCompletedWeeks = await WeeklyStreak.countDocuments({
      userId,
      weeklyStreakCompleted: true
    });
    
    // Get total rewards claimed
    const totalRewardsClaimed = await WeeklyStreak.countDocuments({
      userId,
      weeklyRewardClaimed: true
    });
    
    // Get total diamonds earned
    const totalDiamondsEarned = await WeeklyStreak.aggregate([
      { $match: { userId: userId, weeklyRewardClaimed: true } },
      { $group: { _id: null, total: { $sum: "$weeklyRewardAmount" } } }
    ]);
    
    // Get current streak (consecutive completed weeks)
    const currentStreak = await WeeklyStreak.find({
      userId,
      weeklyStreakCompleted: true
    })
    .sort({ weekStartDate: -1 })
    .limit(1);
    
    let consecutiveWeeks = 0;
    if (currentStreak.length > 0) {
      let checkDate = new Date(currentStreak[0].weekStartDate);
      let weekCount = 0;
      
      while (true) {
        const weekRecord = await WeeklyStreak.findOne({
          userId,
          weekStartDate: { $gte: checkDate, $lt: new Date(checkDate.getTime() + 24 * 60 * 60 * 1000) },
          weeklyStreakCompleted: true
        });
        
        if (weekRecord) {
          weekCount++;
          checkDate.setDate(checkDate.getDate() - 7); // Go back one week
        } else {
          break;
        }
      }
      consecutiveWeeks = weekCount;
    }
    
    res.json({
      success: true,
      message: "Weekly streak statistics retrieved successfully",
      data: {
        totalCompletedWeeks,
        totalRewardsClaimed,
        totalDiamondsEarned: totalDiamondsEarned[0]?.total || 0,
        currentConsecutiveWeeks: consecutiveWeeks,
        averageDiamondsPerWeek: totalCompletedWeeks > 0 ? (totalDiamondsEarned[0]?.total || 0) / totalCompletedWeeks : 0
      }
    });
  } catch (error) {
    logger.error("Error getting weekly streak statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get weekly streak statistics",
      error: error.message
    });
  }
};

module.exports = {
  markDayLoggedIn,
  claimWeeklyReward,
  getCurrentWeekProgress,
  getWeeklyStreakHistory,
  getWeeklyStreakStats
}; 