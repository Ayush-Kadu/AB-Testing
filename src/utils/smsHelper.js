const twilio = require("twilio");
const SmsCredential = require("../models/userSmsCredentials.model"); // adjust path if needed

/**
 * Reusable Twilio SMS helper.
 * @param {Object} smsObject
 * @param {string} smsObject.userId - User ID from MongoDB
 * @param {string} smsObject.dstNumber - Recipient phone number with country code
 * @param {string} smsObject.message - Message content
 */
const sendSMS = async (smsObject) => {
    try {
        console.log("Twilio SMS Helper - Starting SMS send...");

        const { userId, dstNumber, message } = smsObject;

        if (!userId || !dstNumber || !message) {
            throw new Error("Missing required fields: userId, dstNumber, or message.");
        }

        // Find user's active SMS credentials
        const cred = await SmsCredential.findOne({ userId, active: true });
        if (!cred) {
            throw new Error("No active SMS credential found for this user.");
        }

        // Only Twilio platform supported for now
        if (cred.platform !== "twilio") {
            throw new Error("Only Twilio configuration is supported currently.");
        }

        const client = twilio(cred.credentials.accountSID, cred.credentials.authToken);

        // Choose sender ID based on type
        const from =
            cred.credentials.senderType === "messagingService"
                ? cred.credentials.messagingServiceSid
                : cred.credentials.senderId;

        if (!from) {
            throw new Error("Sender ID or Messaging Service SID missing in credentials.");
        }

        // Ensure recipient number starts with '+' (E.164 format)
        let formattedTo = dstNumber.trim();
        if (!formattedTo.startsWith('+')) {
            formattedTo = '+' + formattedTo;
        }

        // Send SMS
        const sms = await client.messages.create({
            from,
            body: message,
            to: formattedTo,
        });

        console.log("✅ SMS sent successfully:", sms.sid);

        // Return useful info to caller
        return {
            success: true,
            sid: sms.sid,
            message: "Test SMS sent successfully!",
        };
    } catch (error) {
        console.error("❌ Twilio SMS send failed:", {
            error: error.message,
            code: error.code,
            moreInfo: error.moreInfo,
            timestamp: new Date().toISOString(),
        });

        return {
            success: false,
            message: error.message || "Failed to send SMS",
        };
    }
};

module.exports = { sendSMS };
