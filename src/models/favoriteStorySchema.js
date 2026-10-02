const mongoose = require('../utils/DatabaseUtils');

const favoriteStorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story_v2",
      required: true
    },
    addedAt: { type: Date, default: Date.now } // Tracks when the story was added to favorites
  },
  { timestamps: true }
);

const FavoriteStory = mongoose.model("FavoriteStory", favoriteStorySchema);
module.exports = FavoriteStory;
