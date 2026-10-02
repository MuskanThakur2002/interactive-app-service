const express = require("express");
const router = express.Router();
const StoryReactionController = require("../controllers/StoryReactionController");
const auth = require("../middleware/authMiddleware"); // Assuming you have auth middleware

// All routes require authentication

// Add or update a reaction
router.post("/reactions", StoryReactionController.addReaction);

// Remove a reaction
router.delete("/reactions/:storyId/:userId", StoryReactionController.removeReaction);

// Get all reactions for a story
router.get("/reactions/:storyId", StoryReactionController.getStoryReactions);

// Get user's reaction for a story
router.get("/reactions/user/:storyId/:userId", StoryReactionController.getUserReaction);

module.exports = router; 