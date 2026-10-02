const { mongoose } = require("../utils/DatabaseUtils");
const Schema = mongoose.Schema;

// Define the schema for the character characteristics
const characteristicsSchema = new Schema({
    age: { type: String, required: false },
    build: { type: String, required: false },
    face_shape: { type: String, required: false },
    eye_color: { type: String, required: false },
    eye_shape: { type: String, required: false },
    nose: { type: String, required: false },
    mouth: { type: String, required: false },
    distinctive_feature: { type: String, required: false },
    hair_color: { type: String, required: false },
    hair_length: { type: String, required: false },
    hair_style: { type: String, required: false },
    clothes_style: { type: String, required: false },
    accessories: { type: String, required: false },
    personality: { type: String, required: false },
    ethnicity: { type: String, required: false },
    gender: { type: String, required: false },
    voice: { type: String, required: false }
});

// Define the main schema for Character with defaultOutfitId referencing Outfit_v2
const characterSchema = new Schema({
    status: { type: String, default: 'pending' },
    character_type: { type: String, required: false },
    characterName: { type: String, required: true }, // Set required to true for characterName
    characteristics: { type: characteristicsSchema, required: false },
    characterDescription: { type: String, required: false },
    imageURLs: {
        face: { type: String, required: false },       // URL for face image
        full_body: { type: String, required: false }   // URL for full body image
    },
    seed_id: { type: String, required: true }, // Ensure seed_id is stored and required
    isDeleted: { type: Boolean, default: false },      // Soft delete flag
    character_voice: { type: String, required: false },
    character_voice_wav: { type: String, required: false },
    changed_voice: { type: Boolean, default: false },
    is_voice_mapped: { type: Boolean, default: false },
    auto_character_id: { type: String, required: false },
}, { timestamps: true });                             // Enable automatic timestamps

const CharacterV2 = mongoose.model("Character_v2", characterSchema);
module.exports = CharacterV2;
