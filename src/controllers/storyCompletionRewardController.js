const WeeklyStreak = require("../models/WeeklyStreak");
const UserProgress = require("../models/UserProgressV2");
const Story = require("../models/StoryV2");
const Chapter = require("../models/ChapterV2");
const User = require("../models/User");
const logger = require("../utils/logger");

// Check and update story completion status (integrated with weekly streak)
const checkStoryCompletion = async (req, res) => {
  try {
    const { userId, storyId } = req.params;

    if (!userId || !storyId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Story ID are required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get all chapters for this story
    const chapters = await Chapter.find({
      storyId,
      isDeleted: false
    }).sort({ createdAt: 1 });

    if (chapters.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No chapters found for this story"
      });
    }

    // Get user progress for all chapters in this story
    const userProgress = await UserProgress.find({
      userId,
      storyId
    });

    // Check if all chapters are completed
    const completedChapters = userProgress.filter(progress => progress.isCompleted);
    const isStoryCompleted = completedChapters.length === chapters.length;

    // Get current week's streak record
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

    let storyCompleted = false;
    let weeklyStoryRewardReady = false;

    // If story is completed, add it to weekly streak
    if (isStoryCompleted) {
      const story = await Story.findById(storyId);
      const storyTitle = story ? story.title : null;
      
      storyCompleted = weeklyStreak.addCompletedStory(storyId, storyTitle);
      
      if (storyCompleted) {
        await weeklyStreak.save();
      }
    }

    // Use the flag from the model instead of calculating
    weeklyStoryRewardReady = weeklyStreak.weeklyStoryRewardReady;

    return res.status(200).json({
      success: true,
      data: {
        storyCompleted,
        isStoryCompleted,
        totalChapters: chapters.length,
        completedChapters: completedChapters.length,
        weeklyStreakId: weeklyStreak._id,
        storiesCompletedThisWeek: weeklyStreak.storiesCompletedThisWeek,
        storyProgressPercentage: weeklyStreak.getStoryProgressPercentage(),
        canClaimWeeklyStoryReward: weeklyStreak.canClaimWeeklyStoryReward(),
        weeklyStoryRewardReady,
        weeklyStoryRewardAmount: weeklyStreak.weeklyStoryRewardAmount,
        weeklyStoryRewardReady: weeklyStreak.weeklyStoryRewardReady,
        weekdays: weeklyStreak.weekdays,
        daysLoggedIn: weeklyStreak.daysLoggedIn,
        loginProgressPercentage: weeklyStreak.getProgressPercentage(),
        canClaimWeeklyReward: weeklyStreak.canClaimWeeklyReward(),
        weeklyStreakCompleted: weeklyStreak.weeklyStreakCompleted,
        missedWeekdays: weeklyStreak.getMissedWeekdays(),
        userDiamonds: user.diamonds
      }
    });
  } catch (error) {
    logger.error(`Error checking story completion: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Separate API to claim story completion reward (now integrated with weekly streak)
const claimStoryCompletionReward = async (req, res) => {
  try {
    const { userId, weeklyStreakId } = req.params;

    if (!userId || !weeklyStreakId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Weekly Streak ID are required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get weekly streak record
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

    // Check if weekly story reward is ready to claim
    if (!weeklyStreak.canClaimWeeklyStoryReward()) {
      return res.status(400).json({
        success: false,
        message: "No weekly story reward ready to claim. Complete 5 stories in this week to earn rewards."
      });
    }

    // Claim reward
    const rewardAmount = weeklyStreak.claimWeeklyStoryReward();
    
    if (rewardAmount > 0) {
      // Add diamonds to user
      user.diamonds += rewardAmount;
      await user.save();
      await weeklyStreak.save();

      logger.info(
        `Weekly story completion reward claimed for user ${userId}: ${rewardAmount} diamonds`
      );

      return res.status(200).json({
        success: true,
        data: {
          rewardAmount,
          userDiamonds: user.diamonds,
          weeklyStreakId: weeklyStreak._id,
          storiesCompletedThisWeek: weeklyStreak.storiesCompletedThisWeek,
          completedStoriesThisWeek: weeklyStreak.completedStoriesThisWeek,
          canClaimWeeklyStoryReward: weeklyStreak.canClaimWeeklyStoryReward()
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "No weekly story reward available to claim"
      });
    }
  } catch (error) {
    logger.error(`Error claiming weekly story completion reward: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get story completion statistics (now integrated with weekly streak)
const getStoryCompletionStatistics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get current week's streak record
    const currentDate = new Date();
    const weekStartDate = WeeklyStreak.getWeekStartDate(currentDate);
    const weekEndDate = WeeklyStreak.getWeekEndDate(currentDate);

    let weeklyStreak = await WeeklyStreak.findOne({
      userId,
      weekStartDate: { $lte: currentDate },
      weekEndDate: { $gt: currentDate }
    });

    if (!weeklyStreak) {
      // Create new weekly streak record if doesn't exist
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
      await weeklyStreak.save();
    }

    // Get all user progress to calculate current story completion status
    const userProgress = await UserProgress.find({ userId });
    const uniqueStoryIds = [...new Set(userProgress.map(progress => progress.storyId.toString()))];
    
    const storyCompletionStatus = await Promise.all(
      uniqueStoryIds.map(async (storyId) => {
        const chapters = await Chapter.find({
          storyId,
          isDeleted: false
        });
        
        const storyProgress = userProgress.filter(progress => 
          progress.storyId.toString() === storyId
        );
        
        const completedChapters = storyProgress.filter(progress => progress.isCompleted);
        const isCompleted = completedChapters.length === chapters.length;
        
        const story = await Story.findById(storyId);
        
        return {
          storyId,
          storyTitle: story ? story.title : 'Unknown Story',
          totalChapters: chapters.length,
          completedChapters: completedChapters.length,
          isCompleted,
          progressPercentage: chapters.length > 0 ? (completedChapters.length / chapters.length) * 100 : 0
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        // Current week information
        weeklyStreakId: weeklyStreak._id,
        weekStartDate: weeklyStreak.weekStartDate,
        weekEndDate: weeklyStreak.weekEndDate,
        // Weekly story completion progress
        storiesCompletedThisWeek: weeklyStreak.storiesCompletedThisWeek,
        storyProgressPercentage: weeklyStreak.getStoryProgressPercentage(),
        canClaimWeeklyStoryReward: weeklyStreak.canClaimWeeklyStoryReward(),
        weeklyStoryRewardClaimed: weeklyStreak.weeklyStoryRewardClaimed,
        weeklyStoryRewardAmount: weeklyStreak.weeklyStoryRewardAmount,
        weeklyStoryRewardReady: weeklyStreak.weeklyStoryRewardReady,
        completedStoriesThisWeek: weeklyStreak.completedStoriesThisWeek,
        // Weekly login streak progress
        weekdays: weeklyStreak.weekdays,
        daysLoggedIn: weeklyStreak.daysLoggedIn,
        loginProgressPercentage: weeklyStreak.getProgressPercentage(),
        canClaimWeeklyReward: weeklyStreak.canClaimWeeklyReward(),
        weeklyStreakCompleted: weeklyStreak.weeklyStreakCompleted,
        missedWeekdays: weeklyStreak.getMissedWeekdays(),
        // Overall story completion status
        storyCompletionStatus,
        totalStoriesInProgress: uniqueStoryIds.length,
        userDiamonds: user.diamonds
      }
    });
  } catch (error) {
    logger.error(`Error getting story completion statistics: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get story completion history (now shows current week's completed stories)
const getStoryCompletionHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, page = 1 } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get current week's streak record
    const currentDate = new Date();
    const weekStartDate = WeeklyStreak.getWeekStartDate(currentDate);
    const weekEndDate = WeeklyStreak.getWeekEndDate(currentDate);

    let weeklyStreak = await WeeklyStreak.findOne({
      userId,
      weekStartDate: { $lte: currentDate },
      weekEndDate: { $gt: currentDate }
    });

    if (!weeklyStreak) {
      return res.status(200).json({
        success: true,
        data: {
          history: [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: 0,
            totalRecords: 0,
            limit: parseInt(limit)
          },
          weekInfo: {
            weekStartDate,
            weekEndDate,
            storiesCompletedThisWeek: 0
          }
        }
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = weeklyStreak.completedStoriesThisWeek.length;

    // Get paginated completed stories from current week
    const history = weeklyStreak.completedStoriesThisWeek
      .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))
      .slice(skip, skip + parseInt(limit));

    return res.status(200).json({
      success: true,
      data: {
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalRecords: total,
          limit: parseInt(limit)
        },
        weekInfo: {
          weekStartDate: weeklyStreak.weekStartDate,
          weekEndDate: weeklyStreak.weekEndDate,
          storiesCompletedThisWeek: weeklyStreak.storiesCompletedThisWeek,
          storyProgressPercentage: weeklyStreak.getStoryProgressPercentage(),
          canClaimWeeklyStoryReward: weeklyStreak.canClaimWeeklyStoryReward()
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting story completion history: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Check reward status (simple check without story completion validation)
const checkRewardStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get current week's streak record
    const currentDate = new Date();
    const weekStartDate = WeeklyStreak.getWeekStartDate(currentDate);
    const weekEndDate = WeeklyStreak.getWeekEndDate(currentDate);

    let weeklyStreak = await WeeklyStreak.findOne({
      userId,
      weekStartDate: { $lte: currentDate },
      weekEndDate: { $gt: currentDate }
    });

    if (!weeklyStreak) {
      // Create new weekly streak record if doesn't exist
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
      await weeklyStreak.save();
    }

    return res.status(200).json({
      success: true,
      data: {
        weeklyStreakId: weeklyStreak._id,
        weekStartDate: weeklyStreak.weekStartDate,
        weekEndDate: weeklyStreak.weekEndDate,
        canClaimWeeklyStoryReward: weeklyStreak.canClaimWeeklyStoryReward(),
        storiesCompletedThisWeek: weeklyStreak.storiesCompletedThisWeek,
        storyProgressPercentage: weeklyStreak.getStoryProgressPercentage(),
        weeklyStoryRewardClaimed: weeklyStreak.weeklyStoryRewardClaimed,
        weeklyStoryRewardAmount: weeklyStreak.weeklyStoryRewardAmount,
        weeklyStoryRewardReady: weeklyStreak.weeklyStoryRewardReady,
        canClaimWeeklyReward: weeklyStreak.canClaimWeeklyReward(),
        weekdays: weeklyStreak.weekdays,
        daysLoggedIn: weeklyStreak.daysLoggedIn,
        loginProgressPercentage: weeklyStreak.getProgressPercentage(),
        weeklyStreakCompleted: weeklyStreak.weeklyStreakCompleted,
        weeklyRewardClaimed: weeklyStreak.weeklyRewardClaimed,
        missedWeekdays: weeklyStreak.getMissedWeekdays(),
        userDiamonds: user.diamonds
      }
    });
  } catch (error) {
    logger.error(`Error checking reward status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  checkStoryCompletion,
  claimStoryCompletionReward,
  getStoryCompletionStatistics,
  getStoryCompletionHistory,
  checkRewardStatus
}; 