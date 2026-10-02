const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware"); // Assuming you have auth middleware

const {
  getUserStories,
  previewScene,
  getChaptersByStoryId,
  getMomentUserStories,
  getUserNormalStories,
  previewStoryScene,
  uploadStoryThumbnails,
  upload,
  previewSceneV2,
  getStoryByStoryId,
  getTotalPaidUnlockCount,
  incrementPaidUnlockCount,
  invalidateSceneCache,
  getCacheStats,
  getCacheHealth,
  invalidateStoriesCache,
  invalidateUserRoleStoriesCache,
  shareAndUnlock
} = require("../controllers/storyController");

const {
  getLastUnfinishedStory,
  getDefaultStory
} = require("../controllers/storyNavigationController");

// Story Navigation APIs - MUST come before generic routes
router.get("/last-unfinished/:userId",  getLastUnfinishedStory);
router.get("/default/:userId",  getDefaultStory);

router.get("/stories/:userId", getUserStories);
router.get("/scene/preview/:chapterId/sceneNumber/:sceneNumber/sceneId/:sceneId",  previewScene);
router.get("/scene/read/:sceneId",  previewStoryScene);
router.get("/chapters/user/:userId/story/:storyId", getChaptersByStoryId);
router.get("/moments-stories/:userId",  getMomentUserStories);
router.get("/normal-stories/:userId",  getUserNormalStories);
router.get("/scene/preview/v2/:chapterId", previewSceneV2);

// Generic route - MUST come last
router.get("/:storyId",  getStoryByStoryId);

// Story thumbnail upload route
router.post(
  "/upload-story-thumbnails/:storyId",
  
  upload.fields([
    { name: 'square', maxCount: 1 },
    { name: 'portrait', maxCount: 1 },
    { name: 'vertical', maxCount: 1 },
    { name: 'landscape', maxCount: 1 }
  ]),
  uploadStoryThumbnails
);

// Get total paid unlock count route
router.post(
  "/getTotalPaidUnlockCount/:storyId/chapter/:chapterId",
  
  getTotalPaidUnlockCount
);

// Increment paid unlock count route
router.post(
  "/increamentPaidUnlockCount/:storyId/chapter/:chapterId",
  
  incrementPaidUnlockCount
);

// Cache management routes
router.delete("/cache/scenes/:chapterId?",invalidateSceneCache);
router.delete("/cache/story/:storyId", invalidateSceneCache);
router.delete("/cache/all", invalidateSceneCache);
router.get("/cache/stats", getCacheStats);
router.get("/cache/health", getCacheHealth);

// Story cache management routes
router.delete("/cache/stories", invalidateStoriesCache);
router.delete("/cache/stories/:userRole", invalidateUserRoleStoriesCache);

// Share and unlock route
router.post("/share-and-unlock",  shareAndUnlock);

module.exports = router;
