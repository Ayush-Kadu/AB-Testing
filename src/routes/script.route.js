const express = require('express');
const { getScript, 
    addCampaignType, 
    addCampaignAction,
    addCampaignTriggers,
    scriptWriteTest
} = require('../controllers/script.controller');
const router = express.Router();


router.route('/').get(getScript)
router.post('/write-script', scriptWriteTest)

router.post('/add-campaign-type', addCampaignType)
router.post('/add-campaign-action', addCampaignAction)
router.post('/add-campaign-triggers', addCampaignTriggers)

module.exports = router;