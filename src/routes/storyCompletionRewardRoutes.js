const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  checkStoryCompletion,
  claimStoryCompletionReward,
  getStoryCompletionStatistics,
  getStoryCompletionHistory,
  checkRewardStatus
} = require("../controllers/storyCompletionRewardController");

// Check story completion status
router.post("/story-completion/check-completion/:userId/:storyId",  checkStoryCompletion);

// Check reward status (simple check)
router.get("/story-completion/reward-status/:userId",  checkRewardStatus);

// Claim story completion reward (now requires weeklyStreakId)
router.post("/story-completion/claim-reward/:userId/:weeklyStreakId",  claimStoryCompletionReward);

// Get story completion statistics
router.get("/story-completion/statistics/:userId",  getStoryCompletionStatistics);

// Get story completion history
router.get("/story-completion/history/:userId",  getStoryCompletionHistory);

module.exports = router; 