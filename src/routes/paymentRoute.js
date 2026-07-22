const express = require('express');
// const { paymentCheckout, paymentVerification } = require('../controllers/paymentController');
const auth = require('../middlewares/authMiddleware');
const { createOrder, verifyPayment, getTransaction,postTransaction } = require('../controllers/paymentControllers');
const { createOrderValidator } = require('../validators/paymentValidators');
const router = express.Router();

router.post('/create-order', createOrderValidator, auth, createOrder);
router.post('/payment-verification', verifyPayment);
router.get('/transactions', auth, getTransaction);

router.post('/success-email', auth, postTransaction);

module.exports = router;
