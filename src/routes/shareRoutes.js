const router = require("express").Router();

const {
  processReferral,
  checkAllUserRewards,
  claimReward,
  getUserReferralLink
} = require("../controllers/shareController");
const auth = require("../middleware/authMiddleware"); // Assuming you have auth middleware

// Process new user referral login
router.post("/deep-link/process-referral",  processReferral);

// Get user's referral link
router.get("/deep-link/link/:userId",  getUserReferralLink);

// Check all reward availability (both referred and referrer rewards)
router.get(
  "/deep-link/rewards/:userId",
  
  checkAllUserRewards
);

// Claim rewards (automatically detects referred vs referrer)
router.post("/deep-link/claim",  claimReward);

module.exports = router;
