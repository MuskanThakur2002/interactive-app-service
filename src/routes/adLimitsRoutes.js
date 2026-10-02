const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const AdLimitsController = require('../controllers/adLimitsController');

/**
 * GET /api/ad_limits/:userId
 * Fetch current ad thresholds and usage for the user
 * 
 * @param {string} userId - User ID
 * @returns {Object} Ad limits information including daily cap, usage, and remaining
 */
router.get('/:userId', AdLimitsController.getAdLimits);

/**
 * POST /api/ad_limits/update
 * Increment ad usage after a rewarded ad is successfully completed
 * 
 * @body {string} userId - User ID
 * @body {number} incrementBy - Number of ads to increment (default: 1)
 * @body {string} lastWatchedAt - ISO timestamp of when ad was watched
 * @returns {Object} Updated ad usage information
 */
router.post('/update', AdLimitsController.updateAdLimits);

module.exports = router;
