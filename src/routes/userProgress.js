const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware"); // Assuming you have auth middleware

const {
  updateUserProgress,
  createOngoingStory,
  getOngoingStory,
  deleteOngoingStory,
  readTotalScenes,
  getUserProgress,
  resetScenes
} = require("../controllers/userProgressController");

router.post("/updateProgress",  updateUserProgress);
// router.post("/story-bookmark", createOngoingStory);
// router.get("/get/bookmark/user/:userId/story/:storyId", getOngoingStory);

router.post("/ongoing-story",  createOngoingStory);
router.get("/get/ongoing-story/user/:userId/story/:storyId",  getOngoingStory);
router.delete(
  "/delete/ongoing-story/user/:userId/story/:storyId/chapter/:chapterId/previousChapterId/:previouschapterId",
  
  deleteOngoingStory
);

router.get("/user-chapter-progress/:userId/:storyId/:chapterId", getUserProgress);
router.get("/total-scenes/read/:userId",   readTotalScenes);

router.delete(
  "/reset-scenes/user/:userId/story/:storyId",
  
  resetScenes
);

module.exports = router;
