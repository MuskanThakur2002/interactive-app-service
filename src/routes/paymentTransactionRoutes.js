const express = require('express');
const router = express.Router();
const PaymentTransactionController = require('../controllers/PaymentTransactionController');
const auth = require('../middleware/authMiddleware'); // Assuming you have auth middleware
const adminAuth = require('../middleware/adminAuth'); // For admin-only routes
const { criticalLimiter } = require('../utils/rateLimiters');

// Base path: /api/payment-transactions

/**
 * Get payment summary
 * @route GET /api/payment-transactions/summary
 * @access Admin only
 */
router.get(
    '/summary',
    
    adminAuth,
    criticalLimiter,
    PaymentTransactionController.getPaymentSummary
);

/**
 * Get payment history
 * @route GET /api/payment-transactions/history
 * @access Admin only
 */
router.get(
    '/history',
    
    adminAuth,
    criticalLimiter,
    PaymentTransactionController.getPaymentHistory
);

/**
 * Get reconciliation report
 * @route GET /api/payment-transactions/reconciliation
 * @access Admin only
 */
router.get(
    '/reconciliation',
    
    adminAuth,
    criticalLimiter,
    PaymentTransactionController.getReconciliationReport
);

module.exports = router; 