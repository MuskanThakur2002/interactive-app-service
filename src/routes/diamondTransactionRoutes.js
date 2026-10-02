const express = require('express');
const router = express.Router();
const DiamondTransactionController = require('../controllers/DiamondTransactionController');
const auth = require('../middleware/authMiddleware'); // Assuming you have auth middleware

// Get transaction summary
router.get(
    '/summary/:userId',
    
    DiamondTransactionController.getTransactionSummary
);

// Get transaction history
router.get(
    '/history/:userId',
    
    DiamondTransactionController.getTransactionHistory
);

module.exports = router;
