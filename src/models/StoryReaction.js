const { mongoose } = require("../utils/DatabaseUtils");

const StoryReactionSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story_v2",
      required: true,
      index: true
    },
    reaction: {
      type: String,
      enum: ["LIKE", "DISLIKE", "NEUTRAL"],
      required: true
    }
  },
  { timestamps: true }
);

// Create a compound index to ensure a user can only have one reaction per story
StoryReactionSchema.index({ userId: 1, storyId: 1 }, { unique: true });

const StoryReaction = mongoose.model("StoryReaction", StoryReactionSchema);
module.exports = StoryReaction; 