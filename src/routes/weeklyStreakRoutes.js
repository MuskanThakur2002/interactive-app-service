const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const {
  markDayLoggedIn,
  claimWeeklyReward,
  getCurrentWeekProgress,
  getWeeklyStreakHistory,
  getWeeklyStreakStats
} = require("../controllers/weeklyStreakController");

// Mark user as logged in for the current day
router.post("/weekly-login/:userId", markDayLoggedIn);

// Claim weekly reward (only when all 7 days are completed)
router.post("/claim-weekly/:userId/:weeklyStreakId", claimWeeklyReward);

// Get current week's progress
router.get("/current-week-progress/:userId/:weeklyStreakId", getCurrentWeekProgress);

// Get weekly streak history
router.get("/weekly-history/:userId", getWeeklyStreakHistory);

// // Get weekly streak statistics
// router.get("/weekly-status/:userId", getWeeklyStreakStats);

module.exports = router; 