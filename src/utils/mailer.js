const nodemailer = require("nodemailer");

// const transporter = nodemailer.createTransport({
//     host:'bh-in-11.webhostbox.net',
//     port:587, 
//     secure: false,  
//     auth: {
//         user:'erp@dev.technians.com',
//         pass:'$8?fbtt0.ZSA',
//     },
//     tls: {
//         rejectUnauthorized: false,
//     },
// });

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'hey@mimz.com',
        pass: 'paez tfsp rjvv dfib',
    },
    tls: {
        rejectUnauthorized: false,
    },
});



const sendEmail = async (to, subject, htmlContent) => {

    const mailOptions = {
        from: 'hey@mimz.com',
        to,
        subject,
        html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);


    console.log("Email sent successfully: %s", info?.accepted);

};

const sendInvoiceEmail = async (to, subject, htmlContent, attachments = []) => {
    try {
        const mailOptions = {
            from: 'hey@mimz.com',
            to,
            subject,
            html: htmlContent,
            attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent successfully:", info?.accepted);
        return info;
    } catch (error) {
        console.error("Email sending failed:", error.message);
        throw new Error("Email sending failed: " + error.message);
    }
};

module.exports = sendInvoiceEmail;


module.exports = {
    sendEmail,
    sendInvoiceEmail
};
