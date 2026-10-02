const express = require('express');
const { query, validationResult } = require('express-validator');
const PaymentTransactionService = require('../services/PaymentTransactionService');
const log = require('../utils/logger');

class PaymentTransactionController {
    /**
     * Get payment summary
     * @route GET /api/payment-transactions/summary
     */
    async getPaymentSummary(req, res) {
        try {
            await Promise.all([
                query('userId').optional().isMongoId().run(req),
                query('status').optional().isIn([
                    'INITIATED', 'PROCESSING', 'COMPLETED', 
                    'FAILED', 'VERIFIED', 'VERIFICATION_FAILED', 
                    'REFUNDED'
                ]).run(req),
                query('paymentMethod').optional().isIn(['APPLE_PAY', 'GOOGLE_PAY']).run(req),
                query('startDate').optional().isISO8601().run(req),
                query('endDate').optional().isISO8601().run(req)
            ]);

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const summary = await PaymentTransactionService.getPaymentSummary(req.query);
            return res.status(200).json(summary);

        } catch (error) {
            log.error('Failed to get payment summary', { error: error.message });
            return res.status(500).json({
                error: 'Failed to get payment summary',
                details: error.message
            });
        }
    }

    /**
     * Get payment history
     * @route GET /api/payment-transactions/history
     */
    async getPaymentHistory(req, res) {
        try {
            await Promise.all([
                query('page').optional().isInt({ min: 1 }).run(req),
                query('limit').optional().isInt({ min: 1, max: 100 }).run(req),
                query('userId').optional().isMongoId().run(req),
                query('status').optional().isIn([
                    'INITIATED', 'PROCESSING', 'COMPLETED', 
                    'FAILED', 'VERIFIED', 'VERIFICATION_FAILED', 
                    'REFUNDED'
                ]).run(req),
                query('paymentMethod').optional().isIn(['APPLE_PAY', 'GOOGLE_PAY']).run(req),
                query('sortBy').optional().isIn(['createdAt', 'amount', 'status']).run(req),
                query('sortOrder').optional().isIn(['asc', 'desc']).run(req)
            ]);

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const history = await PaymentTransactionService.getPaymentHistory(req.query);
            return res.status(200).json(history);

        } catch (error) {
            log.error('Failed to get payment history', { error: error.message });
            return res.status(500).json({
                error: 'Failed to get payment history',
                details: error.message
            });
        }
    }

    /**
     * Get reconciliation report
     * @route GET /api/payment-transactions/reconciliation
     */
    async getReconciliationReport(req, res) {
        try {
            await Promise.all([
                query('startDate').optional().isISO8601().run(req),
                query('endDate').optional().isISO8601().run(req)
            ]);

            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const report = await PaymentTransactionService.getReconciliationReport(req.query);
            return res.status(200).json(report);

        } catch (error) {
            log.error('Failed to get reconciliation report', { error: error.message });
            return res.status(500).json({
                error: 'Failed to get reconciliation report',
                details: error.message
            });
        }
    }
}

module.exports = new PaymentTransactionController(); 