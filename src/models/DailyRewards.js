const { mongoose } = require("../utils/DatabaseUtils");

const DailyRewardsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    lastClaimDate: {
      type: Date,
      required: true
    },
    totalDaysClaimed: {
      type: Number,
      default: 0
    },
    lastRewardAmount: {
      type: Number,
      default: 0
    },
    missedDays: {
      type: Number,
      default: 0
    },
    missedDates: [{
      type: Date
    }],
    totalLoginDays: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    indexes: [
      { userId: 1, lastClaimDate: -1 },
      { userId: 1, totalDaysClaimed: -1 }
    ]
  }
);

// Static method to calculate reward amount based on total days claimed
DailyRewardsSchema.statics.calculateReward = function (totalDaysClaimed) {
  // Simple reward structure: 2 diamonds per day
  return 2;
};

// Instance method to check if user can claim today's reward
DailyRewardsSchema.methods.canClaimToday = function () {
  const today = new Date();
  const lastClaim = new Date(this.lastClaimDate);

  // Reset to start of day for comparison
  today.setHours(0, 0, 0, 0);
  lastClaim.setHours(0, 0, 0, 0);

  return today.getTime() > lastClaim.getTime();
};

// Instance method to check if user missed a day
DailyRewardsSchema.methods.hasMissedDay = function () {
  const today = new Date();
  const lastClaim = new Date(this.lastClaimDate);

  // Reset to start of day for comparison
  today.setHours(0, 0, 0, 0);
  lastClaim.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor(
    (today.getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysDiff > 1;
};

// Instance method to get missed dates between last claim and today
DailyRewardsSchema.methods.getMissedDates = function () {
  const today = new Date();
  const lastClaim = new Date(this.lastClaimDate);
  
  // Reset to start of day for comparison
  today.setHours(0, 0, 0, 0);
  lastClaim.setHours(0, 0, 0, 0);
  
  const missedDates = [];
  const currentDate = new Date(lastClaim);
  currentDate.setDate(currentDate.getDate() + 1); // Start from day after last claim
  
  while (currentDate < today) {
    missedDates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return missedDates;
};

// Instance method to calculate total days since start
DailyRewardsSchema.methods.getTotalDaysSinceStart = function () {
  const today = new Date();
  const startDate = new Date(this.startDate);
  
  // Reset to start of day for comparison
  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);
  
  const daysDiff = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysDiff + 1; // Include start day
};

// Instance method to update missed days tracking
DailyRewardsSchema.methods.updateMissedDaysTracking = function () {
  if (this.hasMissedDay()) {
    const newMissedDates = this.getMissedDates();
    
    // Add new missed dates to the array
    newMissedDates.forEach(date => {
      const dateStr = date.toISOString().split('T')[0];
      const exists = this.missedDates.some(existingDate => 
        existingDate.toISOString().split('T')[0] === dateStr
      );
      if (!exists) {
        this.missedDates.push(date);
      }
    });
    
    this.missedDays = this.missedDates.length;
  }
};

const DailyRewards = mongoose.model("DailyRewards", DailyRewardsSchema);

module.exports = DailyRewards;

