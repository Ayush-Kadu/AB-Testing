const { sendEmail } = require('./mailer');
const { sendSendGridMail } = require('./sendGridMailer');
const sendEmailCampaign = async (emailObject) => {
    try {
        console.log('📧 Email Helper - Starting email send...');
        console.log('📧 Email Details:', {
            to: emailObject.to,
            subject: emailObject.subject,
            messageLength: emailObject.message?.length || 0,
            timestamp: new Date().toISOString()
        });

        const result = await sendEmail(
            emailObject.to,
            emailObject.subject,
            emailObject.message
        );

        console.log('✅ Email sent successfully:', {
            messageId: result?.messageId,
            accepted: result?.accepted,
            timestamp: new Date().toISOString()
        });

        return result;
    } catch (error) {
        console.error("❌ Email send failed:", {
            error: error.message,
            timestamp: new Date().toISOString()
        });
        throw new Error(error.message || 'Failed to send email');
    }
};

module.exports = { sendEmailCampaign };
