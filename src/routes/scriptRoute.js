const express = require('express')
const auth = require('../middlewares/authMiddleware')
const isAdmin = require('../middlewares/adminMiddleware')
const { getScripts, createMainScript, regenerateMainScript, sendMail, sendSMS, sendEmailCampaign, sendWhatsAppCampaign, addFormTrackingScript } = require('../controllers/scriptControllers')


const router = express.Router()

router.get('', getScripts)
router.get('/crate-main-script', createMainScript)
router.get('/regenerate-main-script', regenerateMainScript)
router.post('/send-mail', sendMail)
router.post('/send-sms', sendSMS)
router.post('/send-email-campaign', sendEmailCampaign)
router.post('/send-whatsapp', sendWhatsAppCampaign)
router.post('/add-form-tracking/:userId', addFormTrackingScript)

module.exports = router