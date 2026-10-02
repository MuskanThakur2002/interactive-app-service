const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { registerDevice, cancelEpisodeUnlock } = require("../controllers/notificationsController");

const router = express.Router();

router.post(
  "/register-device",
  
  registerDevice
);

// Keep cancel endpoint for admin/debugging purposes
router.post(
  "/cancel-episode-unlock",
  cancelEpisodeUnlock
);

module.exports = router;


