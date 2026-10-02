const { mongoose } = require("../utils/DatabaseUtils");

const ReferralSchema = new mongoose.Schema(
  {
    referrerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Main_User",
      required: true,
      index: true
    },
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Main_User",
      required: true,
      unique: true
    },
    referralUrl: {
      type: String,
      required: true
    },
    referredUserReward: {
      type: Number,
      default: 10
    },
    referrerReward: {
      type: Number,
      default: 5
    },
    referredUserRewardClaimed: {
      type: Boolean,
      default: false
    },
    referrerRewardClaimed: {
      type: Boolean,
      default: false
    },
    referredUserRewardClaimedAt: {
      type: Date,
      required: false
    },
    referrerRewardClaimedAt: {
      type: Date,
      required: false
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
ReferralSchema.index({ referrerUserId: 1, createdAt: -1 });
ReferralSchema.index({ referralUrl: 1 });

const Referral = mongoose.model("Referral", ReferralSchema);

module.exports = Referral;
