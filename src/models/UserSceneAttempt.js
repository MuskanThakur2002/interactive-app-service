const mongoose = require("../utils/db");

const UserSceneAttemptedSchema = new mongoose.Schema({
    sceneId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Scene_V2",
        required: true
      },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    progress: {type: Number, default:0},
    completedAt: { type: Date, required: false },
});

const UserSceneAttempted = mongoose.model('UserSceneAttempted', UserSceneAttemptedSchema);

module.exports = UserSceneAttempted;