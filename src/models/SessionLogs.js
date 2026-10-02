const { mongoose } = require("../utils/DatabaseUtils");

const SessionLogsSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Moment", "Story", "UGC"],
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
      required: false
    },
    sceneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Scene_v2",
      required: false
    },
    sceneNumber: {
      type: Number,
      required: false
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSessions",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const SessionLogs = mongoose.model("SessionLogs", SessionLogsSchema);
module.exports = SessionLogs;




