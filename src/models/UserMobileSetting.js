const { mongoose } = require("../utils/DatabaseUtils");

const UserMobileSettingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    audio: {
      type: Boolean,
      default: true
    },
    notification: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

const UserMobileSetting = mongoose.model("user_mobile_settings", UserMobileSettingSchema);

module.exports = UserMobileSetting;

