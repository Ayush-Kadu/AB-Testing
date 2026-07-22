const fs = require('fs');
const path = require('path');

/**
 * WhatsApp Logger - Logs all WhatsApp-related activities to a dedicated file
 */

const LOG_DIR = path.join(__dirname, '../../logs');
const WHATSAPP_LOG_FILE = path.join(LOG_DIR, 'whatsapp.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Format timestamp for logs
 */
const getTimestamp = () => {
    return new Date().toISOString();
};

/**
 * Write log entry to file
 */
const writeLog = (level, category, message, data = null) => {
    const logEntry = {
        timestamp: getTimestamp(),
        level: level.toUpperCase(),
        category,
        message,
        data: data || undefined
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    // Append to log file
    fs.appendFile(WHATSAPP_LOG_FILE, logLine, (err) => {
        if (err) {
            console.error('Failed to write to WhatsApp log file:', err);
        }
    });

    // Also log to console for real-time monitoring
    const consoleMessage = `[${level.toUpperCase()}] [${category}] ${message}`;
    if (level === 'error') {
        console.error(consoleMessage, data || '');
    } else if (level === 'warn') {
        console.warn(consoleMessage, data || '');
    } else {
        console.log(consoleMessage, data || '');
    }
};

/**
 * Log levels
 */
const whatsappLogger = {
    // Info level - general information
    info: (category, message, data) => {
        writeLog('info', category, message, data);
    },

    // Success level - successful operations
    success: (category, message, data) => {
        writeLog('success', category, message, data);
    },

    // Warning level - potential issues
    warn: (category, message, data) => {
        writeLog('warn', category, message, data);
    },

    // Error level - failures and errors
    error: (category, message, data) => {
        writeLog('error', category, message, data);
    },

    // Debug level - detailed debugging info
    debug: (category, message, data) => {
        writeLog('debug', category, message, data);
    },

    // Log API request
    apiRequest: (endpoint, payload) => {
        writeLog('info', 'API_REQUEST', `Calling ${endpoint}`, {
            endpoint,
            payload: {
                to: payload.to ? payload.to.substring(0, 4) + '***' + payload.to.substring(-4) : null,
                type: payload.type,
                template: payload.template?.name || null,
                hasAccessToken: !!payload.accessToken
            }
        });
    },

    // Log API response
    apiResponse: (endpoint, response, status) => {
        writeLog(status === 'success' ? 'success' : 'error', 'API_RESPONSE', `Response from ${endpoint}`, {
            status,
            messageId: response?.messages?.[0]?.id || null,
            error: response?.error || null
        });
    },

    // Log configuration changes
    configChange: (userId, action, details) => {
        writeLog('info', 'CONFIG_CHANGE', `WhatsApp config ${action} for user ${userId}`, details);
    },

    // Log message sending
    messageSent: (userId, phoneNumber, campaignId, status) => {
        writeLog(status === 'sent' ? 'success' : 'error', 'MESSAGE_SENT', 
            `WhatsApp message ${status} for campaign ${campaignId}`, {
            userId,
            to: phoneNumber ? phoneNumber.substring(0, 4) + '***' + phoneNumber.substring(-4) : null,
            campaignId,
            status
        });
    },

    // Log validation
    validation: (action, result, details) => {
        writeLog(result ? 'success' : 'error', 'VALIDATION', `${action}: ${result ? 'Passed' : 'Failed'}`, details);
    }
};

/**
 * Read recent logs (for debugging/monitoring)
 */
whatsappLogger.readRecentLogs = (lines = 50) => {
    try {
        if (!fs.existsSync(WHATSAPP_LOG_FILE)) {
            return [];
        }

        const content = fs.readFileSync(WHATSAPP_LOG_FILE, 'utf-8');
        const allLines = content.trim().split('\n');
        const recentLines = allLines.slice(-lines);

        return recentLines.map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return { error: 'Invalid log entry', raw: line };
            }
        });
    } catch (error) {
        console.error('Error reading WhatsApp logs:', error);
        return [];
    }
};

/**
 * Clear old logs (optional - for maintenance)
 */
whatsappLogger.clearLogs = () => {
    try {
        if (fs.existsSync(WHATSAPP_LOG_FILE)) {
            fs.unlinkSync(WHATSAPP_LOG_FILE);
            console.log('✅ WhatsApp logs cleared');
        }
    } catch (error) {
        console.error('Error clearing WhatsApp logs:', error);
    }
};

module.exports = whatsappLogger;
