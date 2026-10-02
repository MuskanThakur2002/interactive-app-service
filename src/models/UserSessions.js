const { mongoose } = require("../utils/DatabaseUtils");

const UserSessionsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    deviceId: {
      type: String,
      required: true
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const UserSessions = mongoose.model("UserSessions", UserSessionsSchema);
module.exports = UserSessions;
