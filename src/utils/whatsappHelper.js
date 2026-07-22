const axios = require('axios');
const whatsappLogger = require('./whatsappLogger');
const campaignLogger = require('./campaignLogger');

/**
 * Send WhatsApp message using Meta Cloud API
 * @param {Object} whatsappObject - WhatsApp message configuration
 * @param {string} whatsappObject.phoneNumberId - Meta WhatsApp Phone Number ID
 * @param {string} whatsappObject.accessToken - Meta Access Token
 * @param {string} whatsappObject.to - Recipient phone number (with country code, no + sign)
 * @param {string} whatsappObject.message - Message text to send (optional if using template)
 * @param {string} whatsappObject.templateName - Template name (optional, defaults to 'hello_world')
 * @returns {Promise<Object>} - Response from Meta API
 */
const sendWhatsApp = async (whatsappObject) => {
    try {
        whatsappLogger.info('SEND_MESSAGE', 'Starting WhatsApp send', {
            to: whatsappObject.to.substring(0, 4) + '***' + whatsappObject.to.substring(-4),
            messageLength: whatsappObject.message?.length || 0,
            phoneNumberId: whatsappObject.phoneNumberId,
            templateName: whatsappObject.templateName || 'hello_world',
            isTestingMode: whatsappObject.isTestingMode || false
        });

        // Handle testing mode - only send to test numbers
        if (whatsappObject.isTestingMode) {
            whatsappLogger.info('SEND_MESSAGE', 'Testing mode detected', {
                phoneNumberId: whatsappObject.phoneNumberId,
                testNumber: whatsappObject.to
            });
            
            // In testing mode, we'll simulate a successful send
            // but log that it's a test message
            whatsappLogger.info('SEND_MESSAGE', 'Test message simulated (no actual send)', {
                to: whatsappObject.to,
                templateName: whatsappObject.templateName || 'hello_world',
                note: 'This is a test message - no actual WhatsApp message was sent'
            });
            
            return {
                success: true,
                messageId: `test_${Date.now()}`,
                status: 'sent',
                isTestMessage: true,
                note: 'Test message - add a real phone number for production use'
            };
        }

        // Optional: Validate phone number ownership before sending (skip for multi-tenant to avoid extra API calls)
        // This validation can be enabled if needed, but it adds an extra API call
        // For multi-tenant setups, we trust the phone number is valid since it comes from Meta's embedded signup
        
        // Meta WhatsApp Cloud API endpoint
        const url = `https://graph.facebook.com/v22.0/${whatsappObject.phoneNumberId}/messages`;

        // Use template message (default: hello_world) for business-initiated conversations
        // This works for form submissions and cold outreach
        const templateLanguage = whatsappObject.templateLanguage || "en_US"; // Use template's language or default to en_US
        
        const payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: whatsappObject.to, // Must be in format: country code + number (e.g., "919876543210")
            type: "template",
            template: {
                name: whatsappObject.templateName || "hello_world", // Default Meta-approved template
                language: {
                    code: templateLanguage // Use template's actual language code
                }
            }
        };

        campaignLogger.apiRequest('Meta WhatsApp Cloud API', payload, {
            url,
            templateName: payload.template.name,
            languageCode: templateLanguage,
            phoneNumberId: whatsappObject.phoneNumberId,
            hasAccessToken: !!whatsappObject.accessToken,
            note: templateLanguage !== "en_US" ? `Using template's language: ${templateLanguage}` : "Using default language: en_US"
        });

        whatsappLogger.info('SEND_MESSAGE', `Sending template: ${payload.template.name}`, {
            templateName: payload.template.name,
            phoneNumberId: whatsappObject.phoneNumberId,
            to: whatsappObject.to.substring(0, 4) + '***' + whatsappObject.to.substring(-4),
            language: payload.template.language.code
        });
        whatsappLogger.apiRequest(url, payload);
        
        // Make API request to Meta
        let response;
        try {
            response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${whatsappObject.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            campaignLogger.apiResponse('Meta WhatsApp Cloud API', response.data, 'success', {
                status: response.status,
                statusText: response.statusText,
                messageId: response.data.messages?.[0]?.id,
                templateName: payload.template.name
            });

            whatsappLogger.success('SEND_MESSAGE', 'WhatsApp message sent successfully', {
                messageId: response.data.messages?.[0]?.id,
                status: response.status,
                to: whatsappObject.to.substring(0, 4) + '***' + whatsappObject.to.substring(-4)
            });

            whatsappLogger.apiResponse(url, response.data, 'success');

            return {
                success: true,
                messageId: response.data.messages?.[0]?.id,
                data: response.data
            };
        } catch (apiError) {
            // Re-throw to be handled by outer catch
            throw apiError;
        }

    } catch (error) {
        campaignLogger.apiResponse('Meta WhatsApp Cloud API', error.response?.data, 'error', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            errorCode: error.response?.data?.error?.code,
            errorType: error.response?.data?.error?.type,
            errorMessage: error.response?.data?.error?.message,
            errorUserMsg: error.response?.data?.error?.error_user_msg,
            errorSubcode: error.response?.data?.error?.error_subcode,
            fbtraceId: error.response?.data?.error?.fbtrace_id,
            templateName: whatsappObject.templateName
        });

        const errorData = {
            error: error.response?.data || error.message,
            statusCode: error.response?.status
        };

        whatsappLogger.error('SEND_MESSAGE', 'WhatsApp send failed', errorData);

        // Handle Meta API specific errors
        let errorMessage = 'Failed to send WhatsApp message';
        
        if (error.response?.data?.error) {
            const metaError = error.response.data.error;
            errorMessage = metaError.message || metaError.error_user_msg || errorMessage;
            
            // Log specific error details
            whatsappLogger.error('META_API_ERROR', 'Meta API returned error', {
                code: metaError.code,
                type: metaError.type,
                message: metaError.message,
                fbtrace_id: metaError.fbtrace_id,
                error_subcode: metaError.error_subcode,
                templateName: whatsappObject.templateName,
                phoneNumberId: whatsappObject.phoneNumberId
            });
            
            // Provide more helpful error messages for common errors
            if (metaError.error_subcode === 132000) {
                errorMessage = `Template "${whatsappObject.templateName}" not found or not approved. Please check if the template exists and is approved in Meta Business Manager.`;
            } else if (metaError.code === 100) {
                // Error code 100 can mean different things based on error_subcode
                if (metaError.error_subcode === 33) {
                    // Object does not exist or cannot be loaded due to missing permissions
                    errorMessage = `Phone number ID "${whatsappObject.phoneNumberId}" does not exist or cannot be accessed with the current access token. This usually means the phone number belongs to a different Meta app than the access token. Please ensure the phone number and access token are from the same Meta Business Account.`;
                } else {
                    errorMessage = `Invalid request. The phone number ID or template may not be accessible. Original error: ${metaError.message}`;
                }
            } else if (metaError.type === 'OAuthException') {
                errorMessage = `Authentication failed. Please check your WhatsApp access token. Original error: ${metaError.message}`;
            } else if (metaError.type === 'GraphMethodException') {
                errorMessage = `API method error: ${metaError.message}. This may indicate the phone number ID or access token is invalid or belongs to a different Meta app.`;
            }
        }

        whatsappLogger.apiResponse('Meta API', error.response?.data, 'error');

        throw new Error(errorMessage);
    }
};

/**
 * Validate WhatsApp credentials by sending a test message
 * @param {Object} credentials - WhatsApp credentials to validate
 * @returns {Promise<Object>} - Validation result
 */
const validateWhatsAppCredentials = async (credentials) => {
    try {
        const { phoneNumberId, accessToken } = credentials;
        
        whatsappLogger.info('VALIDATE_CREDENTIALS', 'Starting credential validation', {
            phoneNumberId: phoneNumberId ? phoneNumberId.substring(0, 6) + '***' : null,
            hasAccessToken: !!accessToken
        });
        
        // Check if credentials exist
        if (!phoneNumberId || !accessToken) {
            whatsappLogger.error('VALIDATE_CREDENTIALS', 'Missing credentials');
            throw new Error('Missing WhatsApp credentials');
        }

        // Verify by calling Meta API to get phone number details
        const url = `https://graph.facebook.com/v22.0/${phoneNumberId}`;
        
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            params: {
                fields: 'verified_name,display_phone_number,quality_rating'
            }
        });

        whatsappLogger.success('VALIDATE_CREDENTIALS', 'WhatsApp credentials validated', {
            verifiedName: response.data.verified_name,
            phoneNumber: response.data.display_phone_number,
            qualityRating: response.data.quality_rating
        });

        whatsappLogger.validation('Credential validation', true, response.data);

        return {
            valid: true,
            details: response.data
        };

    } catch (error) {
        whatsappLogger.error('VALIDATE_CREDENTIALS', 'Credential validation failed', {
            error: error.response?.data || error.message
        });

        whatsappLogger.validation('Credential validation', false, {
            error: error.response?.data?.error?.message || error.message
        });

        return {
            valid: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
};

module.exports = { 
    sendWhatsApp,
    validateWhatsAppCredentials
};
