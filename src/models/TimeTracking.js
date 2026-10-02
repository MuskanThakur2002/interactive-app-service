const { mongoose } = require("../utils/DatabaseUtils");

const TimeTrackingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    deviceId: {
      type: String,
      required: false
    },
    sessionStartTime: {
      type: Date,
      required: true
    },
    sessionEndTime: {
      type: Date,
      required: false
    },
    totalSessionTime: {
      type: Number, 
      default: 0
    },
    diamondsEarned: {
      type: Number,
      default: 0
    },
    diamondsClaimed: {
      type: Number,
      default: 0
    },
    lastClaimTime: {
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
      { userId: 1, sessionStartTime: -1 },
      { userId: 1, isActive: 1 },
      { sessionStartTime: 1, sessionEndTime: 1 }
    ]
  }
);

// Static method to calculate diamonds earned from time spent
TimeTrackingSchema.statics.calculateDiamondsFromTime = function (
  timeInMilliseconds
) {
  const timeInHours = timeInMilliseconds / (1000 * 60 * 60);
  // 1 diamond per hour spent
  return Math.floor(timeInHours);
};

// Instance method to get current claimable diamonds
TimeTrackingSchema.methods.getClaimableDiamonds = function () {
  if (!this.isActive) {
    return { canClaim: false, diamondsToClaim: 0, message: "No active session" };
  }

  const currentTime = new Date();
  const currentSessionTime = currentTime.getTime() - this.sessionStartTime.getTime();
  const totalDiamondsEarned = this.constructor.calculateDiamondsFromTime(currentSessionTime);
  const diamondsToClaim = totalDiamondsEarned - this.diamondsClaimed;

  return { 
    canClaim: diamondsToClaim > 0, 
    diamondsToClaim: diamondsToClaim, 
    totalDiamondsEarned: totalDiamondsEarned,
    diamondsClaimed: this.diamondsClaimed,
    currentSessionTime: currentSessionTime,
    message: diamondsToClaim > 0 ? `${diamondsToClaim} diamonds available to claim` : "No diamonds available to claim yet"
  };
};

// Instance method to claim diamonds during active session
TimeTrackingSchema.methods.claimDiamonds = function () {
  if (!this.isActive) {
    return { canClaim: false, diamondsToClaim: 0, message: "No active session" };
  }

  const currentTime = new Date();
  const currentSessionTime = currentTime.getTime() - this.sessionStartTime.getTime();
  const totalDiamondsEarned = this.constructor.calculateDiamondsFromTime(currentSessionTime);
  const diamondsToClaim = totalDiamondsEarned - this.diamondsClaimed;

  if (diamondsToClaim <= 0) {
    return { 
      canClaim: false, 
      diamondsToClaim: 0, 
      message: "No diamonds available to claim yet" 
    };
  }

  // Update claimed diamonds
  this.diamondsClaimed = totalDiamondsEarned;
  this.lastClaimTime = currentTime;
  this.totalSessionTime = currentSessionTime;

  return { 
    canClaim: true, 
    diamondsToClaim: diamondsToClaim, 
    message: "Diamonds claimed successfully" 
  };
};

// Instance method to end session and calculate final rewards
TimeTrackingSchema.methods.endSession = function () {
  if (!this.isActive) {
    return false;
  }

  this.sessionEndTime = new Date();
  this.totalSessionTime =
    this.sessionEndTime.getTime() - this.sessionStartTime.getTime();
  this.diamondsEarned = this.constructor.calculateDiamondsFromTime(
    this.totalSessionTime
  );
  this.isActive = false;

  return this.diamondsEarned;
};

// Static method to get total time spent today
TimeTrackingSchema.statics.getTotalTimeToday = async function (userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sessions = await this.find({
    userId,
    sessionStartTime: { $gte: today, $lt: tomorrow }
  });

  return sessions.reduce((total, session) => {
    if (session.sessionEndTime) {
      return total + session.totalSessionTime;
    } else {
      // For active sessions, calculate time until now
      const currentTime = new Date().getTime();
      return total + (currentTime - session.sessionStartTime.getTime());
    }
  }, 0);
};

const TimeTracking = mongoose.model("TimeTracking", TimeTrackingSchema);

module.exports = TimeTracking;
