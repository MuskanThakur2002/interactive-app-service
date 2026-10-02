const { mongoose } = require("../utils/DatabaseUtils");

const FeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    feedback: [{
      type: String,
      required: true
    }],
    cancelCount: {
      type: Number,
      default: 0
    },
    scene2to4: {
      type: Boolean,
      default: false
    },
    scene5plus: {
      type: Boolean,
      default: false
    },
    after5Days: {
      type: Boolean,
      default: false
    },
    lastPopupTime: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

const Feedback = mongoose.model("feedback", FeedbackSchema);

module.exports = Feedback;
