const StoryReaction = require("../models/StoryReaction");
const Story = require("../models/StoryV2");

class StoryReactionController {
  // Add or update a reaction
  static async addReaction(req, res) {
    try {
      const { storyId, userId, reaction } = req.body;

      if (!storyId || !reaction) {
        return res
          .status(400)
          .json({ message: "Story ID and reaction are required" });
      }

      // Check if story exists
      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      // If reaction is NEUTRAL, remove the reaction instead
      if (reaction === "NEUTRAL") {
        await StoryReaction.findOneAndDelete({ userId, storyId });
        return res.status(200).json({
          message: "Reaction removed successfully",
          data: null
        });
      }

      // Update or create reaction
      const updatedReaction = await StoryReaction.findOneAndUpdate(
        { userId, storyId },
        { reaction },
        { upsert: true, new: true }
      );

      res.status(200).json({
        message: "Reaction updated successfully",
        data: updatedReaction
      });
    } catch (error) {
      console.error("Error in addReaction:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  // Remove a reaction
  static async removeReaction(req, res) {
    try {
      const { storyId, userId } = req.params;

      const deletedReaction = await StoryReaction.findOneAndDelete({
        userId,
        storyId
      });

      if (!deletedReaction) {
        return res.status(404).json({ message: "Reaction not found" });
      }

      res.status(200).json({
        message: "Reaction removed successfully"
      });
    } catch (error) {
      console.error("Error in removeReaction:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  // Get reactions for a story
  static async getStoryReactions(req, res) {
    try {
      const { storyId } = req.params;

      const reactions = await StoryReaction.find({ storyId });
      const likeCount = reactions.filter((r) => r.reaction === "LIKE").length;
      const dislikeCount = reactions.filter(
        (r) => r.reaction === "DISLIKE"
      ).length;
      const neutralCount = reactions.filter(
        (r) => r.reaction === "NEUTRAL"
      ).length;

      res.status(200).json({
        data: {
          reactions,
          stats: {
            likes: likeCount,
            dislikes: dislikeCount,
            neutral: neutralCount,
            total: reactions.length
          }
        }
      });
    } catch (error) {
      console.error("Error in getStoryReactions:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }

  // Get user's reaction for a story
  static async getUserReaction(req, res) {
    try {
      const { storyId, userId } = req.params;

      const reaction = await StoryReaction.findOne({ userId, storyId });

      res.status(200).json({
        data: reaction || { reaction: "NEUTRAL" }
      });
    } catch (error) {
      console.error("Error in getUserReaction:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
}

module.exports = StoryReactionController;
