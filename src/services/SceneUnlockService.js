const { mongoose } = require("../utils/DatabaseUtils");
const logger = require("../utils/logger");
const User = require("../models/User");
const Scene = require("../models/SceneV2");
const UserProgress = require("../models/UserProgressV2");
const SceneUnlock = require("../models/SceneUnlock");
const { getFreeScenesLimitForStory, canUnlockMoreScenes, SHARE_AND_UNLOCK_SCENES_LIMIT, NEXT_SCENES_UNLOCK_LIMIT } = require("../config/scenesConfig");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Core business logic for unlocking scenes.
 * Mirrors the behavior of monetizationController.unlockScene but without HTTP concerns.
 */
async function unlockScenes({
  userId,
  storyId,
  chapterId,
  unlockType,
  unlockMultiple = false,
  sceneId = null
}) {
  if (!userId || !storyId || !chapterId || !unlockType) {
    throw new HttpError(400, "User ID, Story ID, Chapter ID, and unlock type are required");
  }

  // Check if user exists
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  // Get or create user progress
  let userProgress = await UserProgress.findOne({
    userId,
    storyId,
    chapterId
  });

  // find the total scenes in the chapter
  const totalScenes = await Scene.countDocuments({ chapterId });

  if (!userProgress) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        userProgress = new UserProgress({
          userId,
          storyId,
          chapterId,
          scenesRead: 0,
          totalScenes: totalScenes,
          isStarted: true
        });
        await userProgress.save({ session });

        // Automatically unlock first N scenes for free when starting a new chapter
        const freeLimit = await getFreeScenesLimitForStory(storyId);
        logger.info(`Free scenes limit for story ${storyId}: ${freeLimit} scenes`);
        const firstFreeScenes = await Scene.find({ chapterId })
          .sort({ sceneNumber: 1 })
          .limit(freeLimit);

        if (firstFreeScenes.length > 0) {
          const sceneIds = firstFreeScenes.map((scene) => scene._id);
          await SceneUnlock.createFreeUnlockMultiple(
            userId,
            storyId,
            chapterId,
            sceneIds
          );
          userProgress.unlockedScenesNumber = firstFreeScenes.length;
          await userProgress.save({ session });
          logger.info(
            `${firstFreeScenes.length} scene(s) unlocked for free for user ${userId} in chapter ${chapterId}`
          );
        }
      });
    } finally {
      await session.endSession();
    }
  }

  let sceneUnlock;
  let diamondsSpent = 0;
  let unlockedScenes = [];

  // Check if we can unlock more scenes for this story
  const currentUnlockedCount = userProgress ? userProgress.unlockedScenesNumber || 0 : 0;
  const { canUnlock, remainingScenes } = await canUnlockMoreScenes(storyId, currentUnlockedCount);
  if (!canUnlock) {
    throw new HttpError(400, "Maximum scene unlock limit reached for this story");
  }
  
  // For non-infinite remaining scenes, limit the number of scenes that can be unlocked
  const maxScenesToUnlock = remainingScenes === Infinity ? NEXT_SCENES_UNLOCK_LIMIT : Math.min(NEXT_SCENES_UNLOCK_LIMIT, remainingScenes);

  if (unlockType === "PAID") {
    if (unlockMultiple) {
      diamondsSpent = 10; // cost for multiple unlock (four scenes)

      if (user.diamonds < diamondsSpent) {
        throw new HttpError(400, "Not enough diamonds");
      }

      const nextAvailableScenes = await SceneUnlock.getNextAvailableScenes(
        userId,
        storyId,
        chapterId,
        unlockType
      );

      if (nextAvailableScenes.length === 0) {
        throw new HttpError(400, "No scenes available to unlock");
      }

      // Limit scenes to unlock based on remaining scenes and NEXT_SCENES_UNLOCK_LIMIT
      const scenesToUnlock = nextAvailableScenes.slice(0, maxScenesToUnlock);
      
      // Adjust diamonds cost based on number of scenes being unlocked

      if (user.diamonds < diamondsSpent) {
        throw new HttpError(400, "Not enough diamonds");
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          if (scenesToUnlock.length === 1) {
            // If only one scene available
            const singleScene = scenesToUnlock[0];
            sceneUnlock = await SceneUnlock.createPaidUnlock(
              userId,
              storyId,
              chapterId,
              singleScene._id,
              diamondsSpent
            );
            unlockedScenes = [singleScene];
          } else {
            // For multiple scenes
            const sceneIds = scenesToUnlock.map((scene) => scene._id);
            sceneUnlock = await SceneUnlock.createPaidUnlockMultiple(
              userId,
              storyId,
              chapterId,
              sceneIds,
              diamondsSpent
            );
            unlockedScenes = scenesToUnlock;
          }
          user.diamonds -= diamondsSpent;
          await user.save({ session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Single scene unlock
      diamondsSpent = 5;
      if (!sceneId) {
        throw new HttpError(400, "sceneId is required for single PAID unlock");
      }
      if (user.diamonds < diamondsSpent) {
        throw new HttpError(400, "Not enough diamonds");
      }
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          sceneUnlock = await SceneUnlock.createPaidUnlock(
            userId,
            storyId,
            chapterId,
            sceneId,
            diamondsSpent
          );
          user.diamonds -= diamondsSpent;
          await user.save({ session });
        });
      } finally {
        await session.endSession();
      }
      unlockedScenes = [{ _id: sceneId }];
    }
  } else if (unlockType === "FREE") {
    if (!sceneId) {
      throw new HttpError(400, "sceneId is required for FREE unlock");
    }
    const scene = await Scene.findById(sceneId);
    if (!scene) {
      throw new HttpError(404, "Scene not found");
    }
    const freeLimit = await getFreeScenesLimitForStory(storyId);
    logger.info(`Free scenes limit for story ${storyId}: ${freeLimit} scenes`);
    if (scene.sceneNumber > freeLimit) {
      throw new HttpError(400, `Only the first ${freeLimit} scenes can be unlocked for free`);
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        sceneUnlock = await SceneUnlock.createFreeUnlock(
          userId,
          storyId,
          chapterId,
          sceneId
        );
      });
    } finally {
      await session.endSession();
    }
    unlockedScenes = [scene];
  } else if (unlockType === "SHARE_AND_UNLOCK") {
    // Share and unlock logic - scenes are unlocked when friend opens app
    
    // Get next available scenes to unlock (up to share limit)
    const nextScenes = await SceneUnlock.getNextAvailableScenes(
      userId,
      storyId,
      chapterId,
      unlockType
    );
    
    if (nextScenes.length === 0) {
      throw new HttpError(400, "No scenes available to unlock");
    }
    
    // Limit to share-and-unlock limit and remaining scenes
    const scenesToUnlock = nextScenes.slice(0, Math.min(SHARE_AND_UNLOCK_SCENES_LIMIT, maxScenesToUnlock));
    const sceneIds = scenesToUnlock.map(scene => scene._id);
    
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        sceneUnlock = await SceneUnlock.createPaidUnlockMultiple(
          userId,
          storyId,
          chapterId,
          sceneIds,
          0, // No diamonds spent for share-and-unlock
          unlockType // Pass the unlock type
        );
        unlockedScenes = scenesToUnlock;
      });
    } finally {
      await session.endSession();
    }
  } else if (unlockType === "TIME_BASED") {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        sceneUnlock = await SceneUnlock.createTimeBasedUnlockNextScenes(
          userId,
          storyId,
          chapterId
        );
        const nextScenes = await SceneUnlock.getNextAvailableScenes(
          userId,
          storyId,
          chapterId,
          unlockType
        );
        unlockedScenes = nextScenes;
        const sceneCount = unlockedScenes.length;
        const scheduledUnlockTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await UserProgress.addScheduledUnlock(
          userId,
          storyId,
          chapterId,
          sceneCount,
          scheduledUnlockTime
        );
      });
    } finally {
      await session.endSession();
    }
    logger.info(
      `Time-based unlock scheduled for user ${userId}: ${unlockedScenes.length} scene(s) will be unlocked in 24 hours`
    );
    try {
      const { scheduleEpisodeUnlockNotification } = require("../controllers/notificationsController");
      for (const scene of unlockedScenes) {
        const result = await scheduleEpisodeUnlockNotification(
          userId,
          storyId,
          chapterId,
          scene._id,
          "24h"
        );
        if (result.success) {
          logger.info(`Notification scheduled for scene ${scene._id}: ${result.scheduledFor}`);
        } else {
          logger.warn(`Failed to schedule notification for scene ${scene._id}: ${result.error}`);
        }
      }
      logger.info(`Scheduled notifications for ${unlockedScenes.length} scenes for user ${userId}`);
    } catch (notificationError) {
      logger.error(`Failed to schedule notifications for user ${userId}: ${notificationError.message}`);
    }
  } else if (unlockType === "LOGIN_BASED") {
    // Get next available scenes to unlock (up to configured limit)
    const nextScenes = await SceneUnlock.getNextAvailableScenes(
      userId,
      storyId,
      chapterId,
      unlockType
    );
    
    if (nextScenes.length === 0) {
      throw new HttpError(400, "No scenes available to unlock");
    }
    
    // Limit to next scenes unlock limit and remaining scenes
    const scenesToUnlock = nextScenes.slice(0, Math.min(NEXT_SCENES_UNLOCK_LIMIT, maxScenesToUnlock));
    const sceneIds = scenesToUnlock.map(scene => scene._id);
    
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        sceneUnlock = await SceneUnlock.createPaidUnlockMultiple(
          userId,
          storyId,
          chapterId,
          sceneIds,
          0, // No diamonds spent for login-based unlock
          unlockType // Pass the unlock type
        );
        unlockedScenes = scenesToUnlock;
      });
    } finally {
      await session.endSession();
    }
  } else {
    throw new HttpError(400, "Invalid unlock type");
  }

  // Update user progress atomically
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (unlockType === "PAID" || unlockType === "SHARE_AND_UNLOCK" || unlockType === "LOGIN_BASED") {
        logger.info(`Unlocking ${unlockedScenes.length} scenes for user ${userId}`);
        logger.info(`Existing unlocked scenes number: ${userProgress.unlockedScenesNumber}`);
        const scenesUnlocked = unlockedScenes.length;
        userProgress.unlockedScenesNumber += scenesUnlocked;
        logger.info(`New unlocked scenes number: ${userProgress.unlockedScenesNumber}`);
      }
      userProgress.lastSceneUnlockTime = new Date();
      await userProgress.save({ session });
    });
  } finally {
    await session.endSession();
  }

  logger.info(
    `Scene(s) unlocked for user ${userId}: ${unlockType} unlock, ${unlockedScenes.length} scenes`
  );

  return {
    sceneUnlock,
    diamondsSpent,
    userDiamonds: user.diamonds,
    expiresAt: sceneUnlock?.expiresAt,
    scheduledUnlockTime: sceneUnlock?.scheduledUnlockTime,
    unlockedScenes: unlockedScenes.map((scene) => ({
      sceneId: scene?._id,
      sceneNumber: scene?.sceneNumber,
      title: scene?.title
    })),
    scheduledUnlockInfo:
      unlockType === "TIME_BASED"
        ? {
            scheduledUnlockTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
            timeRemaining: 24 * 60 * 60 * 1000,
            sceneCount: unlockedScenes.length
          }
        : null
  };
}

/**
 * Create a share-and-unlock record (initially inactive)
 * This is called when user initiates share-and-unlock
 */
async function createShareAndUnlockRecord({
  userId,
  storyId,
  chapterId,
  shareToken
}) {
  if (!userId || !storyId || !chapterId || !shareToken) {
    throw new HttpError(400, "User ID, Story ID, Chapter ID, and share token are required");
  }

  // Check if user exists
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) {
    throw new HttpError(404, "User not found");
  }

  // Check if scenes are already unlocked via share-and-unlock
  const existingShareUnlock = await SceneUnlock.findOne({
    userId,
    storyId,
    chapterId,
    unlockType: "SHARE_AND_UNLOCK",
    isActive: true
  });

  if (existingShareUnlock) {
    throw new HttpError(400, "Scenes already unlocked via share-and-unlock");
  }

  // Check if there are scenes available to unlock
  const availableScenes = await SceneUnlock.getNextAvailableScenes(userId, storyId, chapterId, "SHARE_AND_UNLOCK");
  if (availableScenes.length === 0) {
    throw new HttpError(400, "No scenes available to unlock");
  }

  try {
    const sceneUnlock = await SceneUnlock.createShareAndUnlockRecord(
      userId,
      storyId,
      chapterId,
      shareToken
    );

    logger.info(
      `Share-and-unlock record created for user ${userId}: ${sceneUnlock.sceneIds.length} scenes pending friend activation`
    );

    return {
      sceneUnlock,
      shareToken,
      pendingScenes: sceneUnlock.sceneIds.length
    };
  } catch (error) {
    logger.error(`Failed to create share-and-unlock record: ${error.message}`);
    throw new HttpError(500, "Failed to create share-and-unlock record");
  }
}

/**
 * Activate share-and-unlock when friend opens app
 * This is called from anonymous login when friend opens app
 */
async function activateShareAndUnlock({
  shareToken,
  friendUserId
}) {
  if (!shareToken || !friendUserId) {
    throw new HttpError(400, "Share token and friend user ID are required");
  }

  try {
    const sceneUnlock = await SceneUnlock.activateShareAndUnlock(shareToken, friendUserId);
    
    if (!sceneUnlock) {
      return {
        success: false,
        message: "Invalid or expired share token"
      };
    }

    // Update user progress for the original user
    const userProgress = await UserProgress.findOne({
      userId: sceneUnlock.userId,
      storyId: sceneUnlock.storyId,
      chapterId: sceneUnlock.chapterId
    });

    if (userProgress) {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const scenesUnlocked = sceneUnlock.sceneIds.length;
          userProgress.unlockedScenesNumber += scenesUnlocked;
          userProgress.lastSceneUnlockTime = new Date();
          await userProgress.save({ session });
        });
      } finally {
        await session.endSession();
      }
    }

    logger.info(
      `Share-and-unlock activated for user ${sceneUnlock.userId}: ${sceneUnlock.sceneIds.length} scenes unlocked by friend ${friendUserId}`
    );

    return {
      success: true,
      sceneUnlock,
      unlockedScenes: sceneUnlock.sceneIds.length,
      originalUserId: sceneUnlock.userId
    };
  } catch (error) {
    logger.error(`Failed to activate share-and-unlock: ${error.message}`);
    throw new HttpError(500, "Failed to activate share-and-unlock");
  }
}

module.exports = {
  unlockScenes,
  createShareAndUnlockRecord,
  activateShareAndUnlock,
  HttpError
};


