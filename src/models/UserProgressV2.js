const { mongoose } = require("../utils/DatabaseUtils");

const characterSchema = new mongoose.Schema({
  characterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Character_v2",
    required: true
  },
  customName: {
    type: String,
    required: false
  },
  defaultOutfitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outfit_v2",
    required: false
  },
  currentOutfitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outfit_v2",
    required: false
  },
  defaultHairId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  currentHairId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  }
});

const UserProgressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story_v2",
      required: true
    },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chapter_v2",
      required: true
    },
    scenesRead: {
      type: Number,
      default: 0,
      required: true
    },
    totalScenes: {
      type: Number,
      default: 0,
      required: true
    },
    lastViewedSceneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scene_v2",
      required: false
    },
    chapterProgress: {
      type: Number,
      default: 0,
      required: true
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    protagonistIds: [characterSchema],
    loveInterestIds: [characterSchema],

    protagonist: {
      type: characterSchema,
      required: false
    },
    loveInterest:  {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character_v2",
      required: false
    },
    isStarted: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ['reviewer', 'user'],
      default: 'user',
      required: true
    },
    unlockedScenesNumber: {
      type: Number,
      default: 0
    },
    lastSceneUnlockTime: {
      type: Date,
      required: false
    },
    scheduledUnlocksCount: {
      type: Number,
      default: 0
    },
    nextScheduledUnlockTime: {
      type: Date,
      required: false
    },
  },

  {
    timestamps: true,
    indexes: [
      { userId: 1, storyId: 1, chapterId: 1 }, // Compound index for faster queries
      { userId: 1, unlockedScenesNumber: 1 },
    ]
  }
);

// Static method to add a scheduled unlock
UserProgressSchema.statics.addScheduledUnlock = async function(
  userId,
  storyId,
  chapterId,
  sceneCount,
  scheduledUnlockTime
) {
  const userProgress = await this.findOne({
    userId,
    storyId,
    chapterId
  });

  if (!userProgress) {
    throw new Error("User progress not found");
  }

  userProgress.scheduledUnlocksCount += sceneCount;
  
  // Update next scheduled unlock time if this is earlier or if no time is set
  if (!userProgress.nextScheduledUnlockTime || scheduledUnlockTime < userProgress.nextScheduledUnlockTime) {
    userProgress.nextScheduledUnlockTime = scheduledUnlockTime;
  }

  await userProgress.save();
  return userProgress;
};

// Static method to check and activate scheduled unlocks
UserProgressSchema.statics.checkAndActivateScheduledUnlocks = async function(
  userId,
  storyId,
  chapterId
) {
  const userProgress = await this.findOne({
    userId,
    storyId,
    chapterId
  });

  if (!userProgress) {
    return { activatedCount: 0, activatedScenes: [] };
  }

  const now = new Date();
  let activatedCount = 0;

  // Check if there are scheduled unlocks and if the time has come
  if (userProgress.scheduledUnlocksCount > 0 && 
      userProgress.nextScheduledUnlockTime && 
      userProgress.nextScheduledUnlockTime <= now) {
    
    // Get the actual scheduled unlocks from SceneUnlock model
    const SceneUnlock = require("./SceneUnlock");
    const scheduledUnlocks = await SceneUnlock.find({
      userId,
      storyId,
      chapterId,
      unlockType: "TIME_BASED",
      isActive: false,
      scheduledUnlockTime: { $lte: now }
    });

    // Activate all scheduled unlocks that are due
    for (const unlock of scheduledUnlocks) {
      unlock.isActive = true;
      await unlock.save();
      activatedCount += unlock.sceneIds ? unlock.sceneIds.length : 1;
    }

    // Update user progress
    if (activatedCount > 0) {
      userProgress.unlockedScenesNumber += activatedCount;
      
      // Update next scheduled unlock time
      const remainingScheduledUnlocks = await SceneUnlock.find({
        userId,
        storyId,
        chapterId,
        unlockType: "TIME_BASED",
        isActive: false,
        scheduledUnlockTime: { $exists: true }
      }).sort({ scheduledUnlockTime: 1 });

      // Update scheduled unlocks count to match actual remaining unlocks
      userProgress.scheduledUnlocksCount = remainingScheduledUnlocks.length;
      userProgress.nextScheduledUnlockTime = remainingScheduledUnlocks.length > 0 
        ? remainingScheduledUnlocks[0].scheduledUnlockTime 
        : null;

      await userProgress.save();
    }
  }

  return { activatedCount, activatedScenes: [] };
};

// Static method to get scheduled unlock information
UserProgressSchema.statics.getScheduledUnlocks = async function(
  userId,
  storyId,
  chapterId
) {
  const userProgress = await this.findOne({
    userId,
    storyId,
    chapterId
  });

  if (!userProgress) {
    return [];
  }

  // Get the actual scheduled unlocks from SceneUnlock model
  const SceneUnlock = require("./SceneUnlock");
  return await SceneUnlock.find({
    userId,
    storyId,
    chapterId,
    unlockType: "TIME_BASED",
    isActive: false,
    scheduledUnlockTime: { $exists: true }
  }).sort({ scheduledUnlockTime: 1 });
};

// Static method to get next scheduled unlock time
UserProgressSchema.statics.getNextScheduledUnlockTime = async function(
  userId,
  storyId,
  chapterId
) {
  const userProgress = await this.findOne({
    userId,
    storyId,
    chapterId
  });

  if (!userProgress) {
    return null;
  }

  return userProgress.nextScheduledUnlockTime;
};

// Static method to get all scheduled scene IDs
UserProgressSchema.statics.getScheduledSceneIds = async function(
  userId,
  storyId,
  chapterId
) {
  const scheduledUnlocks = await this.getScheduledUnlocks(userId, storyId, chapterId);
  
  const sceneIds = [];
  scheduledUnlocks.forEach(unlock => {
    if (unlock.sceneIds && unlock.sceneIds.length > 0) {
      sceneIds.push(...unlock.sceneIds);
    } else if (unlock.sceneId) {
      sceneIds.push(unlock.sceneId);
    }
  });

  return sceneIds;
};

// Static method to get comprehensive scheduled unlock information
UserProgressSchema.statics.getScheduledUnlockInfo = async function(
  userId,
  storyId,
  chapterId
) {
  const userProgress = await this.findOne({
    userId,
    storyId,
    chapterId
  });

  if (!userProgress) {
    return {
      hasScheduledUnlocks: false,
      scheduledUnlocksCount: 0,
      nextScheduledUnlockTime: null,
      nextScheduledUnlock: null
    };
  }

  const scheduledUnlocks = await this.getScheduledUnlocks(userId, storyId, chapterId);
  const hasScheduledUnlocks = scheduledUnlocks.length > 0;
  
  let nextScheduledUnlock = null;
  if (hasScheduledUnlocks) {
    const totalSceneCount = scheduledUnlocks.reduce((total, unlock) => {
      return total + (unlock.sceneIds ? unlock.sceneIds.length : 1);
    }, 0);
    
    nextScheduledUnlock = {
      scheduledUnlockTime: userProgress.nextScheduledUnlockTime,
      timeRemaining: userProgress.nextScheduledUnlockTime - new Date(),
      sceneCount: totalSceneCount
    };
  }

  return {
    hasScheduledUnlocks,
    scheduledUnlocksCount: userProgress.scheduledUnlocksCount,
    nextScheduledUnlockTime: userProgress.nextScheduledUnlockTime,
    nextScheduledUnlock
  };
};

const UserProgress = mongoose.model("userprogresses", UserProgressSchema);

module.exports = UserProgress;
