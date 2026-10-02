const { mongoose } = require("../utils/DatabaseUtils");
const { APPLE_AUTH_PROVIDER, GOOGLE_AUTH_PROVIDER, ANONYMOUS_AUTH_PROVIDER } = require("../utils/LoginConstants");

const mainUserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: false,
      index: true,
      sparse: true
    },
    mobileNumber: {
      type: String,
      required: false
    },
    name: {
      type: String,
      required: true
    },
    age: {
      type: Number,
      required: false
    },
    authProvider: {
      type: String,
      enum: [GOOGLE_AUTH_PROVIDER, APPLE_AUTH_PROVIDER, ANONYMOUS_AUTH_PROVIDER],
      required: true
    },
    diamonds: {
      type: Number,
      default: 0
    },
    isAdmin: {
      type: Boolean,
      default: false
    },
    appleId: {
      type: String,
      required: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    isTemporaryName: {
      type: Boolean,
      default: false
    },
    deviceId: {
      type: String,
      required: false,
      index: true,
      sparse: true
    },
    welcomeTextShown: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ["USER", "REVIEWER"],
      default: "USER"
    },
    profileImage: {
      type: String,
      required: false,
      default: null
    },
    hasLoggedInBefore: {
      type: Boolean,
      default: false
    },
    referralUrl: {
      type: String,
      required: false
    },
    isNewUser: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

mainUserSchema.post('save', async function(doc, next) {
  try {
    const UserMobileSetting = mongoose.model('user_mobile_settings');
    await UserMobileSetting.create({
      userId: doc._id,
    });
  } catch (error) {
    console.error('Error creating UserMobileSetting:', error);
  }
});
// mainUserSchema.index(
//   { deviceId: 1, isDeleted: 1 }, 
//   { unique: true, sparse: true, partialFilterExpression: { isDeleted: false } }
// );

mainUserSchema.index(
  { deviceId: 1, isDeleted: 1 }, 
  { 
    unique: true, 
    sparse: true, 
    partialFilterExpression: { 
      isDeleted: false,
      authProvider: "anonymous"
    } 
  }
);

mainUserSchema.index(
  { email: 1, isDeleted: 1 }, 
  { unique: true, sparse: true, partialFilterExpression: { isDeleted: false } }
);

const User = mongoose.model("Main_User", mainUserSchema);

module.exports = User;