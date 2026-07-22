const express = require('express')
const authController = require("../controllers/authController")
const auth = require('../middlewares/authMiddleware')
const isAdmin = require('../middlewares/adminMiddleware')
const { userValidator } = require('../validators/userValidator');
const axios = require('axios');


const router = express.Router()


router.post('/login', authController.login)
router.get('/me', auth, authController.me)
router.post('/sign-up', authController.signUp)
router.post('/cookie-consent', auth, authController.cookieConsent)
router.get('/login-history', auth, isAdmin, authController.loginHistory)
router.put('/update/profile', auth, authController.updateUser)

router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.loginWithGoogle);

router.get('/microsoft', authController.microsoftAuth);
router.get('/microsoft/callback', authController.loginWithMicrosoft);
router.post('/microsoft/login', authController.loginWithMicrosoftToken);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// router.get("/websites", auth, authController.getUserWebsites);
router.post("/add/websites", auth, authController.addWebsite);
router.put("/websites/primary", auth, authController.makePrimaryWebsite);
router.put("/websites/deactivate", auth, authController.deactivateWebsite);
router.delete("/websites/delete", auth, authController.deleteWebsite);
router.put("/websites/push", auth, authController.pushNotificationForWebsite);
router.post("/websites/push/save-subscription", authController.savePushSubscription);
router.post("/websites/push/send-push", auth, authController.sendPushNotification);


router.get('/login-history-with-id', auth, authController.loginHistoryById);
router.post('/logout/history', auth, authController.logoutHistory);
router.post('/change-password', auth, authController.changePassword);
router.post('/delete-account', auth, authController.deleteAccount);
router.post('/active-user', authController.activeUser);
router.post('/activation-mail/:email', authController.activationMail);
router.get('/get-all-users', auth, authController.getAllUsers);
router.post('/set-timeout', auth, authController.logoutTime);
router.post('/set-auto-delete-days', auth, authController.setAutoDeletedDays);
router.get('/get-auto-delete-days', auth, authController.getAutoDeleteDays);
router.post('/complete-onboarding', auth, authController.completeOnboarding);

//sanjeev-code
router.post('/send-emailotp', authController.postEmailOtp);

// WhatsApp Configuration Routes
router.post('/whatsapp/configure', auth, authController.configureWhatsApp);
router.get('/whatsapp/config', auth, authController.getWhatsAppConfig);
router.post('/whatsapp/send-test-message', auth, authController.sendWhatsAppTestMessage);
router.delete('/whatsapp/config', auth, authController.removeWhatsAppConfig);
router.get('/whatsapp/logs', auth, authController.getWhatsAppLogs);
router.get('/whatsapp/templates', auth, authController.getWhatsAppTemplates);

// Meta WhatsApp Setup Routes
router.post('/whatsapp/meta-setup', auth, authController.setupWhatsAppMeta);
router.get('/whatsapp/templates-enhanced', auth, authController.getWhatsAppTemplatesEnhanced);

// Test endpoint to verify route is working (no auth required for testing)
router.get('/whatsapp/test', (req, res) => {
    console.log('🧪 TEST: WhatsApp test endpoint called');
    res.json({
        success: true,
        message: "WhatsApp test endpoint is working",
        timestamp: new Date().toISOString()
    });
});

// Test endpoint with auth (for authenticated testing)
router.get('/whatsapp/test-auth', auth, (req, res) => {
    console.log('🧪 TEST: WhatsApp test endpoint called with auth');
    res.json({
        success: true,
        message: "WhatsApp test endpoint is working with authentication",
        timestamp: new Date().toISOString(),
        userId: req.user._id
    });
});

// Get recipient phone numbers for testing
router.get('/whatsapp/recipients', auth, authController.getWhatsAppRecipients);

// Generate new access token
router.post('/whatsapp/generate-token', auth, authController.generateWhatsAppToken);

// Update WhatsApp data (templates, test numbers, etc.)
router.put('/whatsapp/update-data', auth, authController.updateWhatsAppData);

// Check if user can access guided setup
router.get('/whatsapp/setup-access', auth, authController.checkWhatsAppSetupAccess);

// Template Management Routes
router.post('/whatsapp/templates/create', auth, authController.createWhatsAppTemplate);
router.get('/whatsapp/templates/list', auth, authController.getWhatsAppTemplatesList);
router.delete('/whatsapp/templates/:templateName', auth, authController.deleteWhatsAppTemplate);

// Phone Number Management Routes
router.post('/whatsapp/phone-numbers/add', auth, authController.addWhatsAppPhoneNumber);
router.post('/whatsapp/phone-numbers/request-code', auth, authController.requestPhoneVerificationCode);
router.post('/whatsapp/phone-numbers/verify', auth, authController.verifyPhoneNumber);

// Multi-Tenant WhatsApp Routes
const multiTenantWhatsAppController = require('../controllers/multiTenantWhatsAppController');

// Handle OPTIONS requests for CORS preflight (must be before auth middleware)
// This allows browsers to make preflight requests without authentication
router.options('/whatsapp/multi-tenant/status', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Handle OPTIONS requests for CORS preflight (MUST be before auth middleware)
// Handle OPTIONS requests for disconnect endpoint (CORS preflight)
router.options('/whatsapp/multi-tenant/disconnect', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Handle OPTIONS requests for WABA accounts endpoint (CORS preflight)
router.options('/whatsapp/multi-tenant/waba-accounts', (req, res) => {
  const origin = req.headers.origin;
  console.log('🔧 [CORS] OPTIONS preflight for WABA accounts', { origin });
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Status endpoint - requires authentication
router.get('/whatsapp/multi-tenant/status', auth, multiTenantWhatsAppController.getMultiTenantWhatsAppStatus);
router.get('/whatsapp/multi-tenant/signup-link', auth, multiTenantWhatsAppController.generateEmbeddedSignupLink);
// Callback endpoints - GET doesn't require auth (redirect from Meta), POST requires auth (from SDK)
router.get('/whatsapp/multi-tenant/callback', multiTenantWhatsAppController.handleEmbeddedSignupCallback);
router.post('/whatsapp/multi-tenant/callback', auth, multiTenantWhatsAppController.handleEmbeddedSignupCallback);
router.delete('/whatsapp/multi-tenant/disconnect', auth, multiTenantWhatsAppController.disconnectMultiTenantWhatsApp);
router.post('/whatsapp/multi-tenant/send-message', auth, multiTenantWhatsAppController.sendMultiTenantMessage);

// Template Management Routes
router.get('/whatsapp/multi-tenant/templates/:phoneNumberId', auth, multiTenantWhatsAppController.getWhatsAppTemplates);
router.post('/whatsapp/multi-tenant/templates', auth, multiTenantWhatsAppController.createWhatsAppTemplate);
router.delete('/whatsapp/multi-tenant/templates/:templateName', auth, multiTenantWhatsAppController.deleteWhatsAppTemplate);

// Phone Number Management Routes
router.post('/whatsapp/multi-tenant/add-phone-number', auth, multiTenantWhatsAppController.addPhoneNumberToWABA);
router.post('/whatsapp/multi-tenant/subscribe-app', auth, multiTenantWhatsAppController.subscribeAppToPhoneNumber);
router.post('/whatsapp/multi-tenant/refresh-phone/:phoneNumberId', auth, multiTenantWhatsAppController.refreshPhoneDetails);
router.get('/whatsapp/multi-tenant/test-phone/:phoneNumberId', auth, multiTenantWhatsAppController.testPhoneDetails);
router.get('/whatsapp/multi-tenant/check-token', auth, multiTenantWhatsAppController.checkSystemToken);
router.get('/whatsapp/multi-tenant/setup-guidance-url', auth, multiTenantWhatsAppController.getSetupGuidanceUrl);
router.get('/whatsapp/multi-tenant/test-all-apis', auth, isAdmin, multiTenantWhatsAppController.testAllMetaGraphAPIs);
router.get('/whatsapp/multi-tenant/logs', auth, multiTenantWhatsAppController.getLogs);
// Health check endpoint for WABA accounts (no auth required for testing)
router.get('/whatsapp/multi-tenant/waba-accounts/health', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  console.log('✅ [WABA_ACCOUNTS_HEALTH] Health check endpoint hit', {
    method: req.method,
    url: req.url,
    origin: origin,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'WABA accounts endpoint is accessible',
    timestamp: new Date().toISOString()
  });
});

// Handle OPTIONS for health check
router.options('/whatsapp/multi-tenant/waba-accounts/health', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

// Test endpoint with auth (no Meta API call) - to isolate auth vs API issues
router.get('/whatsapp/multi-tenant/waba-accounts/test', auth, isAdmin, (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  console.log('✅ [WABA_ACCOUNTS_TEST] Auth test endpoint hit', {
    userId: req.user._id,
    role: req.user.role,
    timestamp: new Date().toISOString()
  });
  
  res.json({
    success: true,
    message: 'Auth and admin check passed',
    user: {
      id: req.user._id,
      role: req.user.role,
      name: req.user.name
    },
    timestamp: new Date().toISOString()
  });
});

// Handle OPTIONS for test endpoint
router.options('/whatsapp/multi-tenant/waba-accounts/test', (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  res.sendStatus(200);
});

// Get phone numbers for a specific WABA (on-demand, to avoid timeout)
router.get('/whatsapp/multi-tenant/waba-accounts/:wabaId/phone-numbers', auth, isAdmin, async (req, res) => {
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  try {
    const { wabaId } = req.params;
    const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN || 'EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag';
    
    console.log(`📞 [WABA_PHONE_NUMBERS] Fetching phone numbers for WABA ${wabaId}`);
    
    const phoneNumbersResponse = await axios.get(
      `https://graph.facebook.com/v24.0/${wabaId}/phone_numbers`,
      {
        headers: {
          'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`
        },
        params: {
          fields: 'id,display_phone_number,verified_name,quality_rating,status,code_verification_status'
        },
        timeout: 30000
      }
    );
    
    const phoneNumbers = phoneNumbersResponse.data?.data || [];
    
    res.json({
      success: true,
      wabaId: wabaId,
      phoneNumbers: phoneNumbers.map(phone => ({
        id: phone.id,
        displayNumber: phone.display_phone_number,
        verifiedName: phone.verified_name,
        qualityRating: phone.quality_rating,
        status: phone.status,
        codeVerificationStatus: phone.code_verification_status
      })),
      total: phoneNumbers.length
    });
  } catch (error) {
    console.error(`❌ [WABA_PHONE_NUMBERS] Error fetching phone numbers`, error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.error?.message || error.message || 'Failed to fetch phone numbers',
      error: error.response?.data?.error
    });
  }
});

// Get all WABA accounts (public endpoint - no auth required for debugging)
router.get('/whatsapp/multi-tenant/waba-accounts', (req, res, next) => {
  // Set CORS headers immediately
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  console.log('📥 [WABA_ACCOUNTS_ROUTE] GET request received (PUBLIC)', {
    method: req.method,
    url: req.url,
    path: req.path,
    origin: origin,
    timestamp: new Date().toISOString()
  });
  next();
}, multiTenantWhatsAppController.getAllWabaAccounts);

// WATI WhatsApp Routes
const watiWhatsAppController = require('../controllers/watiWhatsAppController');
router.get('/whatsapp/wati/config', auth, watiWhatsAppController.getWatiConfig);
router.post('/whatsapp/wati/configure', auth, watiWhatsAppController.configureWati);
router.delete('/whatsapp/wati/config', auth, watiWhatsAppController.removeWatiConfig);
router.post('/whatsapp/wati/send-message', auth, watiWhatsAppController.sendWatiMessage);
router.get('/whatsapp/wati/templates', auth, watiWhatsAppController.getWatiTemplates);

// Twilio WhatsApp Routes
const twilioWhatsAppController = require('../controllers/twilioWhatsAppController');
router.get('/whatsapp/twilio/config', auth, twilioWhatsAppController.getTwilioConfig);
router.post('/whatsapp/twilio/configure', auth, twilioWhatsAppController.configureTwilio);
router.delete('/whatsapp/twilio/config', auth, twilioWhatsAppController.removeTwilioConfig);
router.post('/whatsapp/twilio/send-message', auth, twilioWhatsAppController.sendTwilioMessage);
router.post('/whatsapp/twilio/send-media', auth, twilioWhatsAppController.sendTwilioMediaMessage);
router.get('/whatsapp/twilio/message-status/:messageId', auth, twilioWhatsAppController.getTwilioMessageStatus);

module.exports = router