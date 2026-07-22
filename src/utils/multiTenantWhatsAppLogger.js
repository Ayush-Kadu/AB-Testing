const fs = require('fs');
const path = require('path');

class MultiTenantWhatsAppLogger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.logFile = path.join(this.logDir, 'multi-tenant-whatsapp.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, action, message, data = null) {
    const timestamp = new Date().toISOString();
    
    // Safely stringify data, handling circular references and non-serializable values
    let dataString = null;
    if (data) {
      try {
        // Create a replacer function to handle circular references and special objects
        const seen = new WeakSet();
        dataString = JSON.stringify(data, (key, value) => {
          // Skip circular references
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          // Handle non-serializable values
          if (value instanceof Error) {
            return {
              name: value.name,
              message: value.message,
              stack: value.stack
            };
          }
          // Handle functions
          if (typeof value === 'function') {
            return '[Function]';
          }
          // Handle undefined
          if (value === undefined) {
            return '[undefined]';
          }
          return value;
        }, 2);
      } catch (error) {
        // If stringification fails, use a safe fallback
        dataString = `[Unable to stringify data: ${error.message}]`;
      }
    }
    
    return `[${timestamp}] [${level}] [${action}] ${message}${dataString ? '\n' + dataString : ''}`;
  }

  writeToFile(message) {
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(action, message, data = null) {
    const logMessage = this.formatMessage('INFO', action, message, data);
    console.log(`📋 [MULTI-TENANT] ${logMessage}`);
    this.writeToFile(logMessage);
  }

  success(action, message, data = null) {
    const logMessage = this.formatMessage('SUCCESS', action, message, data);
    console.log(`✅ [MULTI-TENANT] ${logMessage}`);
    this.writeToFile(logMessage);
  }

  error(action, message, data = null) {
    const logMessage = this.formatMessage('ERROR', action, message, data);
    console.error(`❌ [MULTI-TENANT] ${logMessage}`);
    this.writeToFile(logMessage);
  }

  warn(action, message, data = null) {
    const logMessage = this.formatMessage('WARN', action, message, data);
    console.warn(`⚠️ [MULTI-TENANT] ${logMessage}`);
    this.writeToFile(logMessage);
  }

  debug(action, message, data = null) {
    const logMessage = this.formatMessage('DEBUG', action, message, data);
    console.log(`🔍 [MULTI-TENANT] ${logMessage}`);
    this.writeToFile(logMessage);
  }

  // Specific logging methods for different operations
  embeddedSignupStart(userId, data) {
    this.info('EMBEDDED_SIGNUP_START', 'Embedded signup process started', {
      userId: userId.toString(),
      phoneNumberId: data.phone_number_id,
      wabaId: data.waba_id
    });
  }

  embeddedSignupSuccess(userId, data) {
    this.success('EMBEDDED_SIGNUP_SUCCESS', 'Embedded signup completed successfully', {
      userId: userId.toString(),
      phoneNumberId: data.phone_number_id,
      wabaId: data.waba_id
    });
  }

  embeddedSignupError(userId, error) {
    this.error('EMBEDDED_SIGNUP_ERROR', 'Embedded signup failed', {
      userId: userId.toString(),
      error: error.message,
      stack: error.stack
    });
  }

  backgroundJobStart(phoneNumberId, userId) {
    this.info('BACKGROUND_JOB_START', 'Background job started to fetch phone details', {
      phoneNumberId,
      userId: userId.toString()
    });
  }

  backgroundJobSuccess(phoneNumberId, userId, phoneDetails) {
    this.success('BACKGROUND_JOB_SUCCESS', 'Background job completed successfully', {
      phoneNumberId,
      userId: userId.toString(),
      phoneDetails: {
        displayNumber: phoneDetails.display_phone_number,
        verifiedName: phoneDetails.verified_name,
        qualityRating: phoneDetails.quality_rating,
        status: phoneDetails.status
      }
    });
  }

  backgroundJobError(phoneNumberId, userId, error, systemTokenInfo = null) {
    // Handle both Error objects and plain error objects
    const errorData = {
      phoneNumberId,
      userId: userId.toString(),
      error: error?.message || error?.error || 'Unknown error',
      // Meta API Error Details
      metaApiError: error?.response?.data?.error ? {
        message: error.response.data.error.message,
        type: error.response.data.error.type,
        code: error.response.data.error.code,
        error_subcode: error.response.data.error.error_subcode,
        fbtrace_id: error.response.data.error.fbtrace_id,
        error_user_title: error.response.data.error.error_user_title,
        error_user_msg: error.response.data.error.error_user_msg
      } : null,
      // HTTP Response Details
      httpStatus: error?.status || error?.response?.status || null,
      httpStatusText: error?.response?.statusText || null,
      // Error Object Details
      errorCode: error?.code || error?.errorCode || null,
      errorSubcode: error?.errorSubcode || null,
      errorType: error?.errorType || error?.type || null,
      // Additional Context
      directError: error?.directError || null,
      wabaError: error?.wabaError || null,
      possibleReasons: error?.possibleReasons || null,
      // System Token Information
      systemToken: systemTokenInfo ? {
        source: systemTokenInfo.source || 'unknown', // 'environment', 'database', 'code_exchange'
        hasToken: !!systemTokenInfo.token,
        tokenLength: systemTokenInfo.token?.length || 0,
        tokenPreview: systemTokenInfo.token ? systemTokenInfo.token.substring(0, 20) + '...' : 'none',
        isFromCodeExchange: systemTokenInfo.source === 'code_exchange',
        isFromDatabase: systemTokenInfo.source === 'database',
        isFromEnvironment: systemTokenInfo.source === 'environment'
      } : null,
      // Request Details
      requestUrl: error?.config?.url || error?.requestUrl || null,
      requestMethod: error?.config?.method || error?.requestMethod || null,
      // Timestamp
      timestamp: new Date().toISOString()
    };
    
    this.error('BACKGROUND_JOB_ERROR', 'Background job failed - Detailed error information', errorData);
  }

  systemTokenCheck(tokenPresent, tokenLength) {
    this.info('SYSTEM_TOKEN_CHECK', 'System User Token configuration check', {
      tokenPresent,
      tokenLength,
      tokenStartsWith: tokenPresent ? 'EAAKwc0W1T...' : 'N/A'
    });
  }

  systemTokenValid(permissions) {
    this.success('SYSTEM_TOKEN_VALID', 'System User Token is valid', {
      permissions: permissions || []
    });
  }

  systemTokenInvalid(error) {
    this.error('SYSTEM_TOKEN_INVALID', 'System User Token is invalid', {
      error: error.message,
      response: error.response?.data
    });
  }

  businessAccountTest(wabaId, success, data) {
    if (success) {
      this.success('BUSINESS_ACCOUNT_TEST', 'Business Account access test successful', {
        wabaId,
        businessName: data.name || data.data?.name,
        businessId: data.id || data.data?.id
      });
    } else {
      this.error('BUSINESS_ACCOUNT_TEST', 'Business Account access test failed', {
        wabaId,
        error: data.error
      });
    }
  }

  phoneDetailsFetch(phoneNumberId, fields, success, data) {
    if (success) {
      this.success('PHONE_DETAILS_FETCH', 'Phone details fetched successfully', {
        phoneNumberId,
        fields,
        displayNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
        status: data.status
      });
    } else {
      this.error('PHONE_DETAILS_FETCH', 'Phone details fetch failed', {
        phoneNumberId,
        fields,
        error: data.error
      });
    }
  }

  databaseUpdate(userId, operation, success, data) {
    if (success) {
      this.success('DATABASE_UPDATE', `Database ${operation} successful`, {
        userId: userId.toString(),
        operation,
        updatedFields: Object.keys(data)
      });
    } else {
      this.error('DATABASE_UPDATE', `Database ${operation} failed`, {
        userId: userId.toString(),
        operation,
        error: data.error
      });
    }
  }

  templateFetch(phoneNumberId, success, templates) {
    if (success) {
      this.success('TEMPLATE_FETCH', 'Templates fetched successfully', {
        phoneNumberId,
        templatesCount: templates.length
      });
    } else {
      this.error('TEMPLATE_FETCH', 'Template fetch failed', {
        phoneNumberId,
        error: templates.error
      });
    }
  }

  templateCreate(phoneNumberId, templateName, success, data) {
    if (success) {
      this.success('TEMPLATE_CREATE', 'Template created successfully', {
        phoneNumberId,
        templateName,
        templateId: data.id
      });
    } else {
      this.error('TEMPLATE_CREATE', 'Template creation failed', {
        phoneNumberId,
        templateName,
        error: data.error
      });
    }
  }

  templateDelete(phoneNumberId, templateName, success, data) {
    if (success) {
      this.success('TEMPLATE_DELETE', 'Template deleted successfully', {
        phoneNumberId,
        templateName
      });
    } else {
      this.error('TEMPLATE_DELETE', 'Template deletion failed', {
        phoneNumberId,
        templateName,
        error: data.error
      });
    }
  }

  messageSend(phoneNumberId, to, success, data) {
    if (success) {
      this.success('MESSAGE_SEND', 'Message sent successfully', {
        phoneNumberId,
        to,
        messageId: data.messageId
      });
    } else {
      this.error('MESSAGE_SEND', 'Message send failed', {
        phoneNumberId,
        to,
        error: data.error
      });
    }
  }

  disconnect(userId, success, data) {
    if (success) {
      this.success('DISCONNECT', 'WhatsApp disconnected successfully', {
        userId: userId.toString()
      });
    } else {
      this.error('DISCONNECT', 'WhatsApp disconnect failed', {
        userId: userId.toString(),
        error: data.error
      });
    }
  }

  // Utility method to get recent logs
  getRecentLogs(lines = 100) {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }
      
      const logContent = fs.readFileSync(this.logFile, 'utf8');
      const logLines = logContent.split('\n').filter(line => line.trim());
      return logLines.slice(-lines);
    } catch (error) {
      console.error('Failed to read log file:', error);
      return [];
    }
  }

  // Utility method to clear logs
  clearLogs() {
    try {
      if (fs.existsSync(this.logFile)) {
        fs.writeFileSync(this.logFile, '');
        this.info('LOG_CLEAR', 'Log file cleared');
      }
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }
}

module.exports = new MultiTenantWhatsAppLogger();
