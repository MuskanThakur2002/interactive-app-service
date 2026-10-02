const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware"); // Assuming you have auth middleware

const {
  createUserSession,
  updateSessionLog,
} = require("../controllers/UserSessionsController");

router.post("/create-user-session",  createUserSession);
router.post("/update-user-session", updateSessionLog);

module.exports = router;
