const { mongoose } = require("../utils/DatabaseUtils");

const AppVersionSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

const AppVersion = mongoose.model("appVersion", AppVersionSchema);

module.exports = AppVersion;