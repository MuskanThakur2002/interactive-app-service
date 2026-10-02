const { mongoose } = require("../utils/DatabaseUtils");

// Character Sub-Schema (assuming it's defined elsewhere in your code)
const CharacterSubSchema = new mongoose.Schema(
  {
    characterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character_v2",
      required: false
    },
    characterName: { type: String, required: false }
  },
  { _id: false }
);

// Narration Schema
const NarrationSchema = new mongoose.Schema(
  {
    narratorId: { type: String, required: false },
    text: { type: String, required: false },
    narratorVoiceId: { type: String, required: false },
    characters: [{ type: String, required: false }]
  },
  { _id: false }
);

// Outfit Selection Schema
const OutfitSelectionSchema = new mongoose.Schema(
  {
    outfitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Outfit_v2", // Reference to the Outfit schema
      required: false
    },
    image: { type: String, required: false },
    hairIds: { type: [mongoose.Schema.Types.ObjectId], required: false }
  },
  { _id: false }
);

const DialogueSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    character: { type: CharacterSubSchema, required: true }
  },
  { _id: false }
);

// SubScene Schema
const subSceneSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Narration", "Dialogue"],
      required: false
    },
    isprotagonist: { type: Boolean, default: false },
    narration: { type: NarrationSchema, required: false },
    isThinking: { type: Boolean, default: false },
    emotion: { type: String, required: false },
    outfitSelection: { type: OutfitSelectionSchema, required: false },
    dialogue: { type: DialogueSchema, required: false },
    createdAt: { type: Date, default: Date.now, required: false }
  },
  { timestamps: true }
);

// SubScene Model
const SubScene = mongoose.model("Sub_scene_v2", subSceneSchema);

module.exports = SubScene;
