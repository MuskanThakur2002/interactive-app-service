const mongoose = require("../utils/db");

const UserSubSceneAttemptedSchema = new mongoose.Schema({
    subSceneId: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"Sub_scene_v2",
        required: true
      },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    completedAt: { type: Date, required: false }, 
});

const UserWorkFlowAttempted = mongoose.model('UserWorkFlowAttempted', UserSubSceneAttemptedSchema);

module.exports = UserWorkFlowAttempted;