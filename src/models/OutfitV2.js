const { mongoose } = require("../utils/DatabaseUtils");

const outfitSchema = new mongoose.Schema(
  {
    characterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Character_v2",
      required: true
    },
    outfitName: { type: String, required: true },
    outfitImg: { type: String },
    videoUrl: { type: String, required: false },
    hairOptions: [
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        hairStyle: { type: String, required: true },
        emotions: {
          angry: { type: String },
          happy: { type: String },
          surprised: { type: String },
          shocked: { type: String },
          blush: { type: String },
          sad: { type: String },
          excited: { type: String },
          grin: { type: String },
          annoyed: { type: String },
          sincere: { type: String },
          flirty: { type: String },
          shy: { type: String },
          worried: { type: String },
          awkward: { type: String },
          sarcastic: { type: String },
          thinking: { type: String },
          tired: { type: String },
          smirk: { type: String }
        }
      }
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const Outfit = mongoose.model("Outfit_v2", outfitSchema);

module.exports = Outfit;
