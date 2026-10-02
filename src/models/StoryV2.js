const { mongoose } = require("../utils/DatabaseUtils");

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
  image: { type: String, required: false },
  videoUrl: { type: String, required: false },
  character_voice: { type: String, required: false },
  auto_character_id: { type: String, required: false },
};

const StoryCharacterSchema = new mongoose.Schema(
  {
    ...characterOptionSchema,
    customName: { type: String, required: false },
    protagonistOptions: [characterOptionSchema],
    loveInterestOptions: [characterOptionSchema],
    characterType: { type: String, required: false },
    character_voice: { type: String, required: false },
  },
  { timestamps: true }
);

const StoryStatus = {
  DRAFT: "DRAFT",
  REVIEW: "REVIEW",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED"
};

const StorySchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    no_of_views: { type: Number, default: 0 },
    no_of_chapters: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    userId: { type: String, required: false },
    thumbnails: {
      square: { type: String, required: false }, // 1:1 aspect ratio
      portrait: { type: String, required: false }, // 2:3 aspect ratio
      vertical: { type: String, required: false }, // 9:16 aspect ratio
      landscape: { type: String, required: false } // 16:9 aspect ratio
    },
    videoLink: { type: String, required: false },
    characters: [{ type: StoryCharacterSchema, required: false }], // renamed to plural and made into array
    story_authoring_id: { type: String, required: false, unique: true },
    Narrator_Voice: { type: String, required: false },
    Narrator_Voice_Wav: { type: String, required: false },
    changed_voice: { type: Boolean, default: false },
    is_voice_mapped: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(StoryStatus), default: StoryStatus.DRAFT },
    story_type: { type: String, required: false },
    prologue: { type: String, required: false },
    isFeatured: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    isWriterStory: { type: Boolean, default: false },
    isNewLaunch: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Optimized indexes - Minimal set for maximum performance
// 1. Primary compound index covering most common query patterns
StorySchema.index({ 
  status: 1, 
  isDeleted: 1, 
  story_type: 1, 
  createdAt: -1 
}, { 
  name: 'status_deleted_type_created',
  background: true 
});

// 2. External reference index (unique field)
StorySchema.index({ 
  story_authoring_id: 1 
}, { 
  name: 'story_authoring_id',
  background: true,
  sparse: true 
});

// 3. Featured stories index (for homepage/featured content)
StorySchema.index({ 
  isFeatured: 1, 
  status: 1, 
  isDeleted: 1, 
  createdAt: -1 
}, { 
  name: 'featured_status_deleted_created',
  background: true 
});

// 4. Default story index (for onboarding/default story)
StorySchema.index({ 
  isDefault: 1, 
  status: 1, 
  isDeleted: 1 
}, { 
  name: 'default_status_deleted',
  background: true 
});

const Story = mongoose.model("Story_v2", StorySchema);
module.exports = Story;
