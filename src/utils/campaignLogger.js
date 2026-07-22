const fs = require('fs');
const path = require('path');

/**
 * Campaign Logger - Logs all campaign-related activities to a dedicated file
 * This includes WhatsApp campaign sends, SMS campaigns, Email campaigns, and stats
 */

const LOG_DIR = path.join(__dirname, '../../logs');
const CAMPAIGN_LOG_FILE = path.join(LOG_DIR, 'campaign.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`📁 Created logs directory: ${LOG_DIR}`);
}

// Log the file path on initialization (for debugging)
console.log(`📝 Campaign log file will be created at: ${CAMPAIGN_LOG_FILE}`);

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
    fs.appendFile(CAMPAIGN_LOG_FILE, logLine, (err) => {
        if (err) {
            console.error(`❌ Failed to write to campaign log file (${CAMPAIGN_LOG_FILE}):`, err);
            console.error('Error details:', {
                code: err.code,
                message: err.message,
                path: CAMPAIGN_LOG_FILE,
                logDirExists: fs.existsSync(LOG_DIR),
                logFileExists: fs.existsSync(CAMPAIGN_LOG_FILE)
            });
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
const campaignLogger = {
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

    // Log campaign send start
    campaignSendStart: (campaignType, campaignId, data) => {
        writeLog('info', 'CAMPAIGN_SEND_START', `${campaignType} campaign send started`, {
            campaignType,
            campaignId,
            ...data
        });
    },

    // Log campaign send end
    campaignSendEnd: (campaignType, campaignId, success, data) => {
        writeLog(success ? 'success' : 'error', 'CAMPAIGN_SEND_END', 
            `${campaignType} campaign send ${success ? 'completed' : 'failed'}`, {
            campaignType,
            campaignId,
            success,
            ...data
        });
    },

    // Log template resolution
    templateResolution: (campaignId, templateName, isDefault, data) => {
        writeLog(isDefault ? 'warn' : 'info', 'TEMPLATE_RESOLUTION', 
            `Template resolved: ${templateName}${isDefault ? ' (default)' : ''}`, {
            campaignId,
            templateName,
            isDefault,
            ...data
        });
    },

    // Log API request
    apiRequest: (endpoint, payload, data) => {
        writeLog('info', 'API_REQUEST', `Calling ${endpoint}`, {
            endpoint,
            payload: payload || null,
            ...data
        });
    },

    // Log API response
    apiResponse: (endpoint, response, status, data) => {
        writeLog(status === 'success' ? 'success' : 'error', 'API_RESPONSE', 
            `Response from ${endpoint}`, {
            endpoint,
            status,
            response: response || null,
            ...data
        });
    },

    // Log stats query
    statsQuery: (campaignId, query, data) => {
        writeLog('info', 'STATS_QUERY', `Fetching stats for campaign ${campaignId}`, {
            campaignId,
            query,
            ...data
        });
    }
};

/**
 * Read recent logs (for debugging/monitoring)
 */
campaignLogger.readRecentLogs = (lines = 100) => {
    try {
        if (!fs.existsSync(CAMPAIGN_LOG_FILE)) {
            return [];
        }

        const content = fs.readFileSync(CAMPAIGN_LOG_FILE, 'utf-8');
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
        console.error('Error reading campaign logs:', error);
        return [];
    }
};

/**
 * Clear old logs (optional - for maintenance)
 */
campaignLogger.clearLogs = () => {
    try {
        if (fs.existsSync(CAMPAIGN_LOG_FILE)) {
            fs.unlinkSync(CAMPAIGN_LOG_FILE);
            console.log('✅ Campaign logs cleared');
        }
    } catch (error) {
        console.error('Error clearing campaign logs:', error);
    }
};

module.exports = campaignLogger;

