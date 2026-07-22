const express = require('express');
const router = express.Router();
const multiTenantWhatsAppController = require('../controllers/multiTenantWhatsAppController');
const { isAuthenticate } = require('../middlewares/auth');

// Multi-Tenant WhatsApp Routes
router.get('/status', isAuthenticate, multiTenantWhatsAppController.getMultiTenantWhatsAppStatus);
router.get('/signup-link', isAuthenticate, multiTenantWhatsAppController.generateEmbeddedSignupLink);
router.get('/callback', multiTenantWhatsAppController.handleEmbeddedSignupCallback);
router.post('/callback', isAuthenticate, multiTenantWhatsAppController.handleEmbeddedSignupCallback);
router.delete('/disconnect', isAuthenticate, multiTenantWhatsAppController.disconnectMultiTenantWhatsApp);
router.post('/send-message', isAuthenticate, multiTenantWhatsAppController.sendMultiTenantMessage);

module.exports = router;
