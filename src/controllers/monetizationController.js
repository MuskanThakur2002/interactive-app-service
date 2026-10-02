const DailyRewards = require("../models/DailyRewards");
const TimeTracking = require("../models/TimeTracking");
const DailyHourlyRewards = require("../models/DailyHourlyRewards");
const HourlyRewardNotification = require("../models/HourlyRewardNotification");
const WeeklyStreak = require("../models/WeeklyStreak");
const SceneUnlock = require("../models/SceneUnlock");
const UserProgress = require("../models/UserProgressV2");
const User = require("../models/User");
const Scene = require("../models/SceneV2");
const { mongoose } = require("../utils/DatabaseUtils");
const logger = require("../utils/logger");
const { getFreeScenesLimitForStory } = require("../config/scenesConfig");
const { unlockScenes, HttpError } = require("../services/SceneUnlockService");

// Daily Rewards Controller
const claimDailyReward = async (req, res) => {
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

    // Get or create daily rewards record
    let dailyRewards = await DailyRewards.findOne({ userId });

    if (!dailyRewards) {
      // First time claiming
      dailyRewards = new DailyRewards({
        userId,
        startDate: new Date(),
        lastClaimDate: new Date(),
        totalDaysClaimed: 1,
        lastRewardAmount: DailyRewards.calculateReward(1),
        totalLoginDays: 1
      });
    } else {
      // Check if user can claim today
      if (!dailyRewards.canClaimToday()) {
        return res.status(400).json({
          success: false,
          message: "Daily reward already claimed today"
        });
      }

      dailyRewards.lastClaimDate = new Date();
      dailyRewards.totalDaysClaimed += 1;
      dailyRewards.totalLoginDays += 1;
    }

    // Calculate reward amount
    const rewardAmount = DailyRewards.calculateReward(
      dailyRewards.totalDaysClaimed
    );
    dailyRewards.lastRewardAmount = rewardAmount;

    // Add diamonds to user
    user.diamonds += rewardAmount;
    await user.save();

    // Save daily rewards record
    await dailyRewards.save();

    logger.info(
      `Daily reward claimed for user ${userId}: ${rewardAmount} diamonds`
    );

    return res.status(200).json({
      success: true,
      data: {
        rewardAmount,
        totalDaysClaimed: dailyRewards.totalDaysClaimed,
        totalLoginDays: dailyRewards.totalLoginDays,
        userDiamonds: user.diamonds,
        startDate: dailyRewards.startDate,
        totalDaysSinceStart: dailyRewards.getTotalDaysSinceStart()
      }
    });
  } catch (error) {
    logger.error(`Error claiming daily reward: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getDailyRewardStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const dailyRewards = await DailyRewards.findOne({ userId });

    if (!dailyRewards) {
      return res.status(200).json({
        success: true,
        data: {
          canClaim: true,
          totalDaysClaimed: 0,
          totalLoginDays: 0,
          nextRewardAmount: DailyRewards.calculateReward(1),
          startDate: null,
          totalDaysSinceStart: 0,
          missedDates: []
        }
      });
    }

    const canClaim = dailyRewards.canClaimToday();
    const nextRewardAmount = canClaim
      ? DailyRewards.calculateReward(dailyRewards.totalDaysClaimed + 1)
      : DailyRewards.calculateReward(dailyRewards.totalDaysClaimed);

    return res.status(200).json({
      success: true,
      data: {
        canClaim,
        totalDaysClaimed: dailyRewards.totalDaysClaimed,
        totalLoginDays: dailyRewards.totalLoginDays,
        lastClaimDate: dailyRewards.lastClaimDate,
        nextRewardAmount,
        startDate: dailyRewards.startDate,
        totalDaysSinceStart: dailyRewards.getTotalDaysSinceStart()
      }
    });
  } catch (error) {
    logger.error(`Error getting daily reward status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Time Tracking Controller
const startTimeTracking = async (req, res) => {
  try {
    const { userId, deviceId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // End any existing active session
    await TimeTracking.updateMany(
      { userId, isActive: true },
      { isActive: false, sessionEndTime: new Date() }
    );

    // Create new session
    const timeTracking = new TimeTracking({
      userId,
      deviceId,
      sessionStartTime: new Date()
    });

    await timeTracking.save();

    logger.info(`Time tracking started for user ${userId}`);

    return res.status(200).json({
      success: true,
      data: {
        sessionId: timeTracking._id,
        startTime: timeTracking.sessionStartTime
      }
    });
  } catch (error) {
    logger.error(`Error starting time tracking: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const endTimeTracking = async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    if (!sessionId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Session ID and User ID are required"
      });
    }

    const timeTracking = await TimeTracking.findOne({
      _id: sessionId,
      userId,
      isActive: true
    });

    if (!timeTracking) {
      return res.status(404).json({
        success: false,
        message: "Active session not found"
      });
    }

    // Calculate session duration
    const sessionEndTime = new Date();
    const totalSessionTime = sessionEndTime.getTime() - timeTracking.sessionStartTime.getTime();
    
    // Update the session record
    timeTracking.sessionEndTime = sessionEndTime;
    timeTracking.totalSessionTime = totalSessionTime;
    timeTracking.isActive = false;
    await timeTracking.save();
    
    // SIMPLIFIED: Add session time to daily record and check for new diamonds
    const dailyRecord = await DailyHourlyRewards.addSessionTime(userId, totalSessionTime);
    
    // Calculate diamonds earned from this session (for backward compatibility)
    const sessionDiamondsEarned = TimeTracking.calculateDiamondsFromTime(totalSessionTime);

    logger.info(
      `Time tracking ended for user ${userId}, session duration: ${Math.round(totalSessionTime / (1000 * 60 * 60) * 100) / 100} hours, session diamonds: ${sessionDiamondsEarned}, total claimable: ${dailyRecord.claimableDiamonds}`
    );

    return res.status(200).json({
      success: true,
      data: {
        diamondsEarned: sessionDiamondsEarned, // Session-specific diamonds for backward compatibility
        totalDiamondsEarned: sessionDiamondsEarned,
        diamondsClaimedDuringSession: 0, // No diamonds claimed during session in new logic
        sessionTime: totalSessionTime,
        sessionTimeInHours: Math.round(totalSessionTime / (1000 * 60 * 60) * 100) / 100,
        userDiamonds: 0
      }
    });
  } catch (error) {
    logger.error(`Error ending time tracking: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getTimeTrackingStats = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    const totalTimeToday = await TimeTracking.getTotalTimeToday(userId);
    const diamondsEarnedToday =
      TimeTracking.calculateDiamondsFromTime(totalTimeToday);

    // Get current active session if any
    const activeSession = await TimeTracking.findOne({
      userId,
      isActive: true
    });

    let currentSessionInfo = null;
    if (activeSession) {
      const currentTime = new Date();
      const currentSessionTime = currentTime.getTime() - activeSession.sessionStartTime.getTime();
      const currentSessionDiamonds = TimeTracking.calculateDiamondsFromTime(currentSessionTime);
      
      // Update session data in database with current progress
      activeSession.totalSessionTime = currentSessionTime;
      activeSession.diamondsEarned = currentSessionDiamonds;
      await activeSession.save();
      
      logger.info(
        `Session stats updated for user ${userId}: ${Math.round(currentSessionTime / (1000 * 60 * 60) * 100) / 100} hours, ${currentSessionDiamonds} diamonds earned`
      );
      
      currentSessionInfo = {
        sessionId: activeSession._id,
        sessionStartTime: activeSession.sessionStartTime,
        currentSessionTime: currentSessionTime,
        currentSessionTimeInHours: Math.round(currentSessionTime / (1000 * 60 * 60) * 100) / 100,
        currentSessionDiamonds: currentSessionDiamonds,
        diamondsPerHour: 1
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        totalTimeToday,
        diamondsEarnedToday,
        timeInHours: Math.round(totalTimeToday / (1000 * 60 * 60) * 100) / 100,
        currentSession: currentSessionInfo,
        diamondsPerHour: 1
      }
    });
  } catch (error) {
    logger.error(`Error getting time tracking stats: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getCurrentSessionProgress = async (req, res) => {
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

    // SIMPLIFIED: Get daily hourly rewards status
    const dailyStats = await TimeTracking.getDailyHourlyRewardsStatus(userId);

    // Check for active session
    const activeSession = await TimeTracking.findOne({
      userId,
      isActive: true
    });

    if (!activeSession) {
      // No active session - user is not currently reading
      return res.status(200).json({
        success: true,
        data: {
          hasActiveSession: false,
          message: "No active session found"
        }
      });
    }

    // Update active session with current progress (for display purposes)
    const currentTime = new Date();
    const currentSessionTime = currentTime.getTime() - activeSession.sessionStartTime.getTime();
    const currentSessionDiamonds = TimeTracking.calculateDiamondsFromTime(currentSessionTime);
    
    activeSession.totalSessionTime = currentSessionTime;
    activeSession.diamondsEarned = currentSessionDiamonds;
    await activeSession.save();
    
    logger.info(
      `Session progress updated for user ${userId}: ${Math.round(currentSessionTime / (1000 * 60 * 60) * 100) / 100} hours, ${currentSessionDiamonds} diamonds earned, claimable: ${dailyStats.claimableDiamonds}`
    );

    return res.status(200).json({
      success: true,
      data: {
        hasActiveSession: true,
        message: "Active session found",
        // Frontend-specific fields only
        diamondsEarned: dailyStats.claimableDiamonds, // Total claimable diamonds from all sessions
        canClaim: dailyStats.claimableDiamonds > 0, // True if any diamonds can be claimed
        nextDiamondInMinutes: dailyStats.nextDiamondInMinutes // Time until next diamond
      }
    });
  } catch (error) {
    logger.error(`Error getting current session progress: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const claimSessionDiamonds = async (req, res) => {
  try {
    const { sessionId, userId } = req.body;

    if (!sessionId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Session ID and User ID are required"
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

    // SIMPLIFIED: Use simplified daily aggregation logic for claiming
    const claimResult = await TimeTracking.claimDailyHourlyRewards(userId);
    
    if (!claimResult.success) {
      return res.status(400).json({
        success: false,
        message: claimResult.message
      });
    }

    // Award diamonds to user
    if (claimResult.diamondsClaimed > 0) {
      user.diamonds += claimResult.diamondsClaimed;
      await user.save();
    }

    logger.info(
      `Daily hourly rewards claimed for user ${userId}: ${claimResult.diamondsClaimed} diamonds`
    );

    return res.status(200).json({
      success: true,
      data: {
        diamondsClaimed: claimResult.diamondsClaimed,
        userDiamonds: user.diamonds
      }
    });
  } catch (error) {
    logger.error(`Error claiming session diamonds: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Scene Unlock Controller
const unlockScene = async (req, res) => {
  try {
    const {
      userId,
      storyId,
      chapterId,
      sceneId,
      unlockType,
      unlockMultiple = false
    } = req.body;

    const result = await unlockScenes({
      userId,
      storyId,
      chapterId,
      unlockType,
      unlockMultiple,
      sceneId
    });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error && error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    logger.error(`Error unlocking scene: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const unlockEntireStory = async (req, res) => {
  try {
    const { userId, storyId } = req.body;

    if (!userId || !storyId) {
      logger.warn("User ID and Story ID are required to unlock entire story");
      return res.status(400).json({
        success: false,
        message: "User ID and Story ID are required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      logger.warn(`User not found to unlock entire story for user ${userId} and story ${storyId}`);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user has enough diamonds (60 diamonds required)
    const diamondsRequired = 60;
    if (user.diamonds < diamondsRequired) {
      logger.warn(`User does not have enough diamonds to unlock entire story for user ${userId} and story ${storyId}`);
      return res.status(400).json({
        success: false,
        message: "Not enough diamonds. 60 diamonds required to unlock entire story."
      });
    }

    // Get all chapters for this story
    const Chapter = require("../models/ChapterV2");
    const chapters = await Chapter.find({ storyId }).sort({ chapterNumber: 1 });
    
    if (chapters.length === 0) {
      logger.warn(`No chapters found for this story for user ${userId} and story ${storyId}`);
      return res.status(404).json({
        success: false,
        message: "No chapters found for this story"
      });
    }

    // Get all scenes for all chapters
    const allScenes = await Scene.find({ 
      chapterId: { $in: chapters.map(ch => ch._id) } 
    }).sort({ chapterId: 1, sceneNumber: 1 });

    if (allScenes.length === 0) {
      logger.warn(`No scenes found for this story for user ${userId} and story ${storyId}`);
      return res.status(404).json({
        success: false,
        message: "No scenes found for this story"
      });
    }

    // Get all user progress records in one query
    const existingProgress = await UserProgress.find({
      userId,
      storyId,
      chapterId: { $in: chapters.map(ch => ch._id) }
    });
    
    // Create a map for quick lookup
    const progressMap = new Map();
    existingProgress.forEach(progress => {
      progressMap.set(progress.chapterId.toString(), progress);
    });
    
    // Check if story is already fully unlocked
    let totalAlreadyUnlockedCount = 0;
    existingProgress.forEach(progress => {
      totalAlreadyUnlockedCount += progress.unlockedScenesNumber || 0;
    });
    
    if (totalAlreadyUnlockedCount === allScenes.length) {
      logger.warn(`Story is already fully unlocked for user ${userId} and story ${storyId}`);
      return res.status(400).json({
        success: false,
        message: "Story is already fully unlocked"
      });
    }

    // Prepare all operations for batch execution
    const unlockOperations = [];
    const progressUpdates = [];
    let totalScenesUnlocked = 0;
    
    for (const chapter of chapters) {
      const chapterScenes = allScenes.filter(scene => 
        scene.chapterId.toString() === chapter._id.toString()
      );
      
      let userProgress = progressMap.get(chapter._id.toString());
      
      if (!userProgress) {
        // Create new user progress
        userProgress = new UserProgress({
          userId,
          storyId,
          chapterId: chapter._id,
          scenesRead: 0,
          totalScenes: chapterScenes.length,
          isStarted: true,
          unlockedScenesNumber: 0
        });
        progressUpdates.push(userProgress);
      }
      
      const currentUnlockedCount = userProgress.unlockedScenesNumber || 0;
      const scenesToUnlockInChapter = chapterScenes.slice(currentUnlockedCount);
      
      // Add unlock operations
      scenesToUnlockInChapter.forEach(scene => {
        unlockOperations.push({
          userId,
          storyId,
          chapterId: chapter._id,
          sceneId: scene._id,
          diamondsSpent: 0,
          unlockType: 'PAID',
          unlockTime: new Date(),
          isActive: true
        });
      });
      
      totalScenesUnlocked += scenesToUnlockInChapter.length;
      
      // Update progress
      userProgress.unlockedScenesNumber = chapterScenes.length;
      userProgress.lastSceneUnlockTime = new Date();
      progressUpdates.push(userProgress);
    }
    
    // Execute all operations in a database transaction for atomicity
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        // 1. Create all scene unlock records
        if (unlockOperations.length > 0) {
          await SceneUnlock.insertMany(unlockOperations, { session });
        }
        
        // 2. Update all user progress records
        for (const progress of progressUpdates) {
          await progress.save({ session });
        }
        
        // 3. Deduct diamonds from user (only after all unlocks are successful)
        user.diamonds -= diamondsRequired;
        await user.save({ session });
      });
      
      await session.endSession();
    } catch (error) {
      await session.endSession();
      throw error;
    }

    logger.info(
      `Entire story unlocked for user ${userId}: ${totalScenesUnlocked} scenes unlocked for ${diamondsRequired} diamonds`
    );

    return res.status(200).json({
      success: true,
      data: {
        diamondsSpent: diamondsRequired,
        userDiamonds: user.diamonds,
        scenesUnlocked: totalScenesUnlocked,
        totalScenes: allScenes.length,
        chaptersUnlocked: chapters.length,
        message: `Successfully unlocked entire story with ${totalScenesUnlocked} scenes`
      }
    });

  } catch (error) {
    logger.error(`Error unlocking entire story: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const checkSceneAccess = async (req, res) => {
  try {
    const { userId, storyId, chapterId, sceneId } = req.params;

    if (!userId || !storyId || !chapterId) {
      logger.warn(`User ID, Story ID, and Chapter ID are required to check scene access for user ${userId} and story ${storyId} and chapter ${chapterId}`);
      return res.status(400).json({
        success: false,
        message: "User ID, Story ID, and Chapter ID are required"
      });
    }

    // Get total scenes in chapter
    const totalScenes = await Scene.countDocuments({ chapterId });

    // Get user progress
    let userProgress = await UserProgress.findOne({
      userId,
      storyId,
      chapterId
    });
    if (!userProgress) {
      logger.info(`User progress not found for user ${userId} and story ${storyId} and chapter ${chapterId}`);
      userProgress = {
        scenesRead: 0,
        unlockedScenesNumber: 0
      };
    } else {
      logger.info(`User progress found for user ${userId} and story ${storyId} and chapter ${chapterId}`);
      // Check and activate any scheduled time-based unlocks
      const activationResult =
        await UserProgress.checkAndActivateScheduledUnlocks(
          userId,
          storyId,
          chapterId
        );
      logger.info(`Activation result for user ${userId} and story ${storyId} and chapter ${chapterId}: ${activationResult.activatedCount}`);
      if (activationResult.activatedCount > 0) {
        logger.info(
          `Activated ${activationResult.activatedCount} scheduled unlocks for user ${userId}`
        );
        // Refresh userProgress after activation
        userProgress = await UserProgress.findOne({
          userId,
          storyId,
          chapterId
        });
        logger.info(`User progress found for user ${userId} and story ${storyId} and chapter ${chapterId}`);
      }
    }

    // Check if scene is unlocked
    const isUnlocked = await SceneUnlock.isSceneUnlocked(
      userId,
      storyId,
      chapterId,
      sceneId
    );
    logger.info(`Scene is unlocked for user ${userId} and story ${storyId} and chapter ${chapterId} and scene ${sceneId}: ${isUnlocked}`);
    // Get scene information if sceneId is provided
    let sceneInfo = null;
    let isFreeScene = false;
    if (sceneId) {
      sceneInfo = await Scene.findById(sceneId).select("sceneNumber title chapterId");
      const freeLimit = getFreeScenesLimitForStory(storyId);
      logger.info(`Free limit for story ${storyId}: ${freeLimit}`);
      isFreeScene = sceneInfo && sceneInfo.sceneNumber <= freeLimit;
    }

    // Get free scenes count
    const freeScenesUsed = await SceneUnlock.getFreeScenesCount(
      userId,
      storyId,
      chapterId
    );
    logger.info(`Free scenes used for user ${userId} and story ${storyId} and chapter ${chapterId}: ${freeScenesUsed}`);
    // Check if user can access free scenes (first two scenes)
    const canAccessFree = isFreeScene && !isUnlocked;
    logger.info(`User can access free scenes for user ${userId} and story ${storyId} and chapter ${chapterId}: ${canAccessFree}`);
    // Get next scenes available for unlocking
    const nextScenes = await SceneUnlock.getNextAvailableScenes(
      userId,
      storyId,
      chapterId
    );
    const canUnlockMultiple = nextScenes.length >= 2;
    const availableScenesCount = nextScenes.length;
    logger.info(`Available scenes count for user ${userId} and story ${storyId} and chapter ${chapterId}: ${availableScenesCount}`);

    // Check for any scheduled time-based unlocks
    const scheduledUnlocks = await UserProgress.getScheduledUnlocks(
      userId,
      storyId,
      chapterId
    );
    const nextScheduledUnlockTime =
      await UserProgress.getNextScheduledUnlockTime(userId, storyId, chapterId);
    logger.info(`Next scheduled unlock time for user ${userId} and story ${storyId} and chapter ${chapterId}: ${nextScheduledUnlockTime}`);
    const hasScheduledUnlocks = scheduledUnlocks.length > 0;
    const nextScheduledUnlock = hasScheduledUnlocks
      ? {
          scheduledUnlockTime: nextScheduledUnlockTime,
          timeRemaining: nextScheduledUnlockTime - new Date(),
          sceneCount: scheduledUnlocks.reduce(
            (total, unlock) => total + unlock.sceneIds.length,
            0
          )
        }
      : null;
    logger.info(`Next scheduled unlock for user ${userId} and story ${storyId} and chapter ${chapterId}: ${nextScheduledUnlock}`);
    return res.status(200).json({
      success: true,
      data: {
        isUnlocked,
        isFreeScene,
        freeScenesUsed,
        totalScenes,
        scenesRead: userProgress.scenesRead || 0,
        unlockedScenesNumber: userProgress.unlockedScenesNumber || 0,
        canAccessFree,
        canUnlockMultiple,
        availableScenesCount,
        nextTwoScenes: nextScenes.map((scene) => ({
          sceneId: scene?._id,
          sceneNumber: scene?.sceneNumber,
          title: scene?.title
        })),
        unlockCost: 10, // 10 diamonds for paid unlock (single or multiple)
        hasScheduledUnlocks,
        nextScheduledUnlock: nextScheduledUnlock
          ? {
              scheduledUnlockTime: nextScheduledUnlock.scheduledUnlockTime,
              timeRemaining:
                nextScheduledUnlock.scheduledUnlockTime - new Date()
            }
          : null,
        sceneInfo: sceneInfo
          ? {
              sceneId: sceneInfo._id,
              sceneNumber: sceneInfo.sceneNumber,
              title: sceneInfo.title
            }
          : null
      }
    });
  } catch (error) {
    logger.error(`Error checking scene access: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const initializeChapter = async (req, res) => {
  try {
    const { userId, storyId, chapterId } = req.body;

    if (!userId || !storyId || !chapterId) {
      logger.warn(`User ID, Story ID, and Chapter ID are required to initialize chapter for user ${userId} and story ${storyId} and chapter ${chapterId}`);
      return res.status(400).json({
        success: false,
        message: "User ID, Story ID, and Chapter ID are required"
      });
    }

    // Check if user exists
    const user = await User.findOne({ _id: userId, isDeleted: false });
    if (!user) {
      logger.warn(`User not found to initialize chapter for user ${userId} and story ${storyId} and chapter ${chapterId}`);
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user progress already exists
    let userProgress = await UserProgress.findOne({
      userId,
      storyId,
      chapterId
    });

    if (userProgress) {
      logger.info(`User progress found to initialize chapter for user ${userId} and story ${storyId} and chapter ${chapterId}`);
      
      const freeLimit = await getFreeScenesLimitForStory(storyId);
      logger.info(`Free scenes limit for story ${storyId}: ${freeLimit} scenes`);
      
      if (userProgress.unlockedScenesNumber < freeLimit) {
        // Get first N scenes based on per-story free limit
        const firstFreeScenes = await Scene.find({ chapterId })
          .sort({ sceneNumber: 1 })
          .limit(freeLimit);

        if (firstFreeScenes.length > 0) {
          const sceneUnlocks = await SceneUnlock.find({ userId, storyId, chapterId, isActive: true, unlockType: "FREE" });
          if (sceneUnlocks.length > 0) {
            // Update each unlock document with the new scene IDs
            for (const unlock of sceneUnlocks) {
              unlock.sceneIds = firstFreeScenes.map((scene) => scene?._id);
              await unlock.save();
            }
          }
          // Update unlockedScenesNumber to reflect actual number of scenes unlocked
          const previousUnlocked = userProgress.unlockedScenesNumber || 0;
          userProgress.unlockedScenesNumber = Math.max(previousUnlocked, firstFreeScenes.length);
          console.log("Previous unlocked scenes:", previousUnlocked);
          console.log("New unlocked scenes count:", userProgress.unlockedScenesNumber);
          
          await userProgress.save();
          
          logger.info(
            `Updated existing progress to unlock first ${firstFreeScenes.length} scenes. Previous: ${previousUnlocked}, New: ${userProgress.unlockedScenesNumber}`
          );
        }
      }

      return res.status(200).json({ userProgress });
    }

    // Get total scenes in chapter
    const totalScenes = await Scene.countDocuments({ chapterId });

    // Create user progress
    userProgress = new UserProgress({
      userId,
      storyId,
      chapterId,
      scenesRead: 0,
      totalScenes: totalScenes,
      isStarted: true,
      lastSceneUnlockTime: new Date(),
      unlockedScenesNumber:0
    });
    await userProgress.save();

    // Automatically unlock first N scenes for free (per-story limit)
    const freeLimit = await getFreeScenesLimitForStory(storyId);
    logger.info(`Free scenes limit for story ${storyId}: ${freeLimit} scenes`);
    
    const firstFreeScenes = await Scene.find({ chapterId })
      .sort({ sceneNumber: 1 })
      .limit(freeLimit);

    // Get current number of unlocked scenes
    const freeScenesUsed = await SceneUnlock.getFreeScenesCount(userId, storyId, chapterId);
    console.log("freeScenesUsed", freeScenesUsed);
    logger.info(`Current free scenes used: ${freeScenesUsed}`);

    let unlockedScenes = [];
    if (firstFreeScenes.length > 0) {
      const sceneIds = firstFreeScenes.map((scene) => scene?._id);

      // Create free unlock for first five scenes
      await SceneUnlock.createFreeUnlockMultiple(
        userId,
        storyId,
        chapterId,
        sceneIds
      );
      unlockedScenes = firstFreeScenes;
      logger.info(`Unlocked scenes for user ${userId} and story ${storyId} and chapter ${chapterId}`);
      
      // Update unlockedScenesNumber to reflect actual number of scenes unlocked
      const previousUnlocked = userProgress.unlockedScenesNumber || 0;
      console.log("freeLimit", freeLimit);
      console.log("firstFreeScenes.length", firstFreeScenes.length);
      console.log("previousUnlocked", previousUnlocked);
      userProgress.unlockedScenesNumber = Math.max(previousUnlocked, freeLimit);
      console.log("Previous unlocked scenes:", previousUnlocked);
      console.log("New unlocked scenes count:", userProgress.unlockedScenesNumber);
      
      await userProgress.save();    
      logger.info(
        `${firstFreeScenes.length} scene(s) unlocked for free for user ${userId} in chapter ${chapterId}. Previous: ${previousUnlocked}, New: ${userProgress.unlockedScenesNumber}`
      );
    }

    const userProgressDetails = await UserProgress.find({
      userId,
      storyId,
      chapterId
    });
    logger.debug(`User progress details for user ${userId} and story ${storyId} and chapter ${chapterId}: ${userProgressDetails}`);
    return res.status(200).json({ userProgress: userProgressDetails });
  } catch (error) {
    logger.error(`Error initializing chapter: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get total diamonds earned today across all reward systems
const getTotalDiamondsEarnedToday = async (req, res) => {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Daily Rewards - Check if user claimed today
    let dailyRewardsEarned = 0;
    const dailyRewards = await DailyRewards.findOne({ userId });
    if (dailyRewards && dailyRewards.lastClaimDate) {
      const lastClaimDate = new Date(dailyRewards.lastClaimDate);
      lastClaimDate.setHours(0, 0, 0, 0);
      
      if (lastClaimDate.getTime() === today.getTime()) {
        dailyRewardsEarned = dailyRewards.lastRewardAmount || 0;
      }
    }

    // 2. Time Tracking - Calculate diamonds from time spent today
    let timeTrackingEarned = 0;
    const totalTimeToday = await TimeTracking.getTotalTimeToday(userId);
    timeTrackingEarned = TimeTracking.calculateDiamondsFromTime(totalTimeToday);

    // 3. Weekly Streak - Check if user completed weekly streak today
    let weeklyStreakEarned = 0;
    const weeklyStreak = await WeeklyStreak.findOne({
      userId,
      weekStartDate: { $lte: today },
      weekEndDate: { $gt: today }
    });
    
    if (weeklyStreak && weeklyStreak.weeklyRewardClaimed && weeklyStreak.weeklyRewardClaimedAt) {
      const claimDate = new Date(weeklyStreak.weeklyRewardClaimedAt);
      claimDate.setHours(0, 0, 0, 0);
      
      if (claimDate.getTime() === today.getTime()) {
        weeklyStreakEarned = weeklyStreak.weeklyRewardAmount || 0;
      }
    }

    // 4. Story Completion Rewards - Check if user completed stories today
    let storyCompletionEarned = 0;
    const weeklyStreakForStories = await WeeklyStreak.findOne({
      userId,
      weekStartDate: { $lte: today },
      weekEndDate: { $gt: today }
    });
    
    if (weeklyStreakForStories && weeklyStreakForStories.completedStoriesThisWeek && weeklyStreakForStories.completedStoriesThisWeek.length > 0) {
      // Check if any stories were completed today
      const storiesCompletedToday = weeklyStreakForStories.completedStoriesThisWeek.filter(story => {
        const completedDate = new Date(story.completedAt);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate.getTime() === today.getTime();
      });
      
      // If stories were completed today, check if any milestone was reached
      if (storiesCompletedToday.length > 0) {
        // Calculate if any 5-story milestone was reached today
        const totalStoriesBeforeToday = weeklyStreakForStories.storiesCompletedThisWeek - storiesCompletedToday.length;
        const previousMilestone = Math.floor(totalStoriesBeforeToday / 5) * 5;
        const currentMilestone = Math.floor(weeklyStreakForStories.storiesCompletedThisWeek / 5) * 5;
        
        if (currentMilestone > previousMilestone) {
          storyCompletionEarned = 30; // 30 diamonds for completing 5 stories in a week
        }
      }
    }

    // Calculate total diamonds earned today
    const totalDiamondsEarnedToday = dailyRewardsEarned + timeTrackingEarned + weeklyStreakEarned + storyCompletionEarned;

    logger.info(`Total diamonds earned today for user ${userId}: ${totalDiamondsEarnedToday} (Daily: ${dailyRewardsEarned}, Time: ${timeTrackingEarned}, Weekly: ${weeklyStreakEarned}, Story: ${storyCompletionEarned})`);

    return res.status(200).json({
      success: true,
      data: {
        totalDiamondsEarnedToday,
        breakdown: {
          dailyRewards: {
            earned: dailyRewardsEarned,
            description: "Daily login rewards"
          },
          timeTracking: {
            earned: timeTrackingEarned,
            description: "Time spent in app (1 diamond per hour)"
          },
          weeklyStreak: {
            earned: weeklyStreakEarned,
            description: "Weekly streak completion rewards"
          },
          storyCompletion: {
            earned: storyCompletionEarned,
            description: "Story completion milestone rewards"
          }
        },
        date: today.toISOString().split('T')[0]
      }
    });
  } catch (error) {
    logger.error(`Error getting total diamonds earned today: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Daily Hourly Rewards Controller - Enhanced system that considers all sessions of the day
const getDailyHourlyRewardsStatus = async (req, res) => {
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

    // Get comprehensive daily hourly rewards status
    const dailyStats = await TimeTracking.getDailyHourlyRewardsStatus(userId);

    logger.info(
      `Daily hourly rewards status for user ${userId}: ${dailyStats.totalTimeInHours} hours, ${dailyStats.claimableDiamonds} claimable diamonds`
    );

    return res.status(200).json({
      success: true,
      data: {
        totalTimeSpent: dailyStats.totalTimeSpent,
        totalTimeInHours: dailyStats.totalTimeInHours,
        totalDiamondsEarned: dailyStats.totalDiamondsEarned,
        totalDiamondsClaimed: dailyStats.totalDiamondsClaimed,
        claimableDiamonds: dailyStats.claimableDiamonds,
        sessionsCount: dailyStats.sessionsCount,
        diamondsPerHour: dailyStats.diamondsPerHour,
        canClaim: dailyStats.canClaim,
        hasActiveSession: dailyStats.hasActiveSession,
        timeUntilNextDiamond: dailyStats.timeUntilNextDiamond,
        nextDiamondInMinutes: dailyStats.nextDiamondInMinutes,
        sessionDetails: dailyStats.sessionDetails,
        userDiamonds: user.diamonds
      }
    });
  } catch (error) {
    logger.error(`Error getting daily hourly rewards status: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const claimDailyHourlyRewards = async (req, res) => {
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

    // Claim daily hourly rewards across all sessions
    const claimResult = await TimeTracking.claimDailyHourlyRewards(userId);

    if (!claimResult.success) {
      return res.status(400).json({
        success: false,
        message: claimResult.message
      });
    }

    // Get updated user data
    const updatedUser = await User.findOne({ _id: userId, isDeleted: false });

    logger.info(
      `Daily hourly rewards claimed for user ${userId}: ${claimResult.diamondsClaimed} diamonds from ${claimResult.sessionsCount} sessions`
    );

    return res.status(200).json({
      success: true,
      data: {
        diamondsClaimed: claimResult.diamondsClaimed,
        totalDiamondsEarned: claimResult.totalDiamondsEarned,
        totalTimeSpent: claimResult.totalTimeSpent,
        sessionsCount: claimResult.sessionsCount,
        userDiamonds: updatedUser.diamonds,
        message: claimResult.message
      }
    });
  } catch (error) {
    logger.error(`Error claiming daily hourly rewards: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getDailyHourlyRewardsHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 7 } = req.query; // Default to 7 days

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

    const daysToFetch = Math.min(parseInt(days), 30); // Max 30 days
    const history = [];

    // Get daily stats for the specified number of days
    for (let i = 0; i < daysToFetch; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);

      const dailyStats = await TimeTracking.getDailyHourlyRewards(userId, date);
      
      history.push({
        date: date,
        totalTimeSpent: dailyStats.totalTime,
        totalTimeInHours: Math.round(dailyStats.totalTime / (1000 * 60 * 60) * 100) / 100,
        totalDiamondsEarned: dailyStats.totalDiamondsEarned,
        totalDiamondsClaimed: dailyStats.totalDiamondsClaimed,
        claimableDiamonds: dailyStats.claimableDiamonds,
        sessionsCount: dailyStats.sessionsCount
      });
    }

    logger.info(`Daily hourly rewards history fetched for user ${userId}: ${daysToFetch} days`);

    return res.status(200).json({
      success: true,
      data: {
        history: history,
        totalDays: daysToFetch,
        userDiamonds: user.diamonds
      }
    });
  } catch (error) {
    logger.error(`Error getting daily hourly rewards history: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getWeeklyHourlyRewardsStats = async (req, res) => {
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

    // Get weekly statistics
    const weeklyStats = await DailyHourlyRewards.getWeeklyStats(userId);

    logger.info(
      `Weekly hourly rewards stats for user ${userId}: ${weeklyStats.totalTimeInHours} hours, ${weeklyStats.totalDiamondsEarned} diamonds earned`
    );

    return res.status(200).json({
      success: true,
      data: {
        weekStart: weeklyStats.weekStart,
        weekEnd: weeklyStats.weekEnd,
        totalTimeSpent: weeklyStats.totalTimeSpent,
        totalTimeInHours: weeklyStats.totalTimeInHours,
        totalDiamondsEarned: weeklyStats.totalDiamondsEarned,
        totalDiamondsClaimed: weeklyStats.totalDiamondsClaimed,
        claimableDiamonds: weeklyStats.claimableDiamonds,
        totalSessions: weeklyStats.totalSessions,
        daysActive: weeklyStats.daysActive,
        averageTimePerDay: weeklyStats.daysActive > 0 ? Math.round(weeklyStats.totalTimeInHours / weeklyStats.daysActive * 100) / 100 : 0,
        averageDiamondsPerDay: weeklyStats.daysActive > 0 ? Math.round(weeklyStats.totalDiamondsEarned / weeklyStats.daysActive * 100) / 100 : 0,
        userDiamonds: user.diamonds
      }
    });
  } catch (error) {
    logger.error(`Error getting weekly hourly rewards stats: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Hourly Reward Notifications Controller - Simplified
const getHourlyRewardNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

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

    const notifications = await HourlyRewardNotification.getUnreadNotifications(userId, parseInt(limit));

    logger.info(`Retrieved ${notifications.length} notifications for user ${userId}`);

    return res.status(200).json({
      success: true,
      data: {
        notifications: notifications,
        totalCount: notifications.length,
        unreadCount: notifications.filter(n => !n.isRead).length
      }
    });
  } catch (error) {
    logger.error(`Error getting hourly reward notifications: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId, userId } = req.params;

    if (!notificationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID and User ID are required"
      });
    }

    const notification = await HourlyRewardNotification.findOne({
      _id: notificationId,
      userId
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    await notification.markAsRead();

    logger.info(`Notification ${notificationId} marked as read for user ${userId}`);

    return res.status(200).json({
      success: true,
      data: {
        notification: notification,
        message: "Notification marked as read"
      }
    });
  } catch (error) {
    logger.error(`Error marking notification as read: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  // Daily Rewards
  claimDailyReward,
  getDailyRewardStatus,

  // Time Tracking
  startTimeTracking,
  endTimeTracking,
  getTimeTrackingStats,
  getCurrentSessionProgress,
  claimSessionDiamonds,

  // Daily Hourly Rewards (Enhanced System)
  getDailyHourlyRewardsStatus,
  claimDailyHourlyRewards,
  getDailyHourlyRewardsHistory,
  getWeeklyHourlyRewardsStats,

  // Hourly Reward Notifications (Simplified)
  getHourlyRewardNotifications,
  markNotificationAsRead,

  // Scene Unlock
  unlockScene,
  unlockEntireStory,
  checkSceneAccess,
  initializeChapter,

  // Total Diamonds Earned Today
  getTotalDiamondsEarnedToday
};
