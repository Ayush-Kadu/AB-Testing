const twilio = require('twilio');
const User = require('../models/user.model');
const { whatsappLogger } = require('../utils/whatsappLogger');

/**
 * Get Twilio WhatsApp Configuration
 * Check if user has configured Twilio WhatsApp
 */
exports.getTwilioConfig = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    whatsappLogger.info('TWILIO_CONFIG', 'Getting Twilio configuration', {
      userId: userId.toString()
    });
    
    // Get user's Twilio WhatsApp configuration
    const user = await User.findById(userId).select('twilioWhatsApp');
    
    if (!user || !user.twilioWhatsApp?.isConfigured) {
      return res.json({
        success: true,
        config: {
          isConfigured: false,
          accountSid: null,
          fromNumber: null
        }
      });
    }
    
    res.json({
      success: true,
      config: {
        isConfigured: true,
        accountSid: user.twilioWhatsApp.accountSid,
        fromNumber: user.twilioWhatsApp.fromNumber
      }
    });
    
  } catch (error) {
    whatsappLogger.error('TWILIO_CONFIG', 'Failed to get Twilio configuration', {
      error: error.message,
      userId: req.user._id.toString()
    });
    return next(error);
  }
};

/**
 * Configure Twilio WhatsApp
 * Save Twilio credentials and test connection
 */
exports.configureTwilio = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { accountSid, authToken, fromNumber } = req.body;
    
    whatsappLogger.info('TWILIO_CONFIGURE', 'Configuring Twilio WhatsApp', {
      userId: userId.toString(),
      hasAccountSid: !!accountSid,
      hasFromNumber: !!fromNumber
    });
    
    // Validate required fields
    if (!accountSid || !authToken || !fromNumber) {
      return res.status(400).json({
        success: false,
        message: 'Account SID, Auth Token, and From Number are required'
      });
    }
    
    // Test Twilio connection
    try {
      const client = twilio(accountSid, authToken);
      
      // Test connection by fetching account info
      const account = await client.api.accounts(accountSid).fetch();
      
      whatsappLogger.info('TWILIO_CONFIGURE', 'Twilio connection test successful', {
        userId: userId.toString(),
        accountSid: accountSid
      });
    } catch (testError) {
      whatsappLogger.error('TWILIO_CONFIGURE', 'Twilio connection test failed', {
        userId: userId.toString(),
        error: testError.message
      });
      
      return res.status(400).json({
        success: false,
        message: 'Failed to connect to Twilio. Please check your credentials.',
        error: testError.message
      });
    }
    
    // Save to database
    await User.findByIdAndUpdate(userId, {
      twilioWhatsApp: {
        isConfigured: true,
        accountSid: accountSid,
        authToken: authToken, // Store securely
        fromNumber: fromNumber,
        configuredAt: new Date(),
        lastUpdated: new Date()
      }
    });
    
    whatsappLogger.success('TWILIO_CONFIGURE', 'Twilio WhatsApp configured successfully', {
      userId: userId.toString(),
      accountSid: accountSid
    });
    
    res.json({
      success: true,
      message: 'Twilio WhatsApp configured successfully',
      config: {
        isConfigured: true,
        accountSid: accountSid,
        fromNumber: fromNumber
      }
    });
    
  } catch (error) {
    whatsappLogger.error('TWILIO_CONFIGURE', 'Failed to configure Twilio WhatsApp', {
      error: error.message,
      userId: req.user._id.toString()
    });
    return next(error);
  }
};

/**
 * Remove Twilio WhatsApp Configuration
 * Clear Twilio credentials from database
 */
exports.removeTwilioConfig = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    whatsappLogger.info('TWILIO_REMOVE', 'Removing Twilio configuration', {
      userId: userId.toString()
    });
    
    // Clear Twilio configuration
    await User.findByIdAndUpdate(userId, {
      $unset: { twilioWhatsApp: 1 }
    });
    
    whatsappLogger.success('TWILIO_REMOVE', 'Twilio configuration removed', {
      userId: userId.toString()
    });
    
    res.json({
      success: true,
      message: 'Twilio WhatsApp configuration removed successfully'
    });
    
  } catch (error) {
    whatsappLogger.error('TWILIO_REMOVE', 'Failed to remove Twilio configuration', {
      error: error.message,
      userId: req.user._id.toString()
    });
    return next(error);
  }
};

/**
 * Send Message via Twilio
 * Send WhatsApp message using Twilio API
 */
exports.sendTwilioMessage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { to, message, templateName, templateParams } = req.body;
    
    whatsappLogger.info('TWILIO_SEND', 'Twilio message send request', {
      userId: userId.toString(),
      to: to,
      hasTemplate: !!templateName
    });
    
    // Get user's Twilio configuration
    const user = await User.findById(userId).select('twilioWhatsApp');
    
    if (!user || !user.twilioWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Twilio WhatsApp not configured. Please configure Twilio first.'
      });
    }
    
    const { accountSid, authToken, fromNumber } = user.twilioWhatsApp;
    const client = twilio(accountSid, authToken);
    
    // Prepare message
    let messageBody;
    
    if (templateName) {
      // Template message - Twilio format
      messageBody = {
        from: fromNumber,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        body: message || `Template: ${templateName}`,
        // Add template parameters if provided
        ...(templateParams && { templateParams: templateParams })
      };
    } else {
      // Text message
      messageBody = {
        from: fromNumber,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        body: message
      };
    }
    
    // Send via Twilio
    const twilioMessage = await client.messages.create(messageBody);
    
    whatsappLogger.success('TWILIO_SEND', 'Twilio message sent successfully', {
      userId: userId.toString(),
      to: to,
      messageSid: twilioMessage.sid
    });
    
    res.json({
      success: true,
      messageId: twilioMessage.sid,
      message: 'WhatsApp message sent successfully via Twilio'
    });
    
  } catch (error) {
    whatsappLogger.error('TWILIO_SEND', 'Failed to send Twilio message', {
      error: error.message,
      userId: req.user._id.toString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to send WhatsApp message via Twilio',
      error: error.message
    });
  }
};

/**
 * Send Media Message via Twilio
 * Send WhatsApp media message using Twilio API
 */
exports.sendTwilioMediaMessage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { to, mediaUrl, caption } = req.body;
    
    whatsappLogger.info('TWILIO_MEDIA_SEND', 'Twilio media message send request', {
      userId: userId.toString(),
      to: to,
      hasMedia: !!mediaUrl
    });
    
    // Get user's Twilio configuration
    const user = await User.findById(userId).select('twilioWhatsApp');
    
    if (!user || !user.twilioWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Twilio WhatsApp not configured. Please configure Twilio first.'
      });
    }
    
    const { accountSid, authToken, fromNumber } = user.twilioWhatsApp;
    const client = twilio(accountSid, authToken);
    
    // Send media message via Twilio
    const twilioMediaMessage = await client.messages.create({
      from: fromNumber,
      to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      mediaUrl: [mediaUrl],
      body: caption || ''
    });
    
    whatsappLogger.success('TWILIO_MEDIA_SEND', 'Twilio media message sent successfully', {
      userId: userId.toString(),
      to: to,
      messageSid: twilioMediaMessage.sid
    });
    
    res.json({
      success: true,
      messageId: twilioMediaMessage.sid,
      message: 'WhatsApp media message sent successfully via Twilio'
    });
    
  } catch (error) {
    whatsappLogger.error('TWILIO_MEDIA_SEND', 'Failed to send Twilio media message', {
      error: error.message,
      userId: req.user._id.toString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to send WhatsApp media message via Twilio',
      error: error.message
    });
  }
};

/**
 * Get Twilio Message Status
 * Check the status of a sent message
 */
exports.getTwilioMessageStatus = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;
    
    // Get user's Twilio configuration
    const user = await User.findById(userId).select('twilioWhatsApp');
    
    if (!user || !user.twilioWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Twilio WhatsApp not configured. Please configure Twilio first.'
      });
    }
    
    const { accountSid, authToken } = user.twilioWhatsApp;
    const client = twilio(accountSid, authToken);
    
    // Fetch message status
    const message = await client.messages(messageId).fetch();
    
    res.json({
      success: true,
      message: {
        sid: message.sid,
        status: message.status,
        direction: message.direction,
        from: message.from,
        to: message.to,
        body: message.body,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
        dateSent: message.dateSent,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      }
    });
    
  } catch (error) {
    whatsappLogger.error('TWILIO_MESSAGE_STATUS', 'Failed to get Twilio message status', {
      error: error.message,
      userId: req.user._id.toString(),
      messageId: req.params.messageId
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get message status',
      error: error.message
    });
  }
};
