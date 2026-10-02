const express = require("express");
const auth = require("../middleware/authMiddleware"); // Assuming you have auth middleware
const { sensitiveLimiter } = require("../utils/rateLimiters");

const {
  loginWithGoogle,
  getUserDetails,
  handleAppleCallback,
  createAnonymousUser,
  subtractDiamonds,
  updateMobileSetting,
  addDiamonds,
  updateUserName,
  deleteUser,
  logout,
  submitFeedback,
  getFeedback,
  getAppVersion,
  updateWelcomeTextShown,
  fixedProgress,
  uploadProfileImage,
  upload
} = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.post("/login-with-google", sensitiveLimiter, loginWithGoogle);
router.get(
  "/user-details/:userId",
  
  getUserDetails
);
router.post("/auth/apple/callback", sensitiveLimiter, handleAppleCallback);
router.post(
  "/anonymous-login",
  
  createAnonymousUser
);
router.post(
  "/subtract-diamonds",
  
  subtractDiamonds
);
router.post(
  "/update-mobile-setting",
  
  updateMobileSetting
);
router.post("/add-diamonds",  addDiamonds);
router.post("/update-user-name",  updateUserName);
router.post("/delete-user",  deleteUser);
router.get("/logout",  logout);
router.post("/submit-feedback",  submitFeedback);
router.get("/get-feedback/:userId",  getFeedback);
router.post(
  "/update-welcome-text-shown/:userId",
  
  updateWelcomeTextShown
);
router.get("/app/version", getAppVersion);

// fixed progress issue
router.post("/fixed-progress",  fixedProgress);
router.post(
  "/upload-profile-image/:userId",
  
  upload.single("profileImage"),
  uploadProfileImage
);

module.exports = router;
