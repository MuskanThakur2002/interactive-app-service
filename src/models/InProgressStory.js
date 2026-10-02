const { mongoose } = require("../utils/DatabaseUtils");

const characterSchema = new mongoose.Schema({
  characterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Character_v2",
    required: true
  },
  customName: {
    type: String,
    required: false
  },
  defaultOutfitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outfit_v2",
    required: false
  },
  currentOutfitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outfit_v2",
    required: false
  },
  defaultHairId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  currentHairId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  }
});

const inProgressStorySchema = new mongoose.Schema(
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
    protagonist: {
      type: characterSchema,
      required: false
    },
    loveInterest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character_v2",
      required: false
    },

    protagonistIds: [characterSchema],
    loveInterestIds: [characterSchema],
    choice_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: false
    },
    chapterId: { type: mongoose.Schema.Types.ObjectId, ref: "Chapter_v2" },
    sceneId: { type: mongoose.Schema.Types.ObjectId, ref: "Scene_v2" },
    subSceneId: { type: mongoose.Schema.Types.ObjectId, ref: "SubScene_v2" },
    lastUpdatedAt: { type: Date, default: Date.now },
    workflowId: { type: mongoose.Schema.Types.ObjectId, required: false },
    unlockedSceneNumber: { type: Number, required: false },
    backgroundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BackgroundImage",
      required: false
    }
  },
  { timestamps: true }
);

const inProgressStory = mongoose.model(
  "InProgressStory",
  inProgressStorySchema
);
module.exports = inProgressStory;
