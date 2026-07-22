const sgMail = require('@sendgrid/mail');
const CredentialModel = require('./../models/credentialsModel');
const ErrorHandler = require('./errorHandler');



const sendSendGridMail = async (mailObj) => {
    try {
        const cred = await CredentialModel.findOne({ isDelete: false, credName: 'sendGrid' });
        if (!cred) {
            throw new Error('Sendgrid credentials not found.');
        }

        sgMail.setApiKey(cred.apiKey);

        console.log(cred.apiKey);

        const msg = {
            to: mailObj.email,
            from: cred.sendEmail, // Make sure this is a verified sender
            subject: mailObj.subject,
            html: mailObj.mailHtml,
        };

        await sgMail.send(msg);
        console.log('✅ Email sent');

    } catch (error) {
        const errorMsg = error?.response?.body?.errors?.map(e => e.message).join(', ') || error.message || 'Unknown error';
        throw new Error(`SendGrid error: ${errorMsg}`);
    }
};


module.exports = sendSendGridMail