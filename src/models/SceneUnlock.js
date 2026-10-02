const { mongoose } = require("../utils/DatabaseUtils");

const SceneUnlockSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
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
    sceneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scene_v2",
      required: false
    },
    sceneIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Scene_v2",
      required: false
    },
    unlockType: {
      type: String,
      enum: ["PAID", "TIME_BASED", "FREE"],
      required: true
    },
    diamondsSpent: {
      type: Number,
      default: 0
    },
    unlockTime: {
      type: Date,
      required: true
    },
    expiresAt: {
      type: Date,
      required: false
    },
    scheduledUnlockTime: {
      type: Date,
      required: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, storyId: 1, chapterId: 1 },
      { userId: 1, unlockType: 1 },
      { expiresAt: 1 },
      { unlockTime: -1 }
    ]
  }
);

// Static method to check if scene is unlocked for user
SceneUnlockSchema.statics.isSceneUnlocked = async function (
  userId,
  storyId,
  chapterId,
  sceneId = null
) {
  const query = {
    userId,
    storyId,
    chapterId,
    isActive: true
  };

  if (sceneId) {
    // Check both single sceneId and sceneIds array
    query.$or = [
      { sceneId: sceneId },
      { sceneIds: sceneId }
    ];
  }

  const unlock = await this.findOne(query);

  if (!unlock) {
    return false;
  }

  // Check if time-based unlock has expired
  if (unlock.expiresAt && new Date() > unlock.expiresAt) {
    unlock.isActive = false;
    await unlock.save();
    return false;
  }

  return true;
};

// Static method to check and activate scheduled time-based unlocks
SceneUnlockSchema.statics.checkAndActivateScheduledUnlocks = async function (
  userId,
  storyId,
  chapterId
) {
  const now = new Date();
  
  // Find scheduled unlocks that should be activated
  const scheduledUnlocks = await this.find({
    userId,
    storyId,
    chapterId,
    unlockType: "TIME_BASED",
    isActive: false,
    scheduledUnlockTime: { $lte: now }
  });

  let activatedCount = 0;
  for (const unlock of scheduledUnlocks) {
    unlock.isActive = true;
    await unlock.save();
    activatedCount += unlock.sceneIds ? unlock.sceneIds.length : 1;
  }

  return { activatedCount, activatedScenes: scheduledUnlocks };
};

// Static method to get scheduled unlock information
SceneUnlockSchema.statics.getScheduledUnlocks = async function (
  userId,
  storyId,
  chapterId
) {
  return await this.find({
    userId,
    storyId,
    chapterId,
    unlockType: "TIME_BASED",
    isActive: false,
    scheduledUnlockTime: { $exists: true }
  }).sort({ scheduledUnlockTime: 1 });
};

// Static method to get comprehensive scheduled unlock information
SceneUnlockSchema.statics.getScheduledUnlockSummary = async function (
  userId,
  storyId,
  chapterId
) {
  const scheduledUnlocks = await this.find({
    userId,
    storyId,
    chapterId,
    unlockType: "TIME_BASED",
    isActive: false,
    scheduledUnlockTime: { $exists: true }
  }).sort({ scheduledUnlockTime: 1 });

  if (scheduledUnlocks.length === 0) {
    return {
      hasScheduledUnlocks: false,
      totalScheduledScenes: 0,
      nextScheduledUnlockTime: null,
      scheduledUnlocks: []
    };
  }

  const totalScheduledScenes = scheduledUnlocks.reduce((total, unlock) => {
    return total + (unlock.sceneIds ? unlock.sceneIds.length : 1);
  }, 0);

  return {
    hasScheduledUnlocks: true,
    totalScheduledScenes,
    nextScheduledUnlockTime: scheduledUnlocks[0].scheduledUnlockTime,
    scheduledUnlocks: scheduledUnlocks.map(unlock => ({
      id: unlock._id,
      scheduledUnlockTime: unlock.scheduledUnlockTime,
      sceneCount: unlock.sceneIds ? unlock.sceneIds.length : 1,
      sceneIds: unlock.sceneIds || [unlock.sceneId]
    }))
  };
};

// Static method to get free scenes count for a chapter
SceneUnlockSchema.statics.getFreeScenesCount = async function (
  userId,
  storyId,
  chapterId
) {
  const freeUnlocks = await this.countDocuments({
    userId,
    storyId,
    chapterId,
    unlockType: "FREE",
    isActive: true
  });

  return freeUnlocks;
};

// Static method to create time-based unlock (24 hours)
SceneUnlockSchema.statics.createTimeBasedUnlock = async function (
  userId,
  storyId,
  chapterId,
  sceneId = null
) {
  const unlockTime = new Date();
  const expiresAt = new Date(unlockTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  return await this.create({
    userId,
    storyId,
    chapterId,
    sceneId,
    unlockType: "TIME_BASED",
    unlockTime,
    expiresAt,
    diamondsSpent: 0
  });
};

// Static method to create time-based unlock for next available scenes (24 hours delay, permanent unlock)
SceneUnlockSchema.statics.createTimeBasedUnlockNextScenes = async function (
  userId,
  storyId,
  chapterId
) {
  // Get next available scenes to unlock (up to 2)
  const nextScenes = await this.getNextAvailableScenes(userId, storyId, chapterId);
  
  if (nextScenes.length === 0) {
    throw new Error("No scenes available to unlock");
  }

  const unlockTime = new Date();
  const scheduledUnlockTime = new Date(unlockTime.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

  // If only one scene is available, use sceneId field
  if (nextScenes.length === 1) {
    return await this.create({
      userId,
      storyId,
      chapterId,
      sceneId: nextScenes[0]._id,
      unlockType: "TIME_BASED",
      unlockTime,
      scheduledUnlockTime, // When the scene will actually be unlocked
      diamondsSpent: 0,
      isActive: false // Initially inactive, will be activated after 24 hours
    });
  } else {
    // If multiple scenes are available, use sceneIds array
    const sceneIds = nextScenes.map(scene => scene._id);
    return await this.create({
      userId,
      storyId,
      chapterId,
      sceneIds,
      unlockType: "TIME_BASED",
      unlockTime,
      scheduledUnlockTime, // When the scenes will actually be unlocked
      diamondsSpent: 0,
      isActive: false // Initially inactive, will be activated after 24 hours
    });
  }
};

// Static method to create paid unlock for single scene
SceneUnlockSchema.statics.createPaidUnlock = async function (
  userId,
  storyId,
  chapterId,
  sceneId,
  diamondsSpent,
) {
  return await this.create({
    userId,
    storyId,
    chapterId,
    sceneId,
    unlockType: "PAID",
    unlockTime: new Date(),
    diamondsSpent,
  });
};

// Static method to create paid unlock for multiple scenes
SceneUnlockSchema.statics.createPaidUnlockMultiple = async function (
  userId,
  storyId,
  chapterId,
  sceneIds,
  diamondsSpent,
) {
  return await this.create({
    userId,
    storyId,
    chapterId,
    sceneIds,
    unlockType: "PAID",
    unlockTime: new Date(),
    diamondsSpent,
  });
};

// Static method to create free unlock for single scene
SceneUnlockSchema.statics.createFreeUnlock = async function (
  userId,
  storyId,
  chapterId,
  sceneId
) {
  return await this.create({
    userId,
    storyId,
    chapterId,
    sceneId,
    unlockType: "FREE",
    unlockTime: new Date(),
    diamondsSpent: 0
  });
};

// Static method to create free unlock for multiple scenes
SceneUnlockSchema.statics.createFreeUnlockMultiple = async function (
  userId,
  storyId,
  chapterId,
  sceneIds
) {
  return await this.create({
    userId,
    storyId,
    chapterId,
    sceneIds,
    unlockType: "FREE",
    unlockTime: new Date(),
    diamondsSpent: 0
  });
};

// Static method to get next available scenes to unlock (up to 2)
SceneUnlockSchema.statics.getNextAvailableScenes = async function (
  userId,
  storyId,
  chapterId
) {
  // Get all scenes in the chapter ordered by sceneNumber
  const Scene = require("./SceneV2");
  const allScenes = await Scene.find({ chapterId }).sort({ sceneNumber: 1 });
  
  // Get all unlocked scenes for this user and chapter
  const unlockedScenes = await this.find({
    userId,
    storyId,
    chapterId,
    isActive: true
  });
  
  // Create a set of unlocked scene IDs (both single and multiple)
  const unlockedSceneIds = new Set();
  unlockedScenes.forEach(unlock => {
    if (unlock.sceneId) {
      unlockedSceneIds.add(unlock.sceneId.toString());
    }
    if (unlock.sceneIds && unlock.sceneIds.length > 0) {
      unlock.sceneIds.forEach(id => unlockedSceneIds.add(id.toString()));
    }
  });
  
  // Find the next available scenes that are not unlocked (up to 2)
  const nextScenes = [];
  for (const scene of allScenes) {
    if (!unlockedSceneIds.has(scene._id.toString()) && nextScenes.length < 2) {
      nextScenes.push(scene);
    }
  }
  
  return nextScenes;
};

const SceneUnlock = mongoose.model("SceneUnlock", SceneUnlockSchema);

module.exports = SceneUnlock;
