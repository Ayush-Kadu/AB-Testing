const axios = require('axios');
const User = require('../models/user.model');
const { whatsappLogger } = require('../utils/whatsappLogger');

/**
 * Get WATI WhatsApp Configuration
 * Check if user has configured WATI WhatsApp
 */
exports.getWatiConfig = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    whatsappLogger.info('WATI_CONFIG', 'Getting WATI configuration', {
      userId: userId.toString()
    });
    
    // Get user's WATI WhatsApp configuration
    const user = await User.findById(userId).select('watiWhatsApp');
    
    if (!user || !user.watiWhatsApp?.isConfigured) {
      return res.json({
        success: true,
        config: {
          isConfigured: false,
          apiKey: null,
          instanceId: null,
          baseUrl: null
        }
      });
    }
    
    res.json({
      success: true,
      config: {
        isConfigured: true,
        apiKey: user.watiWhatsApp.apiKey,
        instanceId: user.watiWhatsApp.instanceId,
        baseUrl: user.watiWhatsApp.baseUrl
      }
    });
    
  } catch (error) {
    whatsappLogger.error('WATI_CONFIG', 'Failed to get WATI configuration', {
      error: error.message,
      userId: req.user._id.toString()
    });
    return next(error);
  }
};

/**
 * Configure WATI WhatsApp
 * Save WATI credentials and test connection
 */
exports.configureWati = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { apiKey, instanceId, baseUrl } = req.body;
    
    whatsappLogger.info('WATI_CONFIGURE', 'Configuring WATI WhatsApp', {
      userId: userId.toString(),
      hasApiKey: !!apiKey,
      hasInstanceId: !!instanceId
    });
    
    // Validate required fields
    if (!apiKey || !instanceId) {
      return res.status(400).json({
        success: false,
        message: 'API Key and Instance ID are required'
      });
    }
    
    // Test WATI connection
    try {
      const testResponse = await axios.get(`${baseUrl}/api/v1/getProfile/${instanceId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      whatsappLogger.info('WATI_CONFIGURE', 'WATI connection test successful', {
        userId: userId.toString(),
        status: testResponse.status
      });
    } catch (testError) {
      whatsappLogger.error('WATI_CONFIGURE', 'WATI connection test failed', {
        userId: userId.toString(),
        error: testError.response?.data || testError.message
      });
      
      return res.status(400).json({
        success: false,
        message: 'Failed to connect to WATI. Please check your credentials.',
        error: testError.response?.data?.message || 'Connection test failed'
      });
    }
    
    // Save to database
    await User.findByIdAndUpdate(userId, {
      watiWhatsApp: {
        isConfigured: true,
        apiKey: apiKey,
        instanceId: instanceId,
        baseUrl: baseUrl || 'https://live-server-100100.wati.io',
        configuredAt: new Date(),
        lastUpdated: new Date()
      }
    });
    
    whatsappLogger.success('WATI_CONFIGURE', 'WATI WhatsApp configured successfully', {
      userId: userId.toString(),
      instanceId: instanceId
    });
    
    res.json({
      success: true,
      message: 'WATI WhatsApp configured successfully',
      config: {
        isConfigured: true,
        instanceId: instanceId,
        baseUrl: baseUrl || 'https://live-server-100100.wati.io'
      }
    });
    
  } catch (error) {
    whatsappLogger.error('WATI_CONFIGURE', 'Failed to configure WATI WhatsApp', {
      error: error.message,
      userId: req.user._id.toString()
    });
    return next(error);
  }
};

/**
 * Remove WATI WhatsApp Configuration
 * Clear WATI credentials from database
 */
exports.removeWatiConfig = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    whatsappLogger.info('WATI_REMOVE', 'Removing WATI configuration', {
      userId: userId.toString()
    });
    
    // Clear WATI configuration
    await User.findByIdAndUpdate(userId, {
      $unset: { watiWhatsApp: 1 }
    });
    
    whatsappLogger.success('WATI_REMOVE', 'WATI configuration removed', {
      userId: userId.toString()
    });
    
    res.json({
      success: true,
      message: 'WATI WhatsApp configuration removed successfully'
    });
    
  } catch (error) {
    whatsappLogger.error('WATI_REMOVE', 'Failed to remove WATI configuration', {
      error: error.message,
      userId: req.user._id.toString()
    });
    return next(error);
  }
};

/**
 * Send Message via WATI
 * Send WhatsApp message using WATI API
 */
exports.sendWatiMessage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { to, message, templateName, templateParams } = req.body;
    
    whatsappLogger.info('WATI_SEND', 'WATI message send request', {
      userId: userId.toString(),
      to: to,
      hasTemplate: !!templateName
    });
    
    // Get user's WATI configuration
    const user = await User.findById(userId).select('watiWhatsApp');
    
    if (!user || !user.watiWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WATI WhatsApp not configured. Please configure WATI first.'
      });
    }
    
    const { apiKey, instanceId, baseUrl } = user.watiWhatsApp;
    
    // Prepare message payload
    let messagePayload;
    
    if (templateName) {
      // Template message
      messagePayload = {
        template_name: templateName,
        broadcast_name: `template_${Date.now()}`,
        parameters: templateParams || []
      };
    } else {
      // Text message
      messagePayload = {
        messageText: message
      };
    }
    
    // Send via WATI API
    const response = await axios.post(
      `${baseUrl}/api/v1/sendSessionMessage/${instanceId}?whatsappNumber=${to}`,
      messagePayload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const messageId = response.data?.messageId || response.data?.id;
    
    whatsappLogger.success('WATI_SEND', 'WATI message sent successfully', {
      userId: userId.toString(),
      to: to,
      messageId: messageId
    });
    
    res.json({
      success: true,
      messageId: messageId,
      message: 'WhatsApp message sent successfully via WATI'
    });
    
  } catch (error) {
    whatsappLogger.error('WATI_SEND', 'Failed to send WATI message', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString()
    });
    
    const errorMessage = error.response?.data?.message || 'Failed to send WhatsApp message via WATI';
    res.status(error.response?.status || 500).json({
      success: false,
      message: errorMessage,
      error: error.response?.data?.error
    });
  }
};

/**
 * Get WATI Templates
 * Fetch available templates from WATI
 */
exports.getWatiTemplates = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    // Get user's WATI configuration
    const user = await User.findById(userId).select('watiWhatsApp');
    
    if (!user || !user.watiWhatsApp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WATI WhatsApp not configured. Please configure WATI first.'
      });
    }
    
    const { apiKey, instanceId, baseUrl } = user.watiWhatsApp;
    
    // Fetch templates from WATI
    const response = await axios.get(
      `${baseUrl}/api/v1/getMessageTemplates/${instanceId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    res.json({
      success: true,
      templates: response.data || [],
      message: 'WATI templates retrieved successfully'
    });
    
  } catch (error) {
    whatsappLogger.error('WATI_TEMPLATES', 'Failed to get WATI templates', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString()
    });
    
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to retrieve WATI templates',
      error: error.response?.data?.error
    });
  }
};
