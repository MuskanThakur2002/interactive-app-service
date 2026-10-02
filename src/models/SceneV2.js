const { mongoose } = require("../utils/DatabaseUtils");

const { Schema } = mongoose;

// Character Sub-Schema (assuming it's defined elsewhere in your code)
const CharacterSubSchema = new Schema(
  {
    characterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character_v2",
      required: true
    },
    characterName: { type: String, required: false }
  },
  { _id: false }
);

// Dialogue Schema
const DialogueSchema = new Schema(
  {
    text: { type: String, required: true },
    character: { type: CharacterSubSchema, required: true }
  },
  { _id: false }
);

// Narration Schema
const NarrationSchema = new Schema(
  {
    narratorId: { type: String, required: false },
    text: { type: String, required: true },
    narratorVoiceId: { type: String, required: false }
  },
  { _id: false }
);

const ChoiceAndOutfitSchema = new Schema({
  characterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Character_v2",
    required: false
  },
  choiceText: { type: String, required: false },
  diamond: { type: Number, required: false },
  image: { type: String, required: false },
  direction: {
    type: String,
    enum: ["FORWARD", "BACKWARD", ""],
    required: false
  },
  outfitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outfit_v2",
    required: false
  },
  hairIds: { type: [mongoose.Schema.Types.ObjectId], required: false },
  diamond: { type: Number, required: false },
  choiceText: { type: String, required: false },
  subSceneIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sub_scene_v2",
      required: false
    }
  ]
});
const RequestNameSchema = new Schema(
  {
    text: { type: String, required: true },
    defaultName: { type: String, required: false }
  },
  { _id: false }
);

// Workflow Schema
const WorkflowSchema = new Schema(
  {
    type: {
      type: String,
      enum: [
        "Dialogue",
        "Narration",
        "Choices",
        "RequestName",
        "FeatureShowcase",
        "Background"
      ],
      required: true
    },
    choiceType: {
      type: String,
      enum: [
        "Default",
        "Protagonist",
        "LoveInterest",
        "OutfitSelection",
        "Navigation"
      ],
      required: false
    },
    characterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character_v2",
      required: false
    },
    choiceQuestion: { type: String, required: false },
    background: {
      backgroundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BackgroundImage",
        required: false
      },
      text: { type: String, required: false }
    },
    narration: { type: NarrationSchema, required: false },
    emotion: { type: String, required: false },
    dialogue: { type: DialogueSchema, required: false },
    choices: { type: [ChoiceAndOutfitSchema], required: false },
    imageURL: { type: String, required: false },
    musicURL: { type: String, required: false },
    isThinking: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    RequestName: { type: RequestNameSchema, required: false },
    featureShowcase: { type: String, required: false },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const characterOptionSchema = {
  characterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Character_v2",
    required: false
  },
  outfitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Outfit",
    required: false
  },
  hairId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "HairStyle",
    required: false
  },
  image: { type: String, required: false }
};

const SceneCharacterSchema = new mongoose.Schema(
  {
    ...characterOptionSchema,
    customName: { type: String, required: false },
    protagonistOptions: [characterOptionSchema],
    loveInterestOptions: [characterOptionSchema]
  },
  { timestamps: true }
);

const SceneSchema = new Schema(
  {
    name: { type: String, required: true },
    backgroundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BackgroundImage",
      required: false
    },
    workflows: { type: [WorkflowSchema], required: false },
    isDeleted: { type: Boolean, default: false },
    sceneNumber: { type: Number, required: false },
    nextSceneId: { type: String, required: false },
    musicURL: { type: String, required: false },
    chapterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "chapter_v2",
      required: true
    },
    outfitType: {
      type: String,
      enum: ["CURRENT", "DEFAULT", "SCENE"],
      default: "CURRENT"
    },
    characters: [{ type: SceneCharacterSchema, required: false }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const Scene = mongoose.model("Scene_v2", SceneSchema);

module.exports = Scene;
