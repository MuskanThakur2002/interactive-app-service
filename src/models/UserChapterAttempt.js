const mongoose = require("../utils/db");

const UserChapterAttemptedSchema = new mongoose.Schema({
    chapterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Chapter_V2",
        required: true
      },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    progress: {type: Number, default:0},
    completedAt: { type: Date, required: false }, 
});

const UserChapterAttempted = mongoose.model('UserChapterAttempted', UserChapterAttemptedSchema);

module.exports = UserChapterAttempted;
