const { mongoose } = require("../utils/DatabaseUtils");

const StoryCompletionRewardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    totalStoriesCompleted: {
      type: Number,
      default: 0,
      required: true
    },
    lastRewardClaimedAt: {
      type: Number,
      default: 0,
      required: true
    },
    totalRewardsClaimed: {
      type: Number,
      default: 0,
      required: true
    },
    lastRewardAmount: {
      type: Number,
      default: 0
    },
    readyToClaim: {
      type: Boolean,
      default: false,
      required: true
    },
    completedStories: [{
      storyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story_v2",
        required: true
      },
      completedAt: {
        type: Date,
        required: true
      },
      storyTitle: {
        type: String,
        required: false
      }
    }],
    nextRewardThreshold: {
      type: Number,
      default: 5,
      required: true
    }
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, totalStoriesCompleted: -1 },
      { userId: 1, totalRewardsClaimed: -1 },
      { userId: 1, readyToClaim: -1 }
    ]
  }
);

// Static method to calculate reward amount
StoryCompletionRewardSchema.statics.calculateReward = function () {
  // Reward for completing 5 stories
  return 30; // 30 diamonds for every 5 story completions
};

// Instance method to check if user can claim reward
StoryCompletionRewardSchema.methods.canClaimReward = function () {
  return this.readyToClaim && this.totalStoriesCompleted >= this.nextRewardThreshold;
};

// Instance method to claim reward
StoryCompletionRewardSchema.methods.claimReward = function () {
  if (this.canClaimReward()) {
    const rewardAmount = StoryCompletionReward.calculateReward();
    this.lastRewardAmount = rewardAmount;
    this.lastRewardClaimedAt = this.totalStoriesCompleted;
    this.totalRewardsClaimed += 1;
    this.nextRewardThreshold += 5; // Next reward at 10, 15, 20, etc.
    this.readyToClaim = false; // Reset ready to claim flag
    return rewardAmount;
  }
  return 0;
};

// Instance method to add completed story
StoryCompletionRewardSchema.methods.addCompletedStory = function (storyId, storyTitle = null) {
  // Check if story is already in completed list
  const existingStory = this.completedStories.find(
    story => story.storyId.toString() === storyId.toString()
  );
  
  if (!existingStory) {
    this.completedStories.push({
      storyId,
      completedAt: new Date(),
      storyTitle
    });
    this.totalStoriesCompleted += 1;
    
    // Check if reward threshold is reached
    if (this.totalStoriesCompleted >= this.nextRewardThreshold && !this.readyToClaim) {
      this.readyToClaim = true;
    }
    
    return true;
  }
  return false;
};

// Instance method to get progress to next reward
StoryCompletionRewardSchema.methods.getProgressToNextReward = function () {
  const progress = this.totalStoriesCompleted - this.lastRewardClaimedAt;
  const remaining = this.nextRewardThreshold - this.totalStoriesCompleted;
  
  return {
    completed: progress,
    remaining: Math.max(0, remaining),
    total: 5,
    percentage: Math.min(100, (progress / 5) * 100)
  };
};

// Instance method to get completion statistics
StoryCompletionRewardSchema.methods.getStatistics = function () {
  return {
    totalStoriesCompleted: this.totalStoriesCompleted,
    totalRewardsClaimed: this.totalRewardsClaimed,
    nextRewardThreshold: this.nextRewardThreshold,
    canClaimReward: this.canClaimReward(),
    readyToClaim: this.readyToClaim,
    progress: this.getProgressToNextReward(),
    lastRewardAmount: this.lastRewardAmount
  };
};

const StoryCompletionReward = mongoose.model("StoryCompletionReward", StoryCompletionRewardSchema);

module.exports = StoryCompletionReward; 