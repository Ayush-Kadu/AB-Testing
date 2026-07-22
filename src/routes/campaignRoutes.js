const express = require('express')
const auth = require('../middlewares/authMiddleware')
const isAdmin = require('../middlewares/adminMiddleware')
const { getCampaignAdmin,
    getCampaignDropdown,
    getCampaignAction,
    getCampaignTriggers,
    createNewCampaign,
    getCampaignById,
    updateCampaign,
    scriptUpdate,
    uploadFiles,
    increaseCounter,
    increaseAppear,
    checkDisplayLimit,
    campaignStat,
    getAppearances,
    getClicks,
    getCloses,
    getTotalConversions,
    getConversions,
    getEmailSubmissions,
    getTotalEmailSubmissions,
    regenerateAllActiveCampaigns,
    getActiveSMSCampaigns,
    getActiveEmailCampaigns,
    getActiveWhatsAppCampaigns,
    getSMSActivityStats,
    getEmailActivityStats,
    getSMSActivities,
    getEmailActivities,
    getWhatsAppActivityStats,
    getWhatsAppActivities,
    getABCampaigns
} = require('../controllers/campaignControllers')


const router = express.Router()


router.get('/get-campaign', auth, getCampaignAdmin)
router.get('/get-campaign-type', auth, getCampaignDropdown)
router.get('/get-campaign-action', auth, getCampaignAction)
router.get('/get-campaign-triggers', auth, getCampaignTriggers)
router.post('/create-campaign', auth, createNewCampaign)
router.get('/get-campaign/:id', auth, getCampaignById)
router.put('/update-campaign/:id', auth, updateCampaign)
router.put('/script-update/:id', auth, scriptUpdate)
router.post('/upload-file', auth, uploadFiles)
router.post('/increase-counter', increaseCounter)
router.post('/increase-appear', increaseAppear)
router.post('/check-display-limit/:campaignId', checkDisplayLimit)
router.get('/campaign-stat/:id', campaignStat)
router.get('/appearances/:campaignId', auth, getAppearances);
router.get('/clicks/:campaignId', auth, getClicks);
router.get('/closes/:campaignId', auth, getCloses);
router.get('/total/conversions/:campaignId', auth, getTotalConversions);
router.get('/conversions/:campaignId', auth, getConversions);
router.get('/email-submissions/:campaignId', auth, getEmailSubmissions);
router.get('/total/email-submissions/:campaignId', auth, getTotalEmailSubmissions);
router.post('/regenerate-all-active', auth, regenerateAllActiveCampaigns);
router.get('/get-active-sms-campaigns', getActiveSMSCampaigns);
router.get('/get-active-email-campaigns', getActiveEmailCampaigns);
router.get('/get-active-whatsapp-campaigns', getActiveWhatsAppCampaigns);
router.get('/sms-activity-stats/:campaignId', auth, getSMSActivityStats);
router.get('/email-activity-stats/:campaignId', auth, getEmailActivityStats);
router.get('/whatsapp-activity-stats/:campaignId', auth, getWhatsAppActivityStats);
router.get('/sms-activities/:campaignId', auth, getSMSActivities);
router.get('/email-activities/:campaignId', auth, getEmailActivities);
router.get('/whatsapp-activities/:campaignId', auth, getWhatsAppActivities);
router.get('/get-ab-campaigns', auth, getABCampaigns);
router.post('/get-ab-campaigns', auth, getABCampaigns);

module.exports = router