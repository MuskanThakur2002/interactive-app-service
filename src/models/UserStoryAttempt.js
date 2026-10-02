const mongoose = require("../utils/db");

const UserStoryAttemptedSchema = new mongoose.Schema({
    storyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Story_V2",
        required: true
      },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    characterName:{ type: String, required: true },
    startedAt: { type: Date, default: Date.now },
    progress: { type: Number, default: 0 },
    completedAt: { type: Date, required: false },
});

const UserStoryAttempted = mongoose.model('UserStoryAttempted', UserStoryAttemptedSchema);

module.exports = UserStoryAttempted;