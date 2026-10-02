const { mongoose } = require("../utils/DatabaseUtils");

const ChapterStatus = {
  DRAFT: "DRAFT",
  REVIEW: "REVIEW",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED"
};

const ChapterSchema = new mongoose.Schema(
  {
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story_v2",
      required: true
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    no_of_views: { type: Number, required: true, default: 0 },
    no_of_scenes: { type: Number, default: 0 },
    status: { 
        type: String, 
        enum: Object.values(ChapterStatus),
        default: ChapterStatus.DRAFT 
    },
    isPublished: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    thumbnail: { type: String, required: false }, 
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    role: { 
        type: [String], 
        default: ['user', 'reviewer'] 
    },
  },
  { timestamps: true }
);

const Chapter = mongoose.model("Chapter_v2", ChapterSchema);
module.exports = Chapter;
