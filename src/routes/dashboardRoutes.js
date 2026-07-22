const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { getVisitorLocation, getVisitorDevice, getVisitor, getConversion, getStatistics, getUniqueVisitorsSinceSignup } = require('../controllers/dashboardControllers');
const router = express.Router();

router.get('/getvisitorlocation', auth, getVisitorLocation);
router.get('/getvisitordevice', auth, getVisitorDevice);
router.get('/getvisitor', auth, getVisitor);
router.get('/getConversion', auth, getConversion);
router.get("/statistics", auth, getStatistics);
router.get("/unique-visitors-since-signup", auth, getUniqueVisitorsSinceSignup);

module.exports = router;
