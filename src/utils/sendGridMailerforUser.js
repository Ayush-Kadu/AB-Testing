const sgMail = require('@sendgrid/mail');
const userMailCredentials = require('../models/userMailCredentials.model');
const ErrorHandler = require('./errorHandler');



const sendSendGridMail = async (mailObj) => {
    try {
        const cred = await userMailCredentials.findOne({ active: true, platform: 'sendGrid' });
        if (!cred) {
            throw new Error('Sendgrid credentials not found.');
        }
        sgMail.setApiKey(cred.credentials.apiKey);

        //  console.log(cred.credentials.apiKey);

        const msg = {
            to: mailObj.email,
            from: cred.credentials.senderEmail, // Make sure this is a verified sender
            subject: mailObj.subject,
            html: mailObj.mailHtml,
        };

        await sgMail.send(msg);
        console.log('Email sent');

    } catch (error) {
        const errorMsg = error?.response?.body?.errors?.map(e => e.message).join(', ') || error.message || 'Unknown error';
        throw new Error(`SendGrid error: ${errorMsg}`);
    }
};


module.exports = sendSendGridMail