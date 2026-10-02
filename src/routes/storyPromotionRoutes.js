const express = require('express');
const router = express.Router();
const storyPromotionController = require('../controllers/storyPromotionController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
// router.use(authMiddleware.authenticate);

/**
 * @route POST /api/story-promotion
 * @desc Create a new story promotion
 * @access Private
 */
router.post('/', storyPromotionController.createStoryPromotion);

/**
 * @route POST /api/story-promotion/bulk
 * @desc Bulk create story promotions from CSV data
 * @access Private
 */
router.post('/bulk', storyPromotionController.bulkCreateStoryPromotions);

/**
 * @route GET /api/story-promotion
 * @desc Get all story promotions with pagination
 * @access Private
 */
router.get('/', storyPromotionController.getStoryPromotions);

/**
 * @route PUT /api/story-promotion/:promotionId
 * @desc Update a story promotion
 * @access Private
 */
router.put('/:promotionId', storyPromotionController.updateStoryPromotion);

/**
 * @route DELETE /api/story-promotion/:promotionId
 * @desc Delete a story promotion
 * @access Private
 */
router.delete('/:promotionId', storyPromotionController.deleteStoryPromotion);

/**
 * @route GET /api/story-promotion/stats
 * @desc Get promotion statistics
 * @access Private
 */
router.get('/stats', storyPromotionController.getPromotionStats);

/**
 * @route POST /api/story-promotion/test
 * @desc Test send promotion notification to a specific user
 * @access Private
 */
router.post('/test', storyPromotionController.testSendPromotion);

module.exports = router;
