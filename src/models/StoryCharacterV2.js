const mongoose = require("../utils/db");

const StoryCharacterSchema = new mongoose.Schema({
  storyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Story_v2",
    required: true
  },
  character: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Character_v2",
    required: true
  },
  customName: { type: String, required: false },
  isProtagonist: { type: Boolean, default: false },
  outfitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outfit",
    required: false
  },
  hairId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "HairStyle",
    required: false
  }
}, { timestamps: true });

const StoryCharacter = mongoose.model("StoryCharacter_v2", StoryCharacterSchema);
module.exports = StoryCharacter; 