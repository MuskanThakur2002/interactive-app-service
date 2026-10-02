const { mongoose } = require("../utils/DatabaseUtils");

const WeeklyStreakSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    weekStartDate: {
      type: Date,
      required: true,
      index: true
    },
    weekEndDate: {
      type: Date,
      required: true
    },
    daysLoggedIn: {
      type: Number,
      default: 0
    },
    totalDaysInWeek: {
      type: Number,
      default: 7
    },
    weeklyStreakCompleted: {
      type: Boolean,
      default: false
    },
    weeklyRewardClaimed: {
      type: Boolean,
      default: false
    },
    weeklyRewardAmount: {
      type: Number,
      default: 0
    },
    weeklyRewardClaimedAt: {
      type: Date
    },
    // Track weekdays with boolean values
    weekdays: {
      monday: {
        type: Boolean,
        default: false
      },
      tuesday: {
        type: Boolean,
        default: false
      },
      wednesday: {
        type: Boolean,
        default: false
      },
      thursday: {
        type: Boolean,
        default: false
      },
      friday: {
        type: Boolean,
        default: false
      },
      saturday: {
        type: Boolean,
        default: false
      },
      sunday: {
        type: Boolean,
        default: false
      }
    },
    // Track last login date for reference
    lastLoginDate: {
      type: Date
    },
    // Weekly Story Completion Reward fields
    storiesCompletedThisWeek: {
      type: Number,
      default: 0
    },
    weeklyStoryRewardClaimed: {
      type: Boolean,
      default: false
    },
    weeklyStoryRewardAmount: {
      type: Number,
      default: 0
    },
    weeklyStoryRewardReady: {
      type: Boolean,
      default: false
    },
    weeklyStoryRewardClaimedAt: {
      type: Date
    },
    completedStoriesThisWeek: [{
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
    }]
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, weekStartDate: -1 },
      { userId: 1, weeklyStreakCompleted: 1 },
      { userId: 1, daysLoggedIn: -1 }
    ]
  }
);

// Pre-save middleware to ensure dates are set correctly
WeeklyStreakSchema.pre('save', function(next) {
  // Ensure weekStartDate is set to midnight UTC
  if (this.weekStartDate) {
    const weekStart = new Date(this.weekStartDate);
    weekStart.setHours(0, 0, 0, 0);
    this.weekStartDate = weekStart;
  }
  
  // Ensure weekEndDate is set to end of day UTC
  if (this.weekEndDate) {
    const weekEnd = new Date(this.weekEndDate);
    weekEnd.setHours(23, 59, 59, 999);
    this.weekEndDate = weekEnd;
  }
  
  // Ensure lastLoginDate is set to midnight UTC
  if (this.lastLoginDate) {
    const lastLogin = new Date(this.lastLoginDate);
    lastLogin.setHours(0, 0, 0, 0);
    this.lastLoginDate = lastLogin;
  }
  
  // Ensure all completed story dates are set to midnight UTC
  if (this.completedStoriesThisWeek && this.completedStoriesThisWeek.length > 0) {
    this.completedStoriesThisWeek = this.completedStoriesThisWeek.map(story => {
      if (story.completedAt) {
        const newDate = new Date(story.completedAt);
        newDate.setHours(0, 0, 0, 0);
        return {
          ...story,
          completedAt: newDate
        };
      }
      return story;
    });
  }
  
  next();
});

// Static method to get week start date (Monday) for a given date
WeeklyStreakSchema.statics.getWeekStartDate = function (date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

// Static method to get week end date (Sunday) for a given date
WeeklyStreakSchema.statics.getWeekEndDate = function (date) {
  const weekStart = this.getWeekStartDate(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
};

// Static method to get weekday name from date
WeeklyStreakSchema.statics.getWeekdayName = function (date) {
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return weekdays[new Date(date).getDay()];
};

// Instance method to check if a date falls within this week
WeeklyStreakSchema.methods.isDateInWeek = function (date) {
  const checkDate = new Date(date);
  const weekStart = new Date(this.weekStartDate);
  const weekEnd = new Date(this.weekEndDate);
  
  return checkDate >= weekStart && checkDate <= weekEnd;
};

// Instance method to mark user as logged in for a specific day
WeeklyStreakSchema.methods.markDayLoggedIn = function (date) {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  // Check if date is in current week
  if (!this.isDateInWeek(checkDate)) {
    return false; // Not in current week
  }

  // Get weekday name
  const weekdayName = WeeklyStreakSchema.statics.getWeekdayName(checkDate);
  
  // Check if user already logged in on this weekday
  if (this.weekdays[weekdayName]) {
    return false; // Already logged in on this weekday
  }

  // Mark weekday as logged in
  this.weekdays[weekdayName] = true;
  this.lastLoginDate = new Date(checkDate);
  this.daysLoggedIn += 1;
  
  // Check if week is complete (all 7 days logged in)
  const loggedInDays = Object.values(this.weekdays).filter(day => day === true).length;
  if (loggedInDays >= this.totalDaysInWeek) {
    this.weeklyStreakCompleted = true;
    
    // Automatically assign reward amount when week is completed
    if (!this.weeklyRewardClaimed) {
      this.weeklyRewardAmount = this.calculateWeeklyReward();
    }
  }
  
  return true;
};

// Instance method to initialize weekdays for the week
WeeklyStreakSchema.methods.initializeWeekdays = function () {
  this.lastLoginDate = null;
  this.weekdays = {
    monday: false,
    tuesday: false,
    wednesday: false,
    thursday: false,
    friday: false,
    saturday: false,
    sunday: false
  };
  this.daysLoggedIn = 0;
  // Reset weekly story completion tracking for new week
  this.storiesCompletedThisWeek = 0;
  this.weeklyStoryRewardClaimed = false;
  this.weeklyStoryRewardAmount = 0;
  this.weeklyStoryRewardReady = false;
  this.weeklyStoryRewardClaimedAt = null;
  this.completedStoriesThisWeek = [];
};

// Instance method to claim weekly reward
WeeklyStreakSchema.methods.claimWeeklyReward = function () {
  if (this.weeklyStreakCompleted && !this.weeklyRewardClaimed) {
    // Use already assigned reward amount or calculate if not set
    const rewardAmount = this.weeklyRewardAmount || this.calculateWeeklyReward();
    this.weeklyRewardClaimed = true;
    this.weeklyRewardAmount = rewardAmount;
    this.weeklyRewardClaimedAt = new Date();
    return rewardAmount;
  }
  return 0;
};

// Instance method to calculate weekly reward amount
WeeklyStreakSchema.methods.calculateWeeklyReward = function () {
  return 5; // 5 diamonds for completing weekly streak
};

// Instance method to add completed story for the week
WeeklyStreakSchema.methods.addCompletedStory = function (storyId, storyTitle = null) {
  // Check if story is already completed this week
  const existingStory = this.completedStoriesThisWeek.find(
    story => story.storyId.toString() === storyId.toString()
  );
  
  if (!existingStory) {
    this.completedStoriesThisWeek.push({
      storyId,
      completedAt: new Date(),
      storyTitle
    });
    this.storiesCompletedThisWeek += 1;
    
    // Automatically assign story reward amount when 5 stories are completed
    if (this.storiesCompletedThisWeek >= 5 && !this.weeklyStoryRewardClaimed) {
      this.weeklyStoryRewardAmount = this.calculateWeeklyStoryReward();
    }
    
    // Set reward ready flag when 5 stories are completed
    if (this.storiesCompletedThisWeek >= 5 && !this.weeklyStoryRewardClaimed) {
      this.weeklyStoryRewardReady = true;
    }
    
    return true;
  }
  return false;
};

// Instance method to claim weekly story completion reward
WeeklyStreakSchema.methods.claimWeeklyStoryReward = function () {
  if (this.storiesCompletedThisWeek >= 5 && !this.weeklyStoryRewardClaimed) {
    const rewardAmount = this.calculateWeeklyStoryReward();
    this.weeklyStoryRewardClaimed = true;
    this.weeklyStoryRewardAmount = rewardAmount;
    this.weeklyStoryRewardReady = false; // Reset ready flag when claimed
    this.weeklyStoryRewardClaimedAt = new Date();
    return rewardAmount;
  }
  return 0;
};

// Instance method to calculate weekly story completion reward amount
WeeklyStreakSchema.methods.calculateWeeklyStoryReward = function () {
  return 30; // 30 diamonds for completing 5 stories in a week
};

// Instance method to check if user can claim weekly story reward
WeeklyStreakSchema.methods.canClaimWeeklyStoryReward = function () {
  return this.storiesCompletedThisWeek >= 5 && !this.weeklyStoryRewardClaimed;
};

// Instance method to get progress percentage
WeeklyStreakSchema.methods.getProgressPercentage = function () {
  return Math.round((this.daysLoggedIn / this.totalDaysInWeek) * 100);
};

// Instance method to check if user can claim weekly reward
WeeklyStreakSchema.methods.canClaimWeeklyReward = function () {
  return this.weeklyStreakCompleted && !this.weeklyRewardClaimed;
};

// Instance method to get story completion progress percentage
WeeklyStreakSchema.methods.getStoryProgressPercentage = function () {
  return Math.round((this.storiesCompletedThisWeek / 5) * 100);
};

// Instance method to get missed weekdays
WeeklyStreakSchema.methods.getMissedWeekdays = function () {
  const currentDate = new Date();
  const weekStart = new Date(this.weekStartDate);
  
  const missedDays = [];
  const weekdayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  // Only check days that have passed
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(weekStart);
    checkDate.setDate(checkDate.getDate() + i);
    
    if (checkDate < currentDate) {
      const weekdayName = weekdayNames[i];
      if (!this.weekdays[weekdayName]) {
        missedDays.push(weekdayName);
      }
    }
  }
  
  return missedDays;
};

// Instance method to get week summary
WeeklyStreakSchema.methods.getWeekSummary = function () {
  return {
    weekStartDate: this.weekStartDate,
    weekEndDate: this.weekEndDate,
    weekdays: this.weekdays,
    daysLoggedIn: this.daysLoggedIn,
    totalDaysInWeek: this.totalDaysInWeek,
    progressPercentage: this.getProgressPercentage(),
    weeklyStreakCompleted: this.weeklyStreakCompleted,
    canClaimWeeklyReward: this.canClaimWeeklyReward(),
    lastLoginDate: this.lastLoginDate,
    missedWeekdays: this.getMissedWeekdays(),
    // Weekly Story Completion Reward information
    storiesCompletedThisWeek: this.storiesCompletedThisWeek,
    storyProgressPercentage: this.getStoryProgressPercentage(),
    canClaimWeeklyStoryReward: this.canClaimWeeklyStoryReward(),
    weeklyStoryRewardClaimed: this.weeklyStoryRewardClaimed,
    weeklyStoryRewardReady: this.weeklyStoryRewardReady,
    completedStoriesThisWeek: this.completedStoriesThisWeek
  };
};

const WeeklyStreak = mongoose.model("WeeklyStreak", WeeklyStreakSchema);

module.exports = WeeklyStreak; 