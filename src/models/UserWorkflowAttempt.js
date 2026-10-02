const mongoose = require("../utils/db");

const UserWorkFlowAttemptedSchema = new mongoose.Schema({
  sceneId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Scene_V2",
    required: true
  },
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  choiceSelected: { type: "String", required: false },
  completedAt: { type: Date, required: false }
});

const UserWorkFlowAttempted = mongoose.model(
  "UserWorkFlowAttempted",
  UserWorkFlowAttemptedSchema
);

module.exports = UserWorkFlowAttempted;
