const router = require('express').Router();
const { verifyPurchase, handleServerNotification } = require('../controllers/appleIAPController');
const auth = require('../middleware/authMiddleware'); 
router.post('/verify-purchase', verifyPurchase);
router.post('/notification', handleServerNotification);


module.exports = router;
