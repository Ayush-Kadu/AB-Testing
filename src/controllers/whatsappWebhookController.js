const crypto = require('crypto');
const SMSActivity = require('../models/SMSActivity.model');
const campaignLogger = require('../utils/campaignLogger');
const { whatsappLogger } = require('../utils/whatsappLogger');

/**
 * WhatsApp Webhook Verification
 * Meta requires this endpoint to verify the webhook subscription
 */
exports.verifyWebhook = (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        campaignLogger.info('WEBHOOK_VERIFY', 'Webhook verification request', {
            mode,
            hasToken: !!token,
            hasChallenge: !!challenge
        });

        // Verify the webhook token (should match what you set in Meta Business Manager)
        const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'urlpt_whatsapp_webhook_token_2024';

        if (mode === 'subscribe' && token === verifyToken) {
            campaignLogger.success('WEBHOOK_VERIFY', 'Webhook verified successfully');
            res.status(200).send(challenge);
        } else {
            campaignLogger.warn('WEBHOOK_VERIFY', 'Webhook verification failed', {
                mode,
                tokenMatch: token === verifyToken
            });
            res.status(403).send('Forbidden');
        }
    } catch (error) {
        campaignLogger.error('WEBHOOK_VERIFY', 'Webhook verification error', {
            error: error.message
        });
        res.status(500).send('Error');
    }
};

/**
 * Handle WhatsApp Webhook Events
 * Receives delivery status updates from Meta
 */
exports.handleWebhook = async (req, res) => {
    try {
        const body = req.body;

        campaignLogger.info('WEBHOOK_RECEIVED', 'WhatsApp webhook event received', {
            object: body.object,
            entryCount: body.entry?.length || 0,
            timestamp: new Date().toISOString()
        });

        // Verify this is a WhatsApp webhook
        if (body.object !== 'whatsapp_business_account') {
            campaignLogger.warn('WEBHOOK_RECEIVED', 'Invalid webhook object type', {
                object: body.object
            });
            return res.status(400).json({ error: 'Invalid webhook object' });
        }

        // Process each entry
        if (body.entry && Array.isArray(body.entry)) {
            for (const entry of body.entry) {
                await processWebhookEntry(entry);
            }
        }

        // Always return 200 to acknowledge receipt
        res.status(200).send('OK');

    } catch (error) {
        campaignLogger.error('WEBHOOK_HANDLE', 'Error handling webhook', {
            error: error.message,
            stack: error.stack
        });
        // Still return 200 to prevent Meta from retrying
        res.status(200).send('OK');
    }
};

/**
 * Process a webhook entry
 */
async function processWebhookEntry(entry) {
    try {
        const changes = entry.changes || [];

        for (const change of changes) {
            if (change.field === 'messages') {
                await processMessageChange(change.value);
            }
        }
    } catch (error) {
        campaignLogger.error('WEBHOOK_ENTRY', 'Error processing webhook entry', {
            error: error.message
        });
    }
}

/**
 * Process message status changes
 */
async function processMessageChange(value) {
    try {
        const statuses = value.statuses || [];
        const messages = value.messages || [];

        // Process status updates (delivery, read, failed, etc.)
        for (const status of statuses) {
            await updateMessageStatus(status);
        }

        // Process incoming messages (if any)
        for (const message of messages) {
            await processIncomingMessage(message, value);
        }
    } catch (error) {
        campaignLogger.error('WEBHOOK_MESSAGE', 'Error processing message change', {
            error: error.message
        });
    }
}

/**
 * Update message status in database
 */
async function updateMessageStatus(status) {
    try {
        const messageId = status.id;
        const statusType = status.status; // sent, delivered, read, failed
        const recipientId = status.recipient_id;
        const timestamp = status.timestamp ? new Date(parseInt(status.timestamp) * 1000) : new Date();

        campaignLogger.info('WEBHOOK_STATUS', 'Message status update received', {
            messageId,
            statusType,
            recipientId,
            timestamp: timestamp.toISOString()
        });

        // Find the message by messageId
        const activity = await SMSActivity.findOne({ messageId: messageId });

        if (!activity) {
            campaignLogger.warn('WEBHOOK_STATUS', 'Message not found in database', {
                messageId,
                statusType,
                recipientId
            });
            return;
        }

        // Log the found activity for debugging
        campaignLogger.debug('WEBHOOK_STATUS', 'Found activity record', {
            messageId,
            activityId: activity._id.toString(),
            currentStatus: activity.status,
            campaignId: activity.campaignId?.toString(),
            to: activity.to.substring(0, 4) + '***' + activity.to.substring(-4)
        });

        // Update status based on webhook status
        let newStatus = activity.status;
        let errorMessage = activity.errorMessage;

        switch (statusType) {
            case 'sent':
                // Message was sent (already recorded, but update timestamp if needed)
                newStatus = 'sent';
                break;
            case 'delivered':
                // Message was delivered successfully
                newStatus = 'sent'; // Keep as 'sent' since it's successful
                campaignLogger.success('WEBHOOK_STATUS', 'Message delivered', {
                    messageId,
                    campaignId: activity.campaignId,
                    to: activity.to.substring(0, 4) + '***' + activity.to.substring(-4)
                });
                break;
            case 'read':
                // Message was read by recipient
                newStatus = 'sent'; // Keep as 'sent' since it's successful
                campaignLogger.success('WEBHOOK_STATUS', 'Message read by recipient', {
                    messageId,
                    campaignId: activity.campaignId,
                    to: activity.to.substring(0, 4) + '***' + activity.to.substring(-4)
                });
                break;
            case 'failed':
                // Message failed to deliver
                newStatus = 'failed';
                errorMessage = status.errors?.[0]?.title || status.errors?.[0]?.message || 'Message delivery failed';
                campaignLogger.error('WEBHOOK_STATUS', 'Message delivery failed', {
                    messageId,
                    campaignId: activity.campaignId,
                    error: errorMessage,
                    errorDetails: status.errors
                });
                break;
            default:
                campaignLogger.info('WEBHOOK_STATUS', 'Unknown status type', {
                    messageId,
                    statusType
                });
        }

        // Update the activity record
        await SMSActivity.findByIdAndUpdate(activity._id, {
            status: newStatus,
            errorMessage: errorMessage,
            deliveredAt: statusType === 'delivered' ? timestamp : activity.deliveredAt,
            readAt: statusType === 'read' ? timestamp : activity.readAt,
            updatedAt: timestamp
        });

        campaignLogger.info('WEBHOOK_STATUS', 'Message status updated in database', {
            messageId,
            oldStatus: activity.status,
            newStatus: newStatus,
            statusType: statusType,
            campaignId: activity.campaignId
        });

    } catch (error) {
        campaignLogger.error('WEBHOOK_STATUS_UPDATE', 'Error updating message status', {
            error: error.message,
            stack: error.stack
        });
    }
}

/**
 * Process incoming messages (optional - for two-way conversations)
 */
async function processIncomingMessage(message, value) {
    try {
        campaignLogger.info('WEBHOOK_INCOMING', 'Incoming message received', {
            messageId: message.id,
            from: message.from,
            type: message.type,
            timestamp: message.timestamp
        });

        // You can handle incoming messages here if needed
        // For now, we'll just log them

    } catch (error) {
        campaignLogger.error('WEBHOOK_INCOMING', 'Error processing incoming message', {
            error: error.message
        });
    }
}

module.exports = exports;

