const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { subscribePlan, getDefaultPlan, downloadInvoice, cancelSubscription, upgradeSubscription, downgradeSubscription, getUserSubscriptions, checkDowngradeEligibility, downgradeSubscriptionNew, devAssignPackage } = require('../controllers/user.subscription.controllers');
const router = express.Router();


router.post('/subscribe', auth, subscribePlan);
router.get('/dev-assign-package', devAssignPackage);
router.get('/user-subscription', auth, getUserSubscriptions);
router.post('/upgrade', auth, upgradeSubscription);
router.post('/downgrade', auth, downgradeSubscription);
router.post('/downgrade-new', auth, downgradeSubscriptionNew);
router.post('/check-downgrade-eligibility', auth, checkDowngradeEligibility);
router.post('/cancel', auth, cancelSubscription);
router.get('/download-invoice/:orderId',  downloadInvoice);


module.exports = router