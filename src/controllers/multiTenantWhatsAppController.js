const axios = require('axios');
const User = require('../models/user.model');
const multiTenantLogger = require('../utils/multiTenantWhatsAppLogger');
const { whatsappLogger } = require('../utils/whatsappLogger');

// Meta App Credentials - Use environment variables or fallback to production values
const META_APP_ID = process.env.META_APP_ID || '756959090659170';
const META_APP_SECRET = process.env.META_APP_SECRET || '8ddd26fc4ca36a38ce0fa28dbf235676';
const META_BUSINESS_ID = process.env.META_BUSINESS_ID || '933540033366513';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.mimz.com';
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN || 'EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag';

/**
 * Get Multi-Tenant WhatsApp Status
 * Check if user has connected their phone number to our WABA
 */
exports.getMultiTenantWhatsAppStatus = async (req, res, next) => {
  try {
    // Set CORS headers explicitly to ensure they're present even on errors
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    }
    
    const userId = req.user?._id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
        whatsapp: null,
        isConfigured: false
      });
    }
    
    whatsappLogger.info('MULTI_TENANT_STATUS', 'Checking multi-tenant WhatsApp status', {
      userId: userId.toString()
    });
    
    // Get user's multi-tenant WhatsApp configuration
    // IMPORTANT: We're reading from 'multiTenantWhatsApp' field, NOT 'whatsapp' field
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    
    console.log('🔍 [MULTI_TENANT_STATUS] User data from database:', {
      hasUser: !!user,
      hasMultiTenantWhatsApp: !!user?.multiTenantWhatsApp,
      isConfigured: user?.multiTenantWhatsApp?.isConfigured,
      phoneNumberId: user?.multiTenantWhatsApp?.phoneNumberId,
      displayNumber: user?.multiTenantWhatsApp?.displayNumber,
      verifiedName: user?.multiTenantWhatsApp?.verifiedName,
      wabaId: user?.multiTenantWhatsApp?.wabaId,
      status: user?.multiTenantWhatsApp?.status
    });
    
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      console.log('⚠️ [MULTI_TENANT_STATUS] User not configured or multiTenantWhatsApp not found');
      // Ensure CORS headers are set before returning
      return res.json({
        success: true,
        whatsapp: null,
        isConfigured: false
      });
    }
    
    // Return all available data, including phone details
    // IMPORTANT: Reading from user.multiTenantWhatsApp (One-Tap Connect), NOT user.whatsapp (Advanced Setup)
    const whatsappData = {
      phoneNumberId: user.multiTenantWhatsApp.phoneNumberId,
      wabaId: user.multiTenantWhatsApp.wabaId,
      displayNumber: user.multiTenantWhatsApp.displayNumber || 'Loading...',
      verifiedName: user.multiTenantWhatsApp.verifiedName || 'Loading...',
      businessName: user.multiTenantWhatsApp.verifiedName || 'Loading...', // Use verifiedName as businessName for One-Tap Connect
      qualityRating: user.multiTenantWhatsApp.qualityRating || null,
      status: user.multiTenantWhatsApp.status || 'CONNECTED',
      setupDate: user.multiTenantWhatsApp.setupDate,
      lastUpdated: user.multiTenantWhatsApp.lastUpdated,
      codeVerificationStatus: user.multiTenantWhatsApp.codeVerificationStatus || null,
      // Don't send sensitive tokens to frontend
      systemUserAccessToken: undefined
    };
    
    console.log('📤 [MULTI_TENANT_STATUS] Returning whatsapp data:', {
      phoneNumberId: whatsappData.phoneNumberId,
      displayNumber: whatsappData.displayNumber,
      verifiedName: whatsappData.verifiedName,
      wabaId: whatsappData.wabaId,
      status: whatsappData.status,
      hasDisplayNumber: !!whatsappData.displayNumber && whatsappData.displayNumber !== 'Loading...',
      hasVerifiedName: !!whatsappData.verifiedName && whatsappData.verifiedName !== 'Loading...'
    });
    
    whatsappLogger.info('MULTI_TENANT_STATUS', 'Status retrieved successfully', {
      userId: userId.toString(),
      isConfigured: true,
      hasDisplayNumber: !!whatsappData.displayNumber && whatsappData.displayNumber !== 'Loading...',
      hasVerifiedName: !!whatsappData.verifiedName && whatsappData.verifiedName !== 'Loading...'
    });
    
    // Ensure CORS headers are set before sending response (re-set to be safe)
    const responseOrigin = req.headers.origin;
    if (responseOrigin) {
      res.header('Access-Control-Allow-Origin', responseOrigin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    }
    
    console.log('📤 [MULTI_TENANT_STATUS] Sending response with CORS headers:', {
      origin: responseOrigin,
      displayNumber: whatsappData.displayNumber,
      verifiedName: whatsappData.verifiedName,
      phoneNumberId: whatsappData.phoneNumberId
    });
    
    res.json({
      success: true,
      whatsapp: whatsappData,
      isConfigured: true
    });
    
  } catch (error) {
    whatsappLogger.error('MULTI_TENANT_STATUS', 'Failed to get multi-tenant status', {
      error: error.message,
      userId: req.user?._id?.toString() || 'unknown'
    });
    return next(error);
  }
};

/**
 * Generate Embedded Signup Link
 * Creates a unique signup URL for the client to connect their phone number
 */
exports.generateEmbeddedSignupLink = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    whatsappLogger.info('EMBEDDED_SIGNUP', 'Generating embedded signup link', {
      userId: userId.toString()
    });
    
    // Check if already configured
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    if (user?.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp already configured via multi-tenant system. Please disconnect first.'
      });
    }
    
    // Configuration for Embedded Signup
    const config = {
      app_id: META_APP_ID,
      redirect_uri: `${FRONTEND_URL}/whatsapp/callback`,
      state: userId.toString(), // Track which client is signing up
      version: 'v18.0'
    };
    
    // Generate signup URL
    const signupUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${config.app_id}` +
      `&redirect_uri=${encodeURIComponent(config.redirect_uri)}` +
      `&state=${config.state}` +
      `&scope=whatsapp_business_management,whatsapp_business_messaging` +
      `&response_type=code` +
      `&display=popup`;
    
    whatsappLogger.success('EMBEDDED_SIGNUP', 'Embedded signup link generated', {
      userId: userId.toString()
    });
    
    res.json({
      success: true,
      signupUrl,
      message: 'Open this URL in a popup to start WhatsApp signup'
    });
    
  } catch (error) {
    whatsappLogger.error('EMBEDDED_SIGNUP', 'Failed to generate signup link', {
      error: error.message,
      userId: req.user._id.toString()
    });
    return next(error);
  }
};

/**
 * Handle OAuth Callback after Embedded Signup
 * This is called when Meta redirects back to our app or from Facebook SDK
 */
exports.handleEmbeddedSignupCallback = async (req, res, next) => {
  console.log('🚀 [EMBEDDED_SIGNUP_CALLBACK] ===== CALLBACK RECEIVED =====');
  console.log('📥 [EMBEDDED_SIGNUP_CALLBACK] Request details:', {
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    timestamp: new Date().toISOString()
  });
  
  // Log sanitized request data (avoid circular references in headers)
  const sanitizedHeaders = {
    'content-type': req.get('content-type'),
    'user-agent': req.get('user-agent'),
    'authorization': req.get('authorization') ? '[Present]' : '[Not Present]',
    'content-length': req.get('content-length')
  };
  
  multiTenantLogger.debug('EMBEDDED_SIGNUP_CALLBACK', 'Embedded signup callback received', {
    method: req.method,
    url: req.url,
    path: req.path,
    ip: req.ip,
    headers: sanitizedHeaders,
    query: req.query,
    body: req.body,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Handle both query parameters (redirect flow) and body parameters (SDK flow)
    const { code, state, error, error_description } = req.query;
    const { accessToken, userID, expiresIn, signedRequest, phone_number_id, waba_id, code: bodyCode } = req.body;
    
    // Prefer code from body (SDK flow) over query (redirect flow)
    // Also check for 'code' field directly in body (in case it's sent as 'code' not nested)
    const authorizationCode = bodyCode || code || req.body.code;
    
    console.log('🔑 [EMBEDDED_SIGNUP_CALLBACK] Code extraction:', {
      fromBodyCode: !!bodyCode,
      fromQueryCode: !!code,
      fromBodyDirect: !!req.body.code,
      finalCode: authorizationCode ? `${authorizationCode.substring(0, 20)}...` : 'null',
      bodyKeys: Object.keys(req.body || {}),
      timestamp: new Date().toISOString()
    });
    
    console.log('🔍 [EMBEDDED_SIGNUP_CALLBACK] Extracted parameters:');
    console.log('🔍 [EMBEDDED_SIGNUP_CALLBACK] - Query params:', {
      hasCode: !!code,
      codeLength: code?.length || 0,
      state: state,
      hasError: !!error,
      error: error,
      error_description: error_description
    });
    console.log('🔍 [EMBEDDED_SIGNUP_CALLBACK] - Body params:', {
      hasCode: !!bodyCode,
      codeLength: bodyCode?.length || 0,
      phone_number_id: phone_number_id,
      waba_id: waba_id,
      hasAccessToken: !!accessToken,
      accessTokenLength: accessToken?.length || 0,
      userID: userID,
      hasExpiresIn: !!expiresIn,
      hasSignedRequest: !!signedRequest
    });
    console.log('🔍 [EMBEDDED_SIGNUP_CALLBACK] - Final authorization code:', authorizationCode ? `${authorizationCode.substring(0, 20)}...` : 'null');
    
    // Handle error from Meta
    if (error) {
      console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] OAuth error from Meta:', {
        error: error,
        error_description: error_description,
        timestamp: new Date().toISOString()
      });
      
      whatsappLogger.error('EMBEDDED_SIGNUP_CALLBACK', 'OAuth error from Meta', {
        error,
        error_description
      });
      
      // Return JSON error for SDK flow, redirect for web flow
      if (req.body && Object.keys(req.body).length > 0) {
        console.log('📤 [EMBEDDED_SIGNUP_CALLBACK] Sending JSON error response (SDK flow)');
        return res.status(400).json({
          success: false,
          message: error_description || error
        });
      }
      
      console.log('📤 [EMBEDDED_SIGNUP_CALLBACK] Redirecting to error page (web flow)');
      return res.redirect(
        `${process.env.FRONTEND_URL}/settings?whatsapp_error=${encodeURIComponent(error_description || error)}`
      );
    }
    
    // Determine user ID from authenticated user (preferred) or state parameter
    // The POST request should have authenticated user, GET request uses state
    let userId = null;
    
    if (req.user?._id) {
      // Authenticated request (POST from SDK)
      userId = req.user._id;
      console.log('👤 [EMBEDDED_SIGNUP_CALLBACK] User ID from authenticated request:', userId.toString());
    } else if (state) {
      // Unauthenticated request (GET redirect) - use state
      userId = state;
      console.log('👤 [EMBEDDED_SIGNUP_CALLBACK] User ID from state parameter:', userId);
    } else {
      // No user ID available
      console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] No user ID available - neither authenticated user nor state parameter');
      return res.status(400).json({
        success: false,
        message: 'User ID is required. Please ensure you are logged in or the state parameter is provided.'
      });
    }
    
    // Ensure userId is a valid ObjectId or string
    if (!userId) {
      console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Invalid user ID:', userId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }
    
    console.log('👤 [EMBEDDED_SIGNUP_CALLBACK] Final User ID determined:', {
      userId: userId.toString(),
      fromState: state,
      fromUser: req.user?._id?.toString(),
      isAuthenticated: !!req.user,
      timestamp: new Date().toISOString()
    });
    
    // Handle embedded signup flow (direct phone_number_id and waba_id)
    if (phone_number_id && waba_id) {
      console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Embedded signup data received:', {
        phone_number_id: phone_number_id,
        waba_id: waba_id,
        hasCode: !!authorizationCode,
        userId: userId,
        timestamp: new Date().toISOString()
      });
      
      multiTenantLogger.embeddedSignupStart(userId, { phone_number_id, waba_id, hasCode: !!authorizationCode });
      
      try {
        let systemUserAccessToken = META_SYSTEM_USER_TOKEN;
        
        // If we have a code, exchange it for System User access token
        // Define redirectUri outside the if block so it's accessible in catch block
        const redirectUri = FRONTEND_URL ? `${FRONTEND_URL}/whatsapp/callback` : 'https://app.mimz.com/whatsapp/callback';
        
        if (authorizationCode) {
          console.log('🔄 [EMBEDDED_SIGNUP_CALLBACK] Starting code exchange process...', {
            codeLength: authorizationCode.length,
            codePreview: authorizationCode.substring(0, 20) + '...',
            redirectUri: redirectUri,
            timestamp: new Date().toISOString()
          });
          
          try {
            multiTenantLogger.info('CODE_EXCHANGE', 'Exchanging authorization code for System User access token', {
              userId,
              hasCode: true
            });
            
            // Exchange code for System User access token
            // IMPORTANT: redirect_uri must EXACTLY match what's configured in Meta App OAuth settings
            // For embedded signup, this should be the redirect URI configured in Meta Dashboard
            
            console.log('🔄 [EMBEDDED_SIGNUP_CALLBACK] Code exchange parameters:', {
              client_id: META_APP_ID,
              hasClientSecret: !!META_APP_SECRET,
              codeLength: authorizationCode.length,
              redirect_uri: redirectUri,
              timestamp: new Date().toISOString()
            });
            
            // For embedded signup with config_id, Meta uses its own internal redirect URI
            // The redirect_uri must match EXACTLY what Meta used in the OAuth dialog
            // For embedded signup, Meta typically uses: https://staticxx.facebook.com/x/connect/xd_arbiter/...
            // OR the redirect URI configured in Meta App OAuth settings
            // We'll try multiple approaches:
            
            let tokenResponse;
            let exchangeMethod = 'unknown';
            
            // Method 1: Try without redirect_uri (some embedded signup flows don't require it)
            try {
              console.log('🔄 [EMBEDDED_SIGNUP_CALLBACK] Attempting code exchange without redirect_uri (Method 1)...');
              tokenResponse = await axios.post(
                'https://graph.facebook.com/v24.0/oauth/access_token',
                null,
                {
                  params: {
                    client_id: META_APP_ID,
                    client_secret: META_APP_SECRET,
                    code: authorizationCode
                  }
                }
              );
              exchangeMethod = 'without_redirect_uri';
              console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Code exchange successful without redirect_uri');
            } catch (noRedirectError) {
              console.log('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Method 1 failed, trying with redirect_uri...');
              
              // Method 2: Try with our configured redirect_uri
              try {
                console.log('🔄 [EMBEDDED_SIGNUP_CALLBACK] Attempting code exchange with configured redirect_uri (Method 2)...');
                tokenResponse = await axios.post(
              'https://graph.facebook.com/v24.0/oauth/access_token',
              null,
              {
                params: {
                  client_id: META_APP_ID,
                  client_secret: META_APP_SECRET,
                  code: authorizationCode,
                      redirect_uri: redirectUri
                    }
                  }
                );
                exchangeMethod = 'with_configured_redirect_uri';
                console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Code exchange successful with configured redirect_uri');
              } catch (withRedirectError) {
                // Method 3: Try with Meta's static callback (for embedded signup)
                console.log('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Method 2 failed, trying with Meta static callback (Method 3)...');
                const metaStaticCallback = 'https://staticxx.facebook.com/x/connect/xd_arbiter';
                try {
                  tokenResponse = await axios.post(
                    'https://graph.facebook.com/v24.0/oauth/access_token',
                    null,
                    {
                      params: {
                        client_id: META_APP_ID,
                        client_secret: META_APP_SECRET,
                        code: authorizationCode,
                        redirect_uri: metaStaticCallback
                      }
                    }
                  );
                  exchangeMethod = 'with_meta_static_callback';
                  console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Code exchange successful with Meta static callback');
                } catch (staticError) {
                  // All methods failed - throw the original error with details
                  console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] All code exchange methods failed');
                  throw withRedirectError; // Throw the error from Method 2 (most relevant)
                }
              }
            }
            
            console.log('📝 [EMBEDDED_SIGNUP_CALLBACK] Code exchange method used:', exchangeMethod);
            
            console.log('📥 [EMBEDDED_SIGNUP_CALLBACK] Token exchange response received:', {
              hasAccessToken: !!tokenResponse.data?.access_token,
              accessTokenLength: tokenResponse.data?.access_token?.length || 0,
              hasExpiresIn: !!tokenResponse.data?.expires_in,
              expiresIn: tokenResponse.data?.expires_in,
              tokenType: tokenResponse.data?.token_type,
              timestamp: new Date().toISOString()
            });
            
            if (tokenResponse.data?.access_token) {
              systemUserAccessToken = tokenResponse.data.access_token;
              console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Code exchange successful, using new access token');
              multiTenantLogger.success('CODE_EXCHANGE', 'Successfully exchanged code for access token', {
                userId,
                tokenLength: systemUserAccessToken.length,
                tokenPreview: systemUserAccessToken.substring(0, 20) + '...',
                expiresIn: tokenResponse.data?.expires_in,
                tokenType: tokenResponse.data?.token_type,
                source: 'code_exchange'
              });
            } else {
              console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Token response missing access_token, using system token');
            }
          } catch (tokenError) {
            const errorDetails = {
              message: tokenError.message,
              response: tokenError.response?.data,
              status: tokenError.response?.status,
              statusText: tokenError.response?.statusText,
              errorCode: tokenError.response?.data?.error?.code,
              errorSubcode: tokenError.response?.data?.error?.error_subcode,
              errorType: tokenError.response?.data?.error?.type,
              errorMessage: tokenError.response?.data?.error?.message,
              fbtrace_id: tokenError.response?.data?.error?.fbtrace_id,
              redirectUriUsed: redirectUri,
              timestamp: new Date().toISOString()
            };
            
            console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Code exchange failed:', errorDetails);
            
            // Check for common errors
            if (tokenError.response?.data?.error?.error_subcode === 1348131) {
              console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Redirect URI mismatch! The redirect_uri used in code exchange must EXACTLY match the one configured in Meta App OAuth settings.');
              console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Current redirect_uri:', redirectUri);
              console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Please verify in Meta Dashboard → Settings → Basic → Valid OAuth Redirect URIs');
            }
            
            multiTenantLogger.error('CODE_EXCHANGE', 'Failed to exchange code for token', {
              error: errorDetails,
              userId,
              redirectUriUsed: redirectUri,
              metaApiError: errorDetails.errorMessage ? {
                message: errorDetails.errorMessage,
                type: errorDetails.errorType,
                code: errorDetails.errorCode,
                error_subcode: errorDetails.errorSubcode,
                fbtrace_id: errorDetails.fbtrace_id
              } : null,
              httpStatus: errorDetails.status,
              httpStatusText: errorDetails.statusText
            });
            // Continue with existing system user token if code exchange fails
            console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Using existing system user token as fallback');
          }
        } else {
          console.log('ℹ️ [EMBEDDED_SIGNUP_CALLBACK] No authorization code provided, using system user token');
        }
        
        // Save to database
        console.log('💾 [EMBEDDED_SIGNUP_CALLBACK] Saving embedded signup data to database...', {
          userId: userId,
          phoneNumberId: phone_number_id,
          wabaId: waba_id,
          hasAccessToken: !!systemUserAccessToken,
          accessTokenLength: systemUserAccessToken?.length || 0,
          timestamp: new Date().toISOString()
        });
        
        multiTenantLogger.info('DATABASE_SAVE', 'Saving embedded signup data to database', {
          userId,
          phoneNumberId: phone_number_id,
          wabaId: waba_id,
          hasAccessToken: !!systemUserAccessToken
        });
        
        const updateData = {
          multiTenantWhatsApp: {
            isConfigured: true,
            phoneNumberId: phone_number_id,
            wabaId: waba_id,
            status: 'CONNECTED',
            setupDate: new Date(),
            lastUpdated: new Date(),
            ...(systemUserAccessToken && { systemUserAccessToken })
          }
        };
        
        console.log('📝 [EMBEDDED_SIGNUP_CALLBACK] Database update payload:', {
          isConfigured: updateData.multiTenantWhatsApp.isConfigured,
          phoneNumberId: updateData.multiTenantWhatsApp.phoneNumberId,
          wabaId: updateData.multiTenantWhatsApp.wabaId,
          status: updateData.multiTenantWhatsApp.status,
          hasSystemUserAccessToken: !!updateData.multiTenantWhatsApp.systemUserAccessToken
        });
        
        const dbResult = await User.findByIdAndUpdate(userId, updateData, { new: true });
        
        console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Database update successful:', {
          userId: userId,
          hasResult: !!dbResult,
          isConfigured: dbResult?.multiTenantWhatsApp?.isConfigured,
          timestamp: new Date().toISOString()
        });
        
        multiTenantLogger.databaseUpdate(userId, 'SAVE', true, {
          phoneNumberId: phone_number_id,
          wabaId: waba_id,
          status: 'CONNECTED'
        });
        
        // 🚀 AUTOMATIC PHONE NUMBER REGISTRATION
        // Register phone number immediately after embedded signup to ensure instant connection
        // This prevents PENDING status and Setup Guidance errors
        console.log('📞 [EMBEDDED_SIGNUP_CALLBACK] Starting automatic phone number registration...');
        
        // Helper function to wait for CONNECTED status
        const waitForConnectedStatus = async (maxWaitSeconds = 30) => {
          console.log(`⏳ [EMBEDDED_SIGNUP_CALLBACK] Waiting for phone number to become CONNECTED (max ${maxWaitSeconds}s)...`);
          const startTime = Date.now();
          const checkInterval = 2000; // Check every 2 seconds
          
          while (Date.now() - startTime < maxWaitSeconds * 1000) {
            try {
              const statusCheck = await axios.get(
                `https://graph.facebook.com/v22.0/${phone_number_id}`,
                {
                  headers: { 'Authorization': `Bearer ${systemUserAccessToken}` },
                  params: { fields: 'status' },
                  timeout: 10000
                }
              );
              
              if (statusCheck.data?.status === 'CONNECTED') {
                console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Phone number is now CONNECTED!');
                return true;
              }
              console.log(`⏳ [EMBEDDED_SIGNUP_CALLBACK] Status: ${statusCheck.data?.status || 'UNKNOWN'}, waiting...`);
            } catch (err) {
              console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Status check failed:', err.message);
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
          }
          return false;
        };
        
        try {
          // Use a default PIN - you can customize this or store per-user PINs
          const defaultPin = '123456'; // TODO: Consider generating/storing unique PINs per user
          
          // Step 0: Check current status and wait if PENDING
          try {
            const initialStatusCheck = await axios.get(
              `https://graph.facebook.com/v22.0/${phone_number_id}`,
              {
                headers: { 'Authorization': `Bearer ${systemUserAccessToken}` },
                params: { fields: 'status' },
                timeout: 10000
              }
            );
            
            if (initialStatusCheck.data?.status === 'PENDING') {
              console.log('⏳ [EMBEDDED_SIGNUP_CALLBACK] Phone number is PENDING, waiting for CONNECTED status...');
              const becameConnected = await waitForConnectedStatus(30);
              if (!becameConnected) {
                console.log('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Phone number still PENDING after wait, attempting registration anyway...');
              }
            }
          } catch (statusCheckError) {
            console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Could not check initial status, proceeding with registration:', statusCheckError.message);
          }
          
          console.log('📞 [EMBEDDED_SIGNUP_CALLBACK] Registering phone number with Meta API...', {
            phoneNumberId: phone_number_id,
            pin: defaultPin,
            timestamp: new Date().toISOString()
          });
          
          // Step 1: Register phone number
          const registerResponse = await axios.post(
            `https://graph.facebook.com/v22.0/${phone_number_id}/register`,
            {
              messaging_product: 'whatsapp',
              pin: defaultPin
            },
            {
              headers: {
                'Authorization': `Bearer ${systemUserAccessToken}`,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );
          
          console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Phone number registration successful:', {
            phoneNumberId: phone_number_id,
            userId: userId.toString(),
            response: registerResponse.data,
            timestamp: new Date().toISOString()
          });
          
          multiTenantLogger.info('AUTO_REGISTER', 'Phone number automatically registered', {
            userId,
            phoneNumberId: phone_number_id,
            success: true
          });
          
          // Step 2: Wait a moment for Meta to process the registration
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Step 3: Fetch actual phone number status from Meta API to get real-time status
          console.log('🔍 [EMBEDDED_SIGNUP_CALLBACK] Fetching phone number status from Meta API...');
          const phoneStatusResponse = await axios.get(
            `https://graph.facebook.com/v22.0/${phone_number_id}`,
            {
              headers: {
                'Authorization': `Bearer ${systemUserAccessToken}`
              },
              params: {
                fields: 'id,display_phone_number,verified_name,status,code_verification_status,quality_rating'
              },
              timeout: 30000
            }
          );
          
          const phoneData = phoneStatusResponse.data;
          console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Phone status from Meta API:', {
            status: phoneData.status,
            codeVerificationStatus: phoneData.code_verification_status,
            displayNumber: phoneData.display_phone_number,
            verifiedName: phoneData.verified_name,
            qualityRating: phoneData.quality_rating
          });
          
          // Step 4: Update database with actual status from Meta API
          await User.findByIdAndUpdate(userId, {
            $set: {
              'multiTenantWhatsApp.status': phoneData.status || 'CONNECTED',
              'multiTenantWhatsApp.displayNumber': phoneData.display_phone_number,
              'multiTenantWhatsApp.verifiedName': phoneData.verified_name,
              'multiTenantWhatsApp.codeVerificationStatus': phoneData.code_verification_status,
              'multiTenantWhatsApp.qualityRating': phoneData.quality_rating,
              'multiTenantWhatsApp.lastUpdated': new Date()
            }
          });
          
          console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Database updated with Meta API status:', {
            status: phoneData.status || 'CONNECTED',
            userId: userId.toString(),
            timestamp: new Date().toISOString()
          });
          
          // Step 5: Automatically subscribe app to phone number for webhooks
          try {
            console.log('📱 [EMBEDDED_SIGNUP_CALLBACK] Subscribing app to phone number...');
            await axios.post(
              `https://graph.facebook.com/v22.0/${phone_number_id}/subscribed_apps`,
              {},
              {
                headers: {
                  'Authorization': `Bearer ${systemUserAccessToken}`,
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              }
            );
            
            console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] App subscribed to phone number successfully');
            multiTenantLogger.info('AUTO_SUBSCRIBE', 'App automatically subscribed to phone number', {
              userId,
              phoneNumberId: phone_number_id,
              success: true
            });
          } catch (subscribeError) {
            // Subscription failure is not critical - can be done manually later
            console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Auto-subscribe failed (non-critical):', {
              error: subscribeError.response?.data?.error?.message || subscribeError.message,
              note: 'Can be done manually via Subscribe App button'
            });
          }
          
        } catch (registerError) {
          // Registration failure - check if it's due to PENDING status
          const isPendingError = registerError.response?.data?.error?.error_data?.details?.includes('pending');
          const errorMessage = registerError.response?.data?.error?.message || registerError.message;
          
          console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Automatic registration failed:', {
            phoneNumberId: phone_number_id,
            userId: userId.toString(),
            error: errorMessage,
            errorCode: registerError.response?.data?.error?.code,
            errorType: registerError.response?.data?.error?.type,
            fbtrace_id: registerError.response?.data?.error?.fbtrace_id,
            isPendingError: isPendingError,
            timestamp: new Date().toISOString()
          });
          
          multiTenantLogger.error('AUTO_REGISTER', 'Phone number auto-registration failed', {
            userId,
            phoneNumberId: phone_number_id,
            error: errorMessage,
            errorCode: registerError.response?.data?.error?.code,
            errorType: registerError.response?.data?.error?.type,
            isPendingError: isPendingError
          });
          
          // If it's a PENDING error, try waiting and retrying once
          if (isPendingError) {
            console.log('🔄 [EMBEDDED_SIGNUP_CALLBACK] PENDING error detected, waiting and retrying registration...');
            const becameConnected = await waitForConnectedStatus(30);
            
            if (becameConnected) {
              try {
                console.log('🔄 [EMBEDDED_SIGNUP_CALLBACK] Retrying registration after status became CONNECTED...');
                const retryResponse = await axios.post(
                  `https://graph.facebook.com/v22.0/${phone_number_id}/register`,
                  {
                    messaging_product: 'whatsapp',
                    pin: '123456'
                  },
                  {
                    headers: {
                      'Authorization': `Bearer ${systemUserAccessToken}`,
                      'Content-Type': 'application/json'
                    },
                    timeout: 30000
                  }
                );
                
                console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Retry registration successful!');
                
                // Fetch and update status after successful retry
                const phoneStatusResponse = await axios.get(
                  `https://graph.facebook.com/v22.0/${phone_number_id}`,
                  {
                    headers: { 'Authorization': `Bearer ${systemUserAccessToken}` },
                    params: { fields: 'id,display_phone_number,verified_name,status,code_verification_status,quality_rating' },
                    timeout: 30000
                  }
                );
                
                await User.findByIdAndUpdate(userId, {
                  $set: {
                    'multiTenantWhatsApp.status': phoneStatusResponse.data.status || 'CONNECTED',
                    'multiTenantWhatsApp.displayNumber': phoneStatusResponse.data.display_phone_number,
                    'multiTenantWhatsApp.verifiedName': phoneStatusResponse.data.verified_name,
                    'multiTenantWhatsApp.codeVerificationStatus': phoneStatusResponse.data.code_verification_status,
                    'multiTenantWhatsApp.qualityRating': phoneStatusResponse.data.quality_rating,
                    'multiTenantWhatsApp.lastUpdated': new Date()
                  }
                });
                
                console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Database updated after retry');
                return; // Success, exit early
              } catch (retryError) {
                console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Retry registration also failed:', retryError.response?.data?.error?.message || retryError.message);
              }
            }
          }
          
          // Set status to PENDING if registration fails - user can retry via Setup Guidance
          await User.findByIdAndUpdate(userId, {
            $set: {
              'multiTenantWhatsApp.status': 'PENDING',
              'multiTenantWhatsApp.lastUpdated': new Date()
            }
          });
          
          console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Status set to PENDING - user can complete via Setup Guidance');
        }
        
        // Fetch the latest user data after registration to get the actual status
        // IMPORTANT: Reading from multiTenantWhatsApp field, NOT whatsapp field
        const userWithDetails = await User.findById(userId).select('multiTenantWhatsApp');
        const actualStatus = userWithDetails?.multiTenantWhatsApp?.status || 'CONNECTED';
        const hasPhoneDetails = userWithDetails?.multiTenantWhatsApp?.displayNumber && 
                                userWithDetails?.multiTenantWhatsApp?.displayNumber !== 'Loading...' &&
                                userWithDetails?.multiTenantWhatsApp?.verifiedName &&
                                userWithDetails?.multiTenantWhatsApp?.verifiedName !== 'Loading...';
        
        console.log('🔍 [EMBEDDED_SIGNUP_CALLBACK] Final phone details after registration:', {
          hasPhoneDetails,
          actualStatus,
          displayNumber: userWithDetails?.multiTenantWhatsApp?.displayNumber,
          verifiedName: userWithDetails?.multiTenantWhatsApp?.verifiedName,
          phoneNumberId: userWithDetails?.multiTenantWhatsApp?.phoneNumberId,
          codeVerificationStatus: userWithDetails?.multiTenantWhatsApp?.codeVerificationStatus
        });
        
        // Return success response - include phone details if available, otherwise show "Loading..."
        // IMPORTANT: This is for One-Tap WhatsApp Connect, so we read from multiTenantWhatsApp
        // Use the actual status from database (CONNECTED or PENDING) after registration attempt
        const responseData = {
          success: true,
          message: actualStatus === 'CONNECTED'
            ? (hasPhoneDetails 
            ? 'WhatsApp connected successfully!'
                : 'WhatsApp connected successfully! Phone details are being fetched...')
            : 'WhatsApp signup completed! Phone number registration is in progress. Please wait a moment and refresh status.',
          whatsapp: {
            phoneNumberId: phone_number_id,
            wabaId: waba_id,
            status: actualStatus, // Use actual status from database (CONNECTED or PENDING)
            displayNumber: hasPhoneDetails 
              ? userWithDetails.multiTenantWhatsApp.displayNumber 
              : 'Loading...',
            verifiedName: hasPhoneDetails 
              ? userWithDetails.multiTenantWhatsApp.verifiedName 
              : 'Loading...',
            businessName: hasPhoneDetails 
              ? userWithDetails.multiTenantWhatsApp.verifiedName 
              : 'Loading...', // Use verifiedName as businessName for One-Tap Connect
            qualityRating: hasPhoneDetails 
              ? userWithDetails.multiTenantWhatsApp.qualityRating 
              : null,
            codeVerificationStatus: hasPhoneDetails 
              ? userWithDetails.multiTenantWhatsApp.codeVerificationStatus 
              : null
          }
        };
        
        console.log('📤 [EMBEDDED_SIGNUP_CALLBACK] Response data prepared:', {
          hasPhoneDetails,
          displayNumber: responseData.whatsapp.displayNumber,
          verifiedName: responseData.whatsapp.verifiedName,
          businessName: responseData.whatsapp.businessName,
          phoneNumberId: responseData.whatsapp.phoneNumberId,
          wabaId: responseData.whatsapp.wabaId
        });
        
        console.log('📤 [EMBEDDED_SIGNUP_CALLBACK] Sending success response:', {
          success: responseData.success,
          phoneNumberId: responseData.whatsapp.phoneNumberId,
          wabaId: responseData.whatsapp.wabaId,
          status: responseData.whatsapp.status,
          timestamp: new Date().toISOString()
        });
        
        // Start background job to fetch phone details
        // We'll wait up to 2 seconds for it to complete so we can include phone details in the response
        // This avoids the need for the frontend to fetch status (which is blocked by 504 timeout)
        console.log('🔄 [EMBEDDED_SIGNUP_CALLBACK] Starting background job to fetch phone details...');
        
        let backgroundJobCompleted = false;
        let backgroundJobPhoneData = null;
        
        // Start background job as a promise so we can wait for it
        const backgroundJobPromise = (async () => {
          try {
            console.log('🔍 [EMBEDDED_SIGNUP_CALLBACK] Background job: Fetching phone details from Meta API...', {
              phoneNumberId: phone_number_id,
              userId: userId,
              timestamp: new Date().toISOString()
            });
            
            multiTenantLogger.backgroundJobStart(phone_number_id, userId);
            
            multiTenantLogger.backgroundJobStart(phone_number_id, userId);
            
            // Get user to retrieve system user token (either from env or saved in DB)
            const userWithToken = await User.findById(userId).select('multiTenantWhatsApp');
            const accessToken = userWithToken?.multiTenantWhatsApp?.systemUserAccessToken || META_SYSTEM_USER_TOKEN;
            const tokenSource = userWithToken?.multiTenantWhatsApp?.systemUserAccessToken ? 'database' : 'environment';
            
            // Create system token info object for logging
            const systemTokenInfo = {
              source: tokenSource,
              token: accessToken,
              hasToken: !!accessToken,
              tokenLength: accessToken?.length || 0,
              tokenPreview: accessToken ? accessToken.substring(0, 20) + '...' : 'none',
              isFromCodeExchange: false, // Will be updated if from code exchange
              isFromDatabase: tokenSource === 'database',
              isFromEnvironment: tokenSource === 'environment'
            };
            
            // Log system token info at start of background job
            multiTenantLogger.info('SYSTEM_TOKEN_INFO', 'System User Token information for background job', systemTokenInfo);
            
            console.log('🔑 [EMBEDDED_SIGNUP_CALLBACK] Background job: Using access token:', {
              hasToken: !!accessToken,
              tokenLength: accessToken?.length || 0,
              source: tokenSource,
              phoneNumberId: phone_number_id,
              wabaId: waba_id,
              timestamp: new Date().toISOString()
            });
            
            // Log system token info
            multiTenantLogger.info('SYSTEM_TOKEN_INFO', 'System User Token information for background job', systemTokenInfo);
            
            let phoneData = null;
            
            // Try Method 1: Direct phone number access
            try {
              console.log('📞 [EMBEDDED_SIGNUP_CALLBACK] Background job: Attempting direct phone number fetch...');
            const phoneResponse = await axios.get(
              `https://graph.facebook.com/v24.0/${phone_number_id}`,
              {
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                },
                params: {
                  fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,name,status'
                }
              }
            );
            
              phoneData = phoneResponse.data;
              console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Background job: Phone details fetched directly:', {
                displayNumber: phoneData.display_phone_number,
                verifiedName: phoneData.verified_name || phoneData.name,
                qualityRating: phoneData.quality_rating,
                status: phoneData.status,
                timestamp: new Date().toISOString()
              });
            } catch (directError) {
              const directErrorDetails = {
                message: directError.response?.data?.error?.message || directError.message,
                errorCode: directError.response?.data?.error?.code,
                errorSubcode: directError.response?.data?.error?.error_subcode,
                errorType: directError.response?.data?.error?.type,
                fbtrace_id: directError.response?.data?.error?.fbtrace_id,
                status: directError.response?.status,
                statusText: directError.response?.statusText
              };
              
              console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Background job: Direct phone fetch failed, trying via WABA:', directErrorDetails);
              
              // Try Method 2: Fetch via WABA ID's phone_numbers endpoint
              if (waba_id) {
                try {
                  console.log('📞 [EMBEDDED_SIGNUP_CALLBACK] Background job: Attempting phone fetch via WABA phone_numbers endpoint...');
                  const wabaResponse = await axios.get(
                    `https://graph.facebook.com/v24.0/${waba_id}/phone_numbers`,
                    {
                      headers: {
                        'Authorization': `Bearer ${accessToken}`
                      },
                      params: {
                        fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,name,status'
                      }
                    }
                  );
                  
                  // Find the phone number that matches our phone_number_id
                  const phoneNumbers = wabaResponse.data?.data || [];
                  const matchingPhone = phoneNumbers.find((phone) => phone.id === phone_number_id || phone.id === String(phone_number_id));
                  
                  if (matchingPhone) {
                    phoneData = matchingPhone;
                    console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Background job: Phone details fetched via WABA:', {
                      displayNumber: phoneData.display_phone_number,
                      verifiedName: phoneData.verified_name || phoneData.name,
                      qualityRating: phoneData.quality_rating,
                      status: phoneData.status,
                      timestamp: new Date().toISOString()
                    });
                  } else {
                    console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Background job: Phone number not found in WABA phone_numbers list:', {
                      phoneNumberId: phone_number_id,
                      foundPhones: phoneNumbers.length,
                      phoneIds: phoneNumbers.map((p) => p.id),
                      timestamp: new Date().toISOString()
                    });
                    // Store the direct error for logging
                    throw new Error(`Phone number ${phone_number_id} not found in WABA ${waba_id}. Direct error: ${directErrorDetails.message}`);
                  }
                } catch (wabaError) {
                  const wabaErrorDetails = {
                    message: wabaError.response?.data?.error?.message || wabaError.message,
                    errorCode: wabaError.response?.data?.error?.code,
                    errorSubcode: wabaError.response?.data?.error?.error_subcode,
                    errorType: wabaError.response?.data?.error?.type,
                    fbtrace_id: wabaError.response?.data?.error?.fbtrace_id,
                    status: wabaError.response?.status,
                    statusText: wabaError.response?.statusText
                  };
                  
                  console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Background job: WABA phone_numbers fetch also failed:', wabaErrorDetails);
                  
                  // Combine both errors for comprehensive logging
                  throw {
                    ...directError,
                    directError: directErrorDetails,
                    wabaError: wabaErrorDetails,
                    message: `Both direct and WABA fetch failed. Direct: ${directErrorDetails.message}, WABA: ${wabaErrorDetails.message}`
                  };
                }
              } else {
                // No WABA ID, re-throw direct error
                throw directError;
              }
            }
            
            // Update database if we got phone data
            if (phoneData) {
              console.log('💾 [EMBEDDED_SIGNUP_CALLBACK] Background job: Updating database with phone details...');
              
              // Use $set to ensure proper update
              const updateResult = await User.findByIdAndUpdate(
                userId,
                {
                  $set: {
                    'multiTenantWhatsApp.displayNumber': phoneData.display_phone_number || null,
                    'multiTenantWhatsApp.verifiedName': phoneData.verified_name || phoneData.name || null,
                    'multiTenantWhatsApp.qualityRating': phoneData.quality_rating || null,
                    'multiTenantWhatsApp.codeVerificationStatus': phoneData.code_verification_status || null,
                    'multiTenantWhatsApp.status': phoneData.status || 'CONNECTED',
                    'multiTenantWhatsApp.lastUpdated': new Date()
                  }
                },
                { new: true } // Return updated document
              );
              
              console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Background job: Database updated successfully:', {
                hasResult: !!updateResult,
                displayNumber: updateResult?.multiTenantWhatsApp?.displayNumber,
                verifiedName: updateResult?.multiTenantWhatsApp?.verifiedName,
                timestamp: new Date().toISOString()
            });
            
            multiTenantLogger.databaseUpdate(userId, 'UPDATE_PHONE_DETAILS', true, {
                displayNumber: phoneData.display_phone_number,
                verifiedName: phoneData.verified_name || phoneData.name,
                qualityRating: phoneData.quality_rating,
                status: phoneData.status
              });
              
              multiTenantLogger.backgroundJobSuccess(phone_number_id, userId, phoneData);
              
              // Set flag and data for response inclusion
              backgroundJobCompleted = true;
              backgroundJobPhoneData = {
                displayNumber: phoneData.display_phone_number || null,
                verifiedName: phoneData.verified_name || phoneData.name || null,
                businessName: phoneData.verified_name || phoneData.name || null,
                qualityRating: phoneData.quality_rating || null,
                codeVerificationStatus: phoneData.code_verification_status || null,
                status: phoneData.status || 'CONNECTED'
              };
            } else {
              // This should not happen if errors are properly thrown, but keep as safety net
              const errorDetails = {
                message: 'Phone details could not be fetched, but configuration is saved successfully',
                phoneNumberId: phone_number_id,
                wabaId: waba_id,
                accessTokenSource: userWithToken?.multiTenantWhatsApp?.systemUserAccessToken ? 'database' : 'environment',
                hasAccessToken: !!accessToken,
                accessTokenLength: accessToken?.length || 0,
                directFetchAttempted: true,
                wabaFetchAttempted: !!waba_id,
                possibleReasons: [
                  'Access token does not have permission to access this phone number',
                  'Phone number ID does not exist or is incorrect',
                  'WABA ID does not match the phone number',
                  'System User Token needs additional permissions'
                ]
              };
              
              console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Background job: Could not fetch phone details, but setup is still successful:', errorDetails);
              
              multiTenantLogger.backgroundJobError(phone_number_id, userId, errorDetails, systemTokenInfo);
            }
            
          } catch (phoneError) {
            // Enhanced error logging - handle both Error objects and plain objects
            let errorDetails;
            
            if (phoneError instanceof Error) {
              // Standard Error object
              errorDetails = {
                message: phoneError.message,
                name: phoneError.name,
                code: phoneError.code,
                response: phoneError.response?.data ? {
                  error: phoneError.response.data.error,
                  errorMessage: phoneError.response.data.error?.message,
                  errorType: phoneError.response.data.error?.type,
                  errorCode: phoneError.response.data.error?.code,
                  errorSubcode: phoneError.response.data.error?.error_subcode,
                  fbtrace_id: phoneError.response.data.error?.fbtrace_id
                } : null,
                status: phoneError.response?.status,
                statusText: phoneError.response?.statusText,
                directError: phoneError.directError,
                wabaError: phoneError.wabaError,
                stack: phoneError.stack?.split('\n').slice(0, 5).join('\n')
              };
            } else if (phoneError && typeof phoneError === 'object') {
              // Plain error object (from our custom throw)
              errorDetails = {
                message: phoneError.message || 'Unknown error',
                ...phoneError,
                response: phoneError.response?.data || phoneError.response,
                status: phoneError.status || phoneError.response?.status
              };
            } else {
              // Fallback
              errorDetails = {
                message: String(phoneError) || 'Unknown error',
                error: phoneError
              };
            }
            
            console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Background job: Unexpected error in phone details fetch:', errorDetails);
            
            // Include system token info in error log (use existing if available, otherwise create)
            const systemTokenInfoForError = systemTokenInfo || {
              source: userWithToken?.multiTenantWhatsApp?.systemUserAccessToken ? 'database' : 'environment',
              token: accessToken || META_SYSTEM_USER_TOKEN,
              hasToken: !!accessToken,
              tokenLength: (accessToken || META_SYSTEM_USER_TOKEN)?.length || 0,
              tokenPreview: (accessToken || META_SYSTEM_USER_TOKEN) ? (accessToken || META_SYSTEM_USER_TOKEN).substring(0, 20) + '...' : 'none'
            };
            
            multiTenantLogger.backgroundJobError(phone_number_id, userId, errorDetails, systemTokenInfoForError);
          }
        })();
        
        // Wait up to 2 seconds for background job to complete
        // This allows us to include phone details in the initial response
        // If it doesn't complete in time, we'll send "Loading..." and let it continue in background
        try {
          await Promise.race([
            backgroundJobPromise,
            new Promise(resolve => setTimeout(resolve, 2000)) // 2 second timeout
          ]);
          
          // If background job completed and we have phone data, update response
          if (backgroundJobCompleted && backgroundJobPhoneData) {
            console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] Background job completed quickly, updating response with phone details:', {
              displayNumber: backgroundJobPhoneData.displayNumber,
              verifiedName: backgroundJobPhoneData.verifiedName,
              businessName: backgroundJobPhoneData.businessName
            });
            
            responseData.whatsapp.displayNumber = backgroundJobPhoneData.displayNumber || 'Loading...';
            responseData.whatsapp.verifiedName = backgroundJobPhoneData.verifiedName || 'Loading...';
            responseData.whatsapp.businessName = backgroundJobPhoneData.businessName || 'Loading...';
            responseData.whatsapp.qualityRating = backgroundJobPhoneData.qualityRating || null;
            responseData.whatsapp.codeVerificationStatus = backgroundJobPhoneData.codeVerificationStatus || null;
            responseData.whatsapp.status = backgroundJobPhoneData.status || 'CONNECTED';
            responseData.message = 'WhatsApp connected successfully!';
          } else {
            console.log('⏳ [EMBEDDED_SIGNUP_CALLBACK] Background job still running, sending response with "Loading..."');
          }
        } catch (waitError) {
          console.warn('⚠️ [EMBEDDED_SIGNUP_CALLBACK] Error waiting for background job:', waitError.message);
          // Continue with response even if wait fails
        }
        
        // Continue background job in background if not completed
        if (!backgroundJobCompleted) {
          backgroundJobPromise.catch(err => {
            console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Background job error (continuing in background):', err.message);
          });
        }
        
        console.log('✅ [EMBEDDED_SIGNUP_CALLBACK] ===== CALLBACK PROCESSING COMPLETE =====');
        return res.json(responseData);
        
      } catch (error) {
        console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Database error:', {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack,
          timestamp: new Date().toISOString()
        });
        
        return res.status(500).json({
          success: false,
          message: 'Database error during WhatsApp setup',
          error: error.message
        });
      }
    }
    
    // If we reach here, it means we didn't get embedded signup data
    console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] No embedded signup data received:', {
      phone_number_id: phone_number_id,
      waba_id: waba_id,
      hasPhoneNumberId: !!phone_number_id,
      hasWabaId: !!waba_id,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      bodyContent: req.body,
      timestamp: new Date().toISOString()
    });
    
    // Provide more specific error message
    let errorMessage = 'No embedded signup data received';
    if (waba_id && !phone_number_id) {
      errorMessage = 'Phone number ID is missing from the signup response. Please ensure the phone number was successfully connected in Meta.';
    } else if (!waba_id && !phone_number_id) {
      errorMessage = 'Both WABA ID and Phone Number ID are missing. Please try the signup process again.';
    }
    
    multiTenantLogger.error('EMBEDDED_SIGNUP_CALLBACK', errorMessage, {
      phone_number_id: phone_number_id || null,
      waba_id: waba_id || null,
      body: req.body
    });
    
    return res.status(400).json({
      success: false,
      message: errorMessage,
      details: {
        received: {
          waba_id: !!waba_id,
          phone_number_id: !!phone_number_id
        },
        required: {
          waba_id: true,
          phone_number_id: true
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] ===== UNEXPECTED ERROR =====');
    console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Error details:', {
      type: error.constructor.name,
      message: error.message,
      stack: error.stack,
      responseData: error.response?.data,
      responseStatus: error.response?.status,
      responseStatusText: error.response?.statusText,
      userId: req.query.state || req.user?._id,
      method: req.method,
      url: req.url,
      path: req.path,
      hasBody: !!req.body && Object.keys(req.body).length > 0,
      bodyKeys: req.body ? Object.keys(req.body) : [],
      hasQuery: !!req.query && Object.keys(req.query).length > 0,
      queryKeys: req.query ? Object.keys(req.query) : [],
      timestamp: new Date().toISOString()
    });
    
    whatsappLogger.error('EMBEDDED_SIGNUP_CALLBACK', 'Embedded signup callback processing failed', {
      error: error.response?.data || error.message,
      userId: req.query.state || req.user?._id
    });
    
    const errorMessage = error.response?.data?.error?.message || error.message || 'WhatsApp setup failed';
    console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] Final error message:', errorMessage);
    
    // Return appropriate error response based on flow
    if (req.body && Object.keys(req.body).length > 0) {
      // SDK flow - return JSON error
      console.log('📤 [EMBEDDED_SIGNUP_CALLBACK] Sending JSON error response (SDK flow)');
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: error.message
      });
    } else {
      // Redirect flow - redirect to frontend with error
      const errorUrl = `${process.env.FRONTEND_URL}/settings?whatsapp_error=${encodeURIComponent(errorMessage)}`;
      console.log('📤 [EMBEDDED_SIGNUP_CALLBACK] Redirecting to error URL (web flow):', errorUrl);
      res.redirect(errorUrl);
    }
    
    console.error('❌ [EMBEDDED_SIGNUP_CALLBACK] ===== ERROR HANDLING COMPLETE =====');
  }
};

/**
 * Get WhatsApp Templates
 * Fetch templates for a specific phone number
 */
exports.getWhatsAppTemplates = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { phoneNumberId } = req.params;
    
    console.log('🔍 DEBUG: Getting WhatsApp templates for phone:', phoneNumberId);
    
    // Get user's multi-tenant WhatsApp configuration
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured'
      });
    }
    
    // Fetch templates from Meta API
    try {
      const templatesResponse = await axios.get(
        `https://graph.facebook.com/v22.0/${phoneNumberId}/message_templates`,
        {
          headers: {
            'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`
          },
          params: {
            fields: 'language,name,rejected_reason,status,category,sub_category,last_updated_time,components,quality_score',
            limit: 50
          }
        }
      );
      
      console.log('✅ DEBUG: Templates fetched:', templatesResponse.data);
      
      res.json({
        success: true,
        templates: templatesResponse.data.data || []
      });
      
    } catch (metaError) {
      console.warn('⚠️ DEBUG: Meta API error for templates:', metaError.message);
      console.warn('⚠️ DEBUG: Meta error details:', {
        message: metaError.message,
        response: metaError.response?.data,
        status: metaError.response?.status
      });
      
      // Return empty templates array instead of error
      res.json({
        success: true,
        templates: [],
        message: 'No templates available yet'
      });
    }
    
  } catch (error) {
    console.error('❌ DEBUG: Error fetching templates:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: error.message
    });
  }
};

// Refresh phone number details manually
exports.refreshPhoneDetails = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { phoneNumberId } = req.params;
    
    console.log('🔄 [REFRESH_PHONE] Manual refresh - fetching phone details for:', phoneNumberId);
    
    if (!phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number ID is required'
      });
    }
    
    // Get user to retrieve system user token and WABA ID
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured'
      });
    }
    
    const accessToken = user.multiTenantWhatsApp?.systemUserAccessToken || META_SYSTEM_USER_TOKEN;
    const wabaId = user.multiTenantWhatsApp?.wabaId;
    
    console.log('🔑 [REFRESH_PHONE] Using access token:', {
      hasToken: !!accessToken,
      tokenSource: user.multiTenantWhatsApp?.systemUserAccessToken ? 'database' : 'environment',
      hasWabaId: !!wabaId,
      timestamp: new Date().toISOString()
    });
    
    let phoneData = null;
    let fetchMethod = 'unknown';
    
    // Try Method 1: Direct phone number access
    try {
      console.log('📞 [REFRESH_PHONE] Attempting direct phone number fetch...');
    const phoneResponse = await axios.get(
      `https://graph.facebook.com/v24.0/${phoneNumberId}`,
      {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        params: {
          fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,name,status'
        }
      }
    );
    
      phoneData = phoneResponse.data;
      fetchMethod = 'direct';
      console.log('✅ [REFRESH_PHONE] Phone details fetched directly:', {
        displayNumber: phoneData.display_phone_number,
        verifiedName: phoneData.verified_name || phoneData.name,
        timestamp: new Date().toISOString()
      });
    } catch (directError) {
      console.warn('⚠️ [REFRESH_PHONE] Direct phone fetch failed, trying via WABA:', {
        error: directError.response?.data?.error?.message || directError.message,
        errorCode: directError.response?.data?.error?.code,
        errorSubcode: directError.response?.data?.error?.error_subcode,
        timestamp: new Date().toISOString()
      });
      
      // Try Method 2: Fetch via WABA ID's phone_numbers endpoint
      if (wabaId) {
        try {
          console.log('📞 [REFRESH_PHONE] Attempting phone fetch via WABA phone_numbers endpoint...');
          const wabaResponse = await axios.get(
            `https://graph.facebook.com/v24.0/${wabaId}/phone_numbers`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              },
              params: {
                fields: 'display_phone_number,verified_name,quality_rating,code_verification_status,name,status'
              }
            }
          );
          
          // Find the phone number that matches our phoneNumberId
          const phoneNumbers = wabaResponse.data?.data || [];
          const matchingPhone = phoneNumbers.find((phone) => phone.id === phoneNumberId || phone.id === String(phoneNumberId));
          
          if (matchingPhone) {
            phoneData = matchingPhone;
            fetchMethod = 'via_waba';
            console.log('✅ [REFRESH_PHONE] Phone details fetched via WABA:', {
              displayNumber: phoneData.display_phone_number,
              verifiedName: phoneData.verified_name || phoneData.name,
              timestamp: new Date().toISOString()
            });
          } else {
            console.warn('⚠️ [REFRESH_PHONE] Phone number not found in WABA phone_numbers list:', {
              phoneNumberId: phoneNumberId,
              foundPhones: phoneNumbers.length,
              phoneIds: phoneNumbers.map((p) => p.id),
              timestamp: new Date().toISOString()
            });
          }
        } catch (wabaError) {
          console.error('❌ [REFRESH_PHONE] WABA phone_numbers fetch also failed:', {
            error: wabaError.response?.data?.error?.message || wabaError.message,
            errorCode: wabaError.response?.data?.error?.code,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.warn('⚠️ [REFRESH_PHONE] WABA ID not available, cannot try alternative method');
      }
    }
    
    if (phoneData) {
    // Update database with phone number details
    const updateResult = await User.findByIdAndUpdate(userId, {
        'multiTenantWhatsApp.displayNumber': phoneData.display_phone_number,
        'multiTenantWhatsApp.verifiedName': phoneData.verified_name || phoneData.name,
        'multiTenantWhatsApp.qualityRating': phoneData.quality_rating,
        'multiTenantWhatsApp.codeVerificationStatus': phoneData.code_verification_status,
        'multiTenantWhatsApp.status': phoneData.status
      });
      
      console.log('✅ [REFRESH_PHONE] Phone details saved to database:', {
        hasResult: !!updateResult,
        fetchMethod,
        timestamp: new Date().toISOString()
      });
      
      multiTenantLogger.databaseUpdate(userId, 'REFRESH_PHONE_DETAILS', true, {
        displayNumber: phoneData.display_phone_number,
        verifiedName: phoneData.verified_name || phoneData.name,
        fetchMethod
      });
    
    res.json({
      success: true,
      message: 'Phone details refreshed successfully',
        phoneDetails: phoneData,
        fetchMethod
      });
    } else {
      const errorMessage = 'Phone details could not be fetched. This may be due to permissions or the phone number not being accessible with the current access token.';
      console.error('❌ [REFRESH_PHONE] Could not fetch phone details:', {
        phoneNumberId,
        wabaId,
        hasAccessToken: !!accessToken,
        timestamp: new Date().toISOString()
      });
      
      multiTenantLogger.error('REFRESH_PHONE', errorMessage, {
        phoneNumberId,
        wabaId,
        hasAccessToken: !!accessToken
      });
      
      res.status(400).json({
        success: false,
        message: errorMessage,
        details: {
          phoneNumberId,
          wabaId: wabaId || 'not_available',
          suggestion: 'The phone number may belong to a different Meta app. Please ensure the system user token has access to this phone number.'
        }
      });
    }
    
  } catch (error) {
    console.error('❌ [REFRESH_PHONE] Unexpected error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to refresh phone details',
      error: error.message
    });
  }
};

// Test endpoint to check phone number details from Meta API
exports.testPhoneDetails = async (req, res, next) => {
  try {
    const { phoneNumberId } = req.params;
    
    console.log('🧪 DEBUG: Testing phone details fetch for:', phoneNumberId);
    console.log('🧪 DEBUG: Using META_SYSTEM_USER_TOKEN:', META_SYSTEM_USER_TOKEN ? 'Present' : 'Missing');
    
    if (!phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number ID is required'
      });
    }
    
    // Test different field combinations
    const testFields = [
      'display_phone_number,verified_name,quality_rating,code_verification_status,name,status',
      'display_phone_number,verified_name',
      'name,status',
      'display_phone_number'
    ];
    
    const results = {};
    
    for (let i = 0; i < testFields.length; i++) {
      try {
        console.log(`🧪 DEBUG: Testing fields ${i + 1}:`, testFields[i]);
        
        const response = await axios.get(
          `https://graph.facebook.com/v24.0/${phoneNumberId}`,
          {
            headers: {
              'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`
            },
            params: {
              fields: testFields[i]
            }
          }
        );
        
        results[`test_${i + 1}`] = {
          fields: testFields[i],
          success: true,
          data: response.data
        };
        
        console.log(`✅ DEBUG: Test ${i + 1} successful:`, response.data);
        
      } catch (error) {
        results[`test_${i + 1}`] = {
          fields: testFields[i],
          success: false,
          error: error.response?.data || error.message
        };
        
        console.log(`❌ DEBUG: Test ${i + 1} failed:`, error.response?.data || error.message);
      }
    }
    
    res.json({
      success: true,
      message: 'Phone details test completed',
      phoneNumberId,
      results
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Error in test endpoint:', error.message);
    res.status(500).json({
      success: false,
      message: 'Test failed',
      error: error.message
    });
  }
};

// Check System User Token configuration
exports.checkSystemToken = async (req, res, next) => {
  try {
    const token = META_SYSTEM_USER_TOKEN;
    
    multiTenantLogger.systemTokenCheck(!!token, token ? token.length : 0);
    
    if (!token) {
      return res.json({
        success: false,
        message: 'META_SYSTEM_USER_TOKEN is not configured',
        configured: false
      });
    }
    
    // Test the token with a simple API call
    try {
      const testResponse = await axios.get(
        'https://graph.facebook.com/v24.0/me',
        {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          params: {
            fields: 'id,name,permissions'
          }
        }
      );
      
      multiTenantLogger.systemTokenValid(testResponse.data.permissions);
      
      // Test access to the Business Account (use META_BUSINESS_ID for URLPT app)
      // Note: Business nodes don't have phone_numbers field - only WABAs do
      let businessAccountTest = null;
      if (META_BUSINESS_ID) {
      try {
        const businessResponse = await axios.get(
            `https://graph.facebook.com/v24.0/${META_BUSINESS_ID}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            params: {
                fields: 'id,name'
            }
          }
        );
        businessAccountTest = {
          success: true,
          data: businessResponse.data
        };
          multiTenantLogger.businessAccountTest(META_BUSINESS_ID, true, businessResponse.data);
      } catch (businessError) {
        businessAccountTest = {
          success: false,
          error: businessError.response?.data || businessError.message
        };
          multiTenantLogger.businessAccountTest(META_BUSINESS_ID, false, { error: businessError.response?.data || businessError.message });
        }
      }
      
      res.json({
        success: true,
        message: 'System User Token is configured and valid',
        configured: true,
        tokenInfo: {
          length: token.length,
          startsWith: token.substring(0, 10) + '...',
          testResult: testResponse.data,
          businessAccountTest: businessAccountTest
        }
      });
      
    } catch (tokenError) {
      multiTenantLogger.systemTokenInvalid(tokenError);
      
      res.json({
        success: false,
        message: 'System User Token is configured but invalid',
        configured: true,
        valid: false,
        error: tokenError.response?.data || tokenError.message
      });
    }
    
  } catch (error) {
    console.error('❌ DEBUG: Error checking system token:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check system token',
      error: error.message
    });
  }
};

// Get Multi-Tenant WhatsApp logs
exports.getLogs = async (req, res, next) => {
  try {
    const { lines = 100, level = 'all' } = req.query;
    
    multiTenantLogger.info('GET_LOGS', 'Fetching Multi-Tenant WhatsApp logs', {
      lines: parseInt(lines),
      level
    });
    
    const logs = multiTenantLogger.getRecentLogs(parseInt(lines));
    
    // Filter by level if specified
    let filteredLogs = logs;
    if (level !== 'all') {
      filteredLogs = logs.filter(log => log.includes(`[${level.toUpperCase()}]`));
    }
    
    res.json({
      success: true,
      message: 'Logs retrieved successfully',
      logs: filteredLogs,
      totalLines: filteredLogs.length,
      requestedLines: parseInt(lines),
      level
    });
    
  } catch (error) {
    multiTenantLogger.error('GET_LOGS', 'Failed to retrieve logs', {
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve logs',
      error: error.message
    });
  }
};

/**
 * Create WhatsApp Template
 * Create a new message template
 */
exports.createWhatsAppTemplate = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { phoneNumberId, name, category, language, components } = req.body;
    
    console.log('🔍 DEBUG: Creating WhatsApp template:', { name, category, language });
    
    // Get user's multi-tenant WhatsApp configuration
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured'
      });
    }
    
    // Create template via Meta API
    const templateData = {
      name,
      category,
      language,
      components: components || [
        {
          type: 'BODY',
          text: 'Hello! This is a sample message template.'
        }
      ]
    };
    
    const templateResponse = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/message_templates`,
      templateData,
      {
        headers: {
          'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ DEBUG: Template created:', templateResponse.data);
    
    res.json({
      success: true,
      message: 'Template created successfully',
      template: templateResponse.data
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Error creating template:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: error.message
    });
  }
};

/**
 * Delete WhatsApp Template
 * Delete a message template
 */
exports.deleteWhatsAppTemplate = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { templateName } = req.params;
    
    console.log('🔍 DEBUG: Deleting WhatsApp template:', templateName);
    
    // Get user's multi-tenant WhatsApp configuration
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured'
      });
    }
    
    // Delete template via Meta API
    const deleteResponse = await axios.delete(
      `https://graph.facebook.com/v22.0/${user.multiTenantWhatsApp.phoneNumberId}/message_templates/${templateName}`,
      {
        headers: {
          'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`
        }
      }
    );
    
    console.log('✅ DEBUG: Template deleted:', deleteResponse.data);
    
    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Error deleting template:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: error.message
    });
  }
};

/**
 * Add Phone Number to Multi-Tenant WABA
 * Add a new phone number to the WABA using System User token
 */
exports.addPhoneNumberToWABA = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { wabaId, phoneNumber, verifiedName } = req.body;
    
    console.log('🔍 [ADD_PHONE_NUMBER] Adding phone number to WABA:', { wabaId, phoneNumber: phoneNumber?.substring(0, 4) + '***' });
    
    // Get user's multi-tenant WhatsApp configuration
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured'
      });
    }
    
    if (!wabaId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'WABA ID and phone number are required'
      });
    }
    
    // Extract country code and phone number
    let cc, phone;
    const phoneStr = phoneNumber.replace(/\D/g, '');
    
    // Common country code patterns
    if (phoneStr.length === 11 && phoneStr.startsWith('1')) {
      cc = phoneStr.substring(0, 1);
      phone = phoneStr.substring(1);
    } else if (phoneStr.length === 12 && (phoneStr.startsWith('91') || phoneStr.startsWith('44'))) {
      cc = phoneStr.substring(0, 2);
      phone = phoneStr.substring(2);
    } else if (phoneStr.length === 13 && phoneStr.startsWith('971')) {
      cc = phoneStr.substring(0, 3);
      phone = phoneStr.substring(3);
    } else {
      // Default: last 10 digits are phone, rest is country code
      cc = phoneStr.substring(0, phoneStr.length - 10);
      phone = phoneStr.substring(phoneStr.length - 10);
    }
    
    // Add phone number via Meta API
    const phoneData = {
      cc: cc,
      phone_number: phone,
      verified_name: verifiedName || 'Business'
    };
    
    const addResponse = await axios.post(
      `https://graph.facebook.com/v24.0/${wabaId}/phone_numbers`,
      phoneData,
      {
        headers: {
          'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ [ADD_PHONE_NUMBER] Phone number added:', addResponse.data);
    
    res.json({
      success: true,
      message: 'Phone number added successfully. Please verify it in Meta Business Manager.',
      data: addResponse.data
    });
    
  } catch (error) {
    console.error('❌ [ADD_PHONE_NUMBER] Error adding phone number:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to add phone number',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

/**
 * Subscribe App to Phone Number
 * Subscribes the app to a phone number to enable webhooks and messaging features
 */
exports.subscribeAppToPhoneNumber = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { phoneNumberId } = req.body;
    
    console.log('📱 [SUBSCRIBE_APP] Subscribing app to phone number:', phoneNumberId);
    
    if (!phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'Phone number ID is required'
      });
    }
    
    // Get user's multi-tenant WhatsApp configuration
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured via multi-tenant system'
      });
    }
    
    const accessToken = user.multiTenantWhatsApp.systemUserAccessToken || META_SYSTEM_USER_TOKEN;
    
    // Subscribe app to phone number via Meta API
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/subscribed_apps`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ [SUBSCRIBE_APP] App subscribed successfully:', response.data);
    
    res.json({
      success: true,
      message: 'App subscribed to phone number successfully',
      data: response.data
    });
    
  } catch (error) {
    console.error('❌ [SUBSCRIBE_APP] Error subscribing app:', error.response?.data?.error || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.error?.message || 'Failed to subscribe app to phone number',
      details: error.response?.data?.error || error.message
    });
  }
};

/**
 * Disconnect Multi-Tenant WhatsApp
 * Remove user's phone number from our WABA
 */
exports.disconnectMultiTenantWhatsApp = async (req, res, next) => {
  try {
    // Set CORS headers explicitly
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    const userId = req.user._id;
    
    whatsappLogger.info('MULTI_TENANT_DISCONNECT', 'Disconnecting multi-tenant WhatsApp', {
      userId: userId.toString()
    });
    
    // Get user's configuration
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured via multi-tenant system'
      });
    }
    
    const phoneNumberId = user.multiTenantWhatsApp.phoneNumberId;
    
    // Remove phone number from our WABA using System User token
    try {
      await axios.delete(
        `https://graph.facebook.com/v18.0/${phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`
          }
        }
      );
      
      whatsappLogger.info('MULTI_TENANT_DISCONNECT', 'Phone number removed from WABA', {
        userId: userId.toString(),
        phoneNumberId: phoneNumberId
      });
    } catch (metaError) {
      whatsappLogger.warn('MULTI_TENANT_DISCONNECT', 'Failed to remove phone from WABA', {
        error: metaError.response?.data || metaError.message,
        userId: userId.toString(),
        phoneNumberId: phoneNumberId
      });
      // Continue with database cleanup even if Meta API fails
    }
    
    // Clear user's multi-tenant WhatsApp configuration
    await User.findByIdAndUpdate(userId, {
      $unset: { multiTenantWhatsApp: 1 }
    });
    
    whatsappLogger.success('MULTI_TENANT_DISCONNECT', 'Multi-tenant WhatsApp disconnected', {
      userId: userId.toString()
    });
    
    res.json({
      success: true,
      message: 'WhatsApp disconnected successfully'
    });
    
  } catch (error) {
    // Ensure CORS headers are set even on error
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    whatsappLogger.error('MULTI_TENANT_DISCONNECT', 'Failed to disconnect multi-tenant WhatsApp', {
      error: error.message,
      userId: req.user._id.toString()
    });
    return next(error);
  }
};

/**
 * Send Message via Multi-Tenant System
 * Send WhatsApp message using user's phone number in our WABA
 */
exports.sendMultiTenantMessage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { to, message, templateName, templateParams } = req.body;
    
    whatsappLogger.info('MULTI_TENANT_SEND', 'Multi-tenant message send request', {
      userId: userId.toString(),
      to: to,
      hasTemplate: !!templateName
    });
    
    // Get user's multi-tenant WhatsApp configuration
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Multi-tenant WhatsApp not configured. Please connect your phone number first.'
      });
    }
    
    const phoneNumberId = user.multiTenantWhatsApp.phoneNumberId;
    
    // Prepare message payload
    let messagePayload;
    
    if (templateName) {
      // Template message
      messagePayload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en'
          },
          components: templateParams || []
        }
      };
    } else {
      // Text message
      messagePayload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      };
    }
    
    // Send via WhatsApp Cloud API using System User token
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const messageId = response.data.messages[0].id;
    
    whatsappLogger.success('MULTI_TENANT_SEND', 'Multi-tenant message sent successfully', {
      userId: userId.toString(),
      to: to,
      messageId: messageId
    });
    
    res.json({
      success: true,
      messageId: messageId,
      message: 'WhatsApp message sent successfully via multi-tenant system'
    });
    
  } catch (error) {
    whatsappLogger.error('MULTI_TENANT_SEND', 'Failed to send multi-tenant message', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString()
    });
    
    const errorMessage = error.response?.data?.error?.message || 'Failed to send WhatsApp message';
    res.status(error.response?.status || 500).json({
      success: false,
      message: errorMessage,
      error: error.response?.data?.error
    });
  }
};

/**
 * Get Setup Guidance URL
 * Fetches the user's WABA details to get the correct business account ID
 * and constructs the Setup Guidance URL
 */
exports.getSetupGuidanceUrl = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    console.log('🔗 [GET_SETUP_GUIDANCE_URL] Fetching Setup Guidance URL for user:', userId.toString());
    
    // Get user's WhatsApp configuration
    const user = await User.findById(userId).select('multiTenantWhatsApp');
    if (!user || !user.multiTenantWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured. Please complete embedded signup first.'
      });
    }
    
    const { wabaId, phoneNumberId } = user.multiTenantWhatsApp;
    
    if (!wabaId || !phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'WABA ID or Phone Number ID not found'
      });
    }
    
    // Get access token
    const accessToken = user.multiTenantWhatsApp?.systemUserAccessToken || META_SYSTEM_USER_TOKEN;
    
    // Fetch WABA details to get owner_business_info
    try {
      console.log('📡 [GET_SETUP_GUIDANCE_URL] Fetching WABA details from Meta API...');
      const wabaResponse = await axios.get(
        `https://graph.facebook.com/v22.0/${wabaId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          params: {
            fields: 'id,name,owner_business_info'
          },
          timeout: 30000
        }
      );
      
      const wabaData = wabaResponse.data;
      console.log('✅ [GET_SETUP_GUIDANCE_URL] WABA details fetched:', {
        wabaId: wabaData.id,
        hasOwnerBusinessInfo: !!wabaData.owner_business_info
      });
      
      // Extract business account ID from owner_business_info
      let businessAccountId = null;
      
      if (wabaData.owner_business_info) {
        // owner_business_info can be an object with an 'id' field or just an ID string
        if (typeof wabaData.owner_business_info === 'object' && wabaData.owner_business_info.id) {
          businessAccountId = wabaData.owner_business_info.id;
        } else if (typeof wabaData.owner_business_info === 'string') {
          businessAccountId = wabaData.owner_business_info;
        }
      }
      
      // If we couldn't get it from owner_business_info, try fetching via business edge
      if (!businessAccountId) {
        console.log('⚠️ [GET_SETUP_GUIDANCE_URL] owner_business_info not available, trying alternative method...');
        try {
          // Try to get business account from WABA's business edge
          const businessResponse = await axios.get(
            `https://graph.facebook.com/v22.0/${wabaId}/business`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              },
              params: {
                fields: 'id'
              },
              timeout: 30000
            }
          );
          
          if (businessResponse.data?.id) {
            businessAccountId = businessResponse.data.id;
            console.log('✅ [GET_SETUP_GUIDANCE_URL] Business Account ID found via business edge:', businessAccountId);
          }
        } catch (businessError) {
          console.warn('⚠️ [GET_SETUP_GUIDANCE_URL] Could not fetch business account via business edge:', {
            error: businessError.response?.data?.error?.message || businessError.message
          });
        }
      }
      
      // Fallback to META_BUSINESS_ID if we still don't have it
      if (!businessAccountId) {
        console.log('⚠️ [GET_SETUP_GUIDANCE_URL] Using fallback META_BUSINESS_ID');
        businessAccountId = META_BUSINESS_ID;
      }
      
      // Construct Setup Guidance URL
      const setupGuidanceUrl = `https://business.facebook.com/latest/whatsapp_manager/setup_guidance/?business_id=${businessAccountId}&asset_id=${wabaId}&phone_number_id=${phoneNumberId}&nav_ref=whatsapp_embedded_signup`;
      
      console.log('✅ [GET_SETUP_GUIDANCE_URL] Setup Guidance URL constructed:', {
        businessAccountId,
        wabaId,
        phoneNumberId,
        url: setupGuidanceUrl
      });
      
      multiTenantLogger.info('GET_SETUP_GUIDANCE_URL', 'Setup Guidance URL generated', {
        userId,
        businessAccountId,
        wabaId,
        phoneNumberId
      });
      
      res.json({
        success: true,
        setupGuidanceUrl,
        businessAccountId,
        wabaId,
        phoneNumberId
      });
      
    } catch (apiError) {
      console.error('❌ [GET_SETUP_GUIDANCE_URL] Error fetching WABA details:', {
        error: apiError.response?.data?.error?.message || apiError.message,
        errorCode: apiError.response?.data?.error?.code
      });
      
      // Fallback: construct URL with META_BUSINESS_ID
      const fallbackUrl = `https://business.facebook.com/latest/whatsapp_manager/setup_guidance/?business_id=${META_BUSINESS_ID}&asset_id=${wabaId}&phone_number_id=${phoneNumberId}&nav_ref=whatsapp_embedded_signup`;
      
      console.log('⚠️ [GET_SETUP_GUIDANCE_URL] Using fallback URL with META_BUSINESS_ID');
      
      res.json({
        success: true,
        setupGuidanceUrl: fallbackUrl,
        businessAccountId: META_BUSINESS_ID,
        wabaId,
        phoneNumberId,
        note: 'Using fallback business account ID. If you get access denied, contact support.'
      });
    }
    
  } catch (error) {
    console.error('❌ [GET_SETUP_GUIDANCE_URL] Unexpected error:', error);
    multiTenantLogger.error('GET_SETUP_GUIDANCE_URL', 'Failed to get Setup Guidance URL', {
      error: error.message,
      userId: req.user?._id?.toString()
    });
    return next(error);
  }
};

/**
 * Get All WABA Accounts (Admin Only)
 * Fetch all WhatsApp Business Accounts from Meta Business Account
 */
exports.getAllWabaAccounts = async (req, res, next) => {
  // Set CORS headers immediately at the start
  const origin = req.headers.origin;
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Set a longer timeout for this endpoint (5 minutes)
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
    
  try {
    // No auth required - use dummy userId for logging
    const userId = req.user?._id || 'public-access';
    
    console.log('📊 [GET_ALL_WABA_ACCOUNTS] Request received (PUBLIC)', {
      userId: userId.toString(),
      method: req.method,
      url: req.url,
      origin: origin,
      timestamp: new Date().toISOString()
    });
    
    if (!META_SYSTEM_USER_TOKEN) {
      const errorMsg = 'System User Token not configured';
      console.error('❌ [GET_ALL_WABA_ACCOUNTS]', errorMsg);
      return res.status(500).json({
        success: false,
        message: errorMsg
      });
    }
    
    if (!META_BUSINESS_ID) {
      const errorMsg = 'Business ID not configured';
      console.error('❌ [GET_ALL_WABA_ACCOUNTS]', errorMsg);
      return res.status(500).json({
        success: false,
        message: errorMsg
      });
    }
    
    try {
      // Simple direct fetch using client endpoint (we know this works from tests)
      console.log('📡 [GET_ALL_WABA_ACCOUNTS] Fetching WABAs from Meta API', {
        businessId: META_BUSINESS_ID,
        hasToken: !!META_SYSTEM_USER_TOKEN
      });
      
      // Use client endpoint directly - matching the working curl command format
          const clientResponse = await axios.get(
        `https://graph.facebook.com/v22.0/${META_BUSINESS_ID}/client_whatsapp_business_accounts`,
            {
              headers: {
                'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
                'Content-Type': 'application/json'
              },
              params: {
                fields: 'id,name,currency,owner_business_info',
            limit: 20
              },
          timeout: 30000 // 30 seconds
            }
          );
          
      let wabaAccounts = clientResponse.data?.data || [];
          
      console.log('✅ [GET_ALL_WABA_ACCOUNTS] Fetched WABAs', {
        count: wabaAccounts.length
          });
          
      // Map to expected format (matching the response from Meta API)
          wabaAccounts = wabaAccounts.map(waba => ({
            id: waba.id,
            name: waba.name || `WABA ${waba.id}`,
        account_review_status: 'APPROVED', // Default since not in response
            message_template_namespace: null,
            ownership_type: 'CLIENT',
            primary_funding_id: null,
            timezone_id: null,
        currency: waba.currency || null,
        status: 'ACTIVE' // Default since not in response
      }));
      
      console.log('📊 [GET_ALL_WABA_ACCOUNTS] Final WABA list', {
        count: wabaAccounts.length,
        wabaIds: wabaAccounts.map(w => w.id)
      });
      
      // NEW APPROACH: Return WABAs immediately, fetch phone numbers and users from database only
      // This avoids slow Meta API calls that cause timeouts
      console.log('🔄 [GET_ALL_WABA_ACCOUNTS] Fetching connected users from database...');
      
      const wabaAccountsWithDetails = await Promise.all(
        wabaAccounts.map(async (waba) => {
          try {
            // Find all users connected to this WABA from database (fast)
            const connectedUsers = await User.find({
              'multiTenantWhatsApp.wabaId': waba.id,
              'multiTenantWhatsApp.isConfigured': true
            }).select('name email multiTenantWhatsApp.phoneNumberId multiTenantWhatsApp.displayNumber multiTenantWhatsApp.verifiedName multiTenantWhatsApp.setupDate');
            
            return {
              ...waba,
              phoneNumbers: [], // Will be fetched on-demand via separate endpoint
              connectedUsers: connectedUsers.map(user => ({
                userId: user._id,
                name: user.name,
                email: user.email,
                phoneNumberId: user.multiTenantWhatsApp?.phoneNumberId,
                displayNumber: user.multiTenantWhatsApp?.displayNumber,
                verifiedName: user.multiTenantWhatsApp?.verifiedName,
                setupDate: user.multiTenantWhatsApp?.setupDate
              })),
              totalPhoneNumbers: 0, // Will be fetched on-demand
              totalConnectedUsers: connectedUsers.length
            };
          } catch (error) {
            console.error(`❌ [GET_ALL_WABA_ACCOUNTS] Error processing WABA ${waba.id}`, error.message);
            return {
              ...waba,
              phoneNumbers: [],
              connectedUsers: [],
              totalPhoneNumbers: 0,
              totalConnectedUsers: 0,
              error: error.message || 'Failed to process'
            };
          }
        })
      );
      
      console.log('✅ [GET_ALL_WABA_ACCOUNTS] Successfully fetched WABA accounts', {
        totalWabas: wabaAccountsWithDetails.length,
        userId: userId.toString(),
        timestamp: new Date().toISOString()
      });
      
      console.log('📤 [GET_ALL_WABA_ACCOUNTS] Sending response to frontend', {
        success: true,
        totalWabas: wabaAccountsWithDetails.length,
        responseSize: JSON.stringify(wabaAccountsWithDetails).length,
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        wabaAccounts: wabaAccountsWithDetails,
        total: wabaAccountsWithDetails.length
      });
      
    } catch (error) {
      const errorDetails = {
        error: error.response?.data || error.message,
        userId: userId.toString(),
        httpStatus: error.response?.status,
        errorCode: error.response?.data?.error?.code,
        errorSubcode: error.response?.data?.error?.error_subcode,
        errorType: error.response?.data?.error?.type,
        fbtrace_id: error.response?.data?.error?.fbtrace_id,
        businessId: META_BUSINESS_ID,
        hasToken: !!META_SYSTEM_USER_TOKEN
      };
      
      console.error('❌ [GET_ALL_WABA_ACCOUNTS] Failed to fetch WABA accounts from Meta', errorDetails);
      console.error('❌ [GET_ALL_WABA_ACCOUNTS] Full error:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to fetch WABA accounts from Meta';
      const statusCode = error.response?.status || 500;
      
      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: error.response?.data?.error || {
          code: error.response?.data?.error?.code,
          message: errorMessage,
          type: error.response?.data?.error?.type
        },
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      });
    }
    
  } catch (error) {
    // Ensure CORS headers are set even on error
    const origin = req.headers.origin;
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    const errorDetails = {
      error: error.message,
      userId: req.user?._id?.toString(),
      stack: error.stack
    };
    
    console.error('❌ [GET_ALL_WABA_ACCOUNTS] Unexpected error', errorDetails);
    
    return next(error);
  }
};

/**
 * Comprehensive Meta Graph API Test Endpoint
 * Tests all Meta Graph API endpoints to verify token and permissions
 */
exports.testAllMetaGraphAPIs = async (req, res, next) => {
  try {
    const { runAllTests } = require('../../scripts/test-meta-graph-api');
    
    console.log('🧪 [TEST_ALL_META_APIS] Starting comprehensive Meta Graph API test suite');
    
    // Run all tests
    const results = await runAllTests();
    
    console.log('✅ [TEST_ALL_META_APIS] Test suite completed');
    
    res.json({
      success: true,
      message: 'Meta Graph API test suite completed',
      results: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ [TEST_ALL_META_APIS] Error running test suite:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run Meta Graph API test suite',
      error: error.message
    });
  }
};
