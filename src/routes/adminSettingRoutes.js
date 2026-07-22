const express = require('express');
const auth = require('../middlewares/authMiddleware');
const router = express.Router();
const { 
    usdToInr, 
    updateGstSettings, 
    getInvoiceSeries, 
    updateInvoiceSeries, 
    freezeInvoiceSeries, 
    restartInvoiceSeries 
} = require('../controllers/adminSettingControllers');


router.post('/usd-to-inr', auth, usdToInr);
router.post('/update-gst-settings', auth, updateGstSettings);

// Invoice Series Routes
router.get('/get-invoice-series', auth, getInvoiceSeries);
router.post('/update-invoice-series', auth, updateInvoiceSeries);
router.post('/freeze-invoice-series', auth, freezeInvoiceSeries);
router.post('/restart-invoice-series', auth, restartInvoiceSeries);

module.exports = router;
