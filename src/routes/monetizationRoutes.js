const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
  // Daily Rewards
  claimDailyReward,
  getDailyRewardStatus,
  
  // Time Tracking
  startTimeTracking,
  endTimeTracking,
  getTimeTrackingStats,
  getCurrentSessionProgress,
  claimSessionDiamonds,
  
  // Daily Hourly Rewards (Enhanced System)
  getDailyHourlyRewardsStatus,
  claimDailyHourlyRewards,
  getDailyHourlyRewardsHistory,
  getWeeklyHourlyRewardsStats,
  
  // Hourly Reward Notifications (Simplified)
  getHourlyRewardNotifications,
  markNotificationAsRead,
  
  // Scene Unlock
  unlockScene,
  unlockEntireStory,
  checkSceneAccess,
  initializeChapter,
  
  // Total Diamonds Earned Today
  getTotalDiamondsEarnedToday
} = require("../controllers/monetizationController");

// ========================================
// DAILY REWARDS ROUTES
// ========================================

/**
 * GET /daily-rewards/status/:userId
 * 
 * Get daily reward status for a user
 * - Checks if user can claim today's reward
 * - Returns consecutive days, next reward amount, etc.
 * - Call this to show daily reward UI
 * 
 * @param {string} userId - User ID
 * @returns {Object} Daily reward status and eligibility
 */
router.get("/daily-rewards/status/:userId", getDailyRewardStatus);

/**
 * POST /daily-rewards/claim/:userId
 * 
 * Claim daily reward for a user
 * - Awards diamonds based on consecutive days
 * - Updates user's diamond balance
 * - Call this when user clicks "Claim Daily Reward"
 * 
 * @param {string} userId - User ID
 * @returns {Object} Reward amount and updated user stats
 */
router.post("/daily-rewards/claim/:userId", claimDailyReward);

/**
 * GET /total-diamonds-earned-today/:userId
 * 
 * Get total diamonds earned today across all reward systems
 * - Daily rewards claimed today
 * - Time tracking diamonds earned today
 * - Weekly streak rewards claimed today
 * - Story completion rewards claimed today
 * - Call this to show daily earnings summary
 * 
 * @param {string} userId - User ID
 * @returns {Object} Total diamonds earned today with breakdown by source
 */
router.get("/total-diamonds-earned-today/:userId", getTotalDiamondsEarnedToday);

// ========================================
// TIME TRACKING ROUTES
// ========================================

/**
 * POST /time-tracking/start
 * 
 * Start a new time tracking session
 * - Creates new active session for user
 * - Ends any existing active sessions
 * - Call this when user opens the app
 * 
 * @body {string} userId - User ID
 * @body {string} deviceId - Device identifier (optional)
 * @returns {Object} Session ID and start time
 */
router.post("/time-tracking/start", startTimeTracking);

/**
 * POST /time-tracking/end
 * 
 * End current time tracking session
 * - Calculates total session duration
 * - Awards diamonds (1 diamond per hour)
 * - Updates user's diamond balance
 * - Call this when user closes app or goes to background
 * 
 * @body {string} sessionId - Active session ID
 * @body {string} userId - User ID
 * @returns {Object} Diamonds earned and session statistics
 */
router.post("/time-tracking/end", endTimeTracking);

/**
 * GET /time-tracking/stats/:userId
 * 
 * Get time tracking statistics for today
 * - Returns total time spent today
 * - Shows diamonds earned today
 * - Includes current active session info
 * - Call this to show daily stats
 * 
 * @param {string} userId - User ID
 * @returns {Object} Today's stats and current session info
 */
router.get("/time-tracking/stats/:userId", getTimeTrackingStats);

/**
 * GET /time-tracking/progress/:userId
 * 
 * Get real-time progress of current active session
 * - Shows current session duration
 * - Calculates diamonds earned so far
 * - Shows time until next diamond
 * - Call this every 5-10 minutes to show progress
 * 
 * @param {string} userId - User ID
 * @returns {Object} Current session progress and next diamond info
 */
router.get("/time-tracking/progress/:userId", getCurrentSessionProgress);

/**
 * POST /time-tracking/claim-diamonds
 * 
 * Claim diamonds from current active session
 * - Awards diamonds based on time spent since last claim
 * - Updates user's diamond balance immediately
 * - Call this when user wants to claim earned diamonds
 * 
 * @body {string} sessionId - Active session ID
 * @body {string} userId - User ID
 * @returns {Object} Diamonds claimed and updated user balance
 */
router.post("/time-tracking/claim-diamonds", claimSessionDiamonds);

// ========================================
// DAILY HOURLY REWARDS ROUTES (Enhanced System)
// ========================================

/**
 * GET /daily-hourly-rewards/status/:userId
 * 
 * Get comprehensive daily hourly rewards status
 * - Shows total time spent across ALL sessions today
 * - Calculates total diamonds earned from all sessions
 * - Shows claimable diamonds from all sessions
 * - Includes detailed session breakdown
 * - Call this to show enhanced hourly rewards UI
 * 
 * @param {string} userId - User ID
 * @returns {Object} Complete daily hourly rewards status
 */
router.get("/daily-hourly-rewards/status/:userId", getDailyHourlyRewardsStatus);

/**
 * POST /daily-hourly-rewards/claim/:userId
 * 
 * Claim diamonds from ALL sessions of the day
 * - Awards diamonds based on total time spent today
 * - Updates all session records with claimed amounts
 * - Prevents double-claiming of same time periods
 * - Call this when user wants to claim all earned diamonds
 * 
 * @param {string} userId - User ID
 * @returns {Object} Total diamonds claimed from all sessions
 */
router.post("/daily-hourly-rewards/claim/:userId", claimDailyHourlyRewards);

/**
 * GET /daily-hourly-rewards/history/:userId
 * 
 * Get daily hourly rewards history
 * - Shows past days' time spent and diamonds earned
 * - Configurable number of days (default 7, max 30)
 * - Useful for showing progress trends
 * - Call this to show historical data
 * 
 * @param {string} userId - User ID
 * @query {number} days - Number of days to fetch (default: 7, max: 30)
 * @returns {Object} Historical daily hourly rewards data
 */
router.get("/daily-hourly-rewards/history/:userId", getDailyHourlyRewardsHistory);

/**
 * GET /daily-hourly-rewards/weekly-stats/:userId
 * 
 * Get weekly hourly rewards statistics
 * - Shows total time and diamonds for the week
 * - Calculates averages and trends
 * - Includes daily breakdown
 * - Call this to show weekly progress
 * 
 * @param {string} userId - User ID
 * @returns {Object} Weekly hourly rewards statistics
 */
router.get("/daily-hourly-rewards/weekly-stats/:userId", getWeeklyHourlyRewardsStats);

// ========================================
// HOURLY REWARD NOTIFICATIONS ROUTES (Simplified)
// ========================================

/**
 * GET /notifications/:userId
 * 
 * Get user's hourly reward notifications
 * - Shows all notifications
 * - Includes unread count
 * - Call this to display notification center
 * 
 * @param {string} userId - User ID
 * @query {number} limit - Number of notifications to fetch (default: 20)
 * @returns {Object} User's notifications
 */
router.get("/notifications/:userId", getHourlyRewardNotifications);

/**
 * PUT /notifications/:notificationId/:userId
 * 
 * Mark notification as read
 * - Updates notification read status
 * - Tracks read timestamp
 * - Call this when user views notification
 * 
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Object} Updated notification status
 */
router.put("/notifications/:notificationId/:userId", markNotificationAsRead);

// ========================================
// SCENE UNLOCK ROUTES
// ========================================

/**
 * POST /scene-unlock
 * 
 * Unlock scene(s) for a user
 * - Supports PAID, FREE, and TIME_BASED unlocks
 * - Can unlock single or multiple scenes
 * - Deducts diamonds for paid unlocks
 * - Call this when user wants to unlock content
 * 
 * @body {string} userId - User ID
 * @body {string} storyId - Story ID
 * @body {string} chapterId - Chapter ID
 * @body {string} sceneId - Scene ID (for single unlock)
 * @body {string} unlockType - "PAID", "FREE", or "TIME_BASED"
 * @body {boolean} unlockMultiple - Whether to unlock multiple scenes
 * @returns {Object} Unlock result and updated user diamonds
 */
router.post("/scene-unlock", unlockScene);

/**
 * POST /unlock-entire-story
 * 
 * Unlock entire story for 60 diamonds
 * - Deducts 60 diamonds from user
 * - Unlocks all scenes in all chapters of the story
 * - Updates user progress for all chapters
 * - Skips already unlocked scenes
 * 
 * @body {string} userId - User ID
 * @body {string} storyId - Story ID
 * @returns {Object} Unlock result with diamonds spent and scenes unlocked
 */
router.post("/unlock-entire-story", unlockEntireStory);

/**
 * GET /scene-access/:userId/:storyId/:chapterId/:sceneId?
 * 
 * Check if user can access a scene
 * - Verifies if scene is unlocked
 * - Shows available unlock options
 * - Returns scene access status
 * - Call this before showing scene content
 * 
 * @param {string} userId - User ID
 * @param {string} storyId - Story ID
 * @param {string} chapterId - Chapter ID
 * @param {string} sceneId - Scene ID (optional)
 * @returns {Object} Scene access status and unlock options
 */
router.get("/scene-access/:userId/:storyId/:chapterId/:sceneId?", checkSceneAccess);

/**
 * POST /initialize-chapter
 * 
 * Initialize a new chapter for a user
 * - Creates user progress record
 * - Automatically unlocks first 2 scenes for free
 * - Call this when user starts a new chapter
 * 
 * @body {string} userId - User ID
 * @body {string} storyId - Story ID
 * @body {string} chapterId - Chapter ID
 * @returns {Object} User progress and unlocked scenes
 */
router.post("/initialize-chapter", initializeChapter);

module.exports = router; 