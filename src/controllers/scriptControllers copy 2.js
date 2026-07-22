const { default: mongoose } = require("mongoose")
const ErrorHandler = require("../utils/errorHandler")
const User = require("../models/user.model")
const Campaign = require('../models/user.campaign.model')
const EmailActivity = require('../models/emailActivity.model');
const SMSActivity = require('../models/SMSActivity.model');
const Usersubscription = require('../models/user.subscription.model');
const packageModel = require("./../models/packageModel");
const Usercampaign = require("../models/user.campaign.model");
const { sendWhatsApp } = require('../utils/whatsappHelper');
const whatsappLogger = require('../utils/whatsappLogger');

const userMailCredentials = require('../models/userMailCredentials.model');
const nodemailer = require("nodemailer");
const sendSendGridMailforuser = require('../utils/sendGridMailerforUser'); // your mailer

exports.getScripts = async (req, res, next) => {
    try {
        const userId = req.query.clientId;
        if (!userId) return next(new ErrorHandler('Please provide a client Id'));

        // Special case: standalone form tracking script
        if (userId === 'htmlFormTrackingScript') {
            const fs = require('fs');
            const path = require('path');
            const scriptPath = path.join(__dirname, '../scripts/scripts-htmlFormTrackingScript.js');

            try {
                const scriptContent = fs.readFileSync(scriptPath, 'utf8');
                return res.type('application/javascript').send(scriptContent);
            } catch (error) {
                console.error('Error reading form tracking script:', error);
                return next(new ErrorHandler('Error fetching form tracking script'));
            }
        }

        // Fetch user and active scripts
        const aggregateQuery = [
            { $match: { _id: new mongoose.Types.ObjectId(userId) } },
            {
                $lookup: {
                    from: 'scripts',
                    let: { userId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$userId', '$$userId'] },
                                        { $eq: ['$isDelete', false] },
                                        { $eq: ['$isActive', true] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'scripts'
                }
            }
        ];

        const [user] = await User.aggregate(aggregateQuery);
        if (!user) return next(new ErrorHandler('No data found.'));
        if (user.isDeleted) return next(new ErrorHandler('User Deactivated.'));

        const normalize = (url) => {
            if (!url) return "";
            try {
                const u = new URL(url);
                return (u.hostname + u.pathname).replace(/\/$/, "");
            } catch {
                return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
            }
        };


        // Current referrer
        const referrer = req.headers.referer || req.headers.referrer || '';

        let domain = 'localhost';
        let pathName = '/';
        if (referrer) {
            try {
                const url = new URL(referrer);
                domain = url.hostname;       // dev.technians.com
                pathName = url.pathname;     // /newuser/ddsfs
            } catch { }
        }
        const fullDomain = normalize(domain + pathName); // dev.technians.com/newuser/ddsfs

        // Check if any active website matches or is a parent
        const isDomainAllowed = user.websites?.some(site => {
            const siteUrl = normalize(site.website); // e.g. dev.technians.com/newuser
            return site?.isActive && (
                fullDomain === siteUrl ||          // exact match
                siteUrl.startsWith(fullDomain + "/") || // site is under current domain
                fullDomain.startsWith(siteUrl + "/")    // current domain is under site
            );
        }) || false;




        // Check if current domain is allowed
        //  const isDomainAllowed = user.websites?.some(site => site?.isActive && normalize(site.website) === domain) || false;
        if (!isDomainAllowed) {
            return res.type("application/javascript").send(`
        console.log("Not allowed on this site.");
        console.log("Referrer fullDomain: '${fullDomain}'");
        console.log("Allowed websites: ${JSON.stringify(user.websites.map(s => normalize(s.website)))}");
    `);
        }

        // Fetch active, published campaigns
        const campaigns = await Usercampaign.find({ clientId: userId, isActive: true, status: 'published' });

        // Filter campaigns matching any active website
        // Step 1: Find active websites matching current domain
        const activeSitesForDomain = user.websites.filter(site => {
            const siteUrl = normalize(site.website);
            return site.isActive && (fullDomain === siteUrl ||          // exact match
                siteUrl.startsWith(fullDomain + "/") || // site is under current domain
                fullDomain.startsWith(siteUrl + "/")
            );
        });

        // Step 2: Filter campaigns that belong to these active websites
        const matchedCampaigns = campaigns.filter(campaign =>
            activeSitesForDomain.some(site =>
                site._id?.toString() === campaign.websiteId?.toString()
            )
        );



        const mainScript = `${user._id}-main.js`;
        const scriptFileNames = (user.scripts || []).map(s => s.name).filter(Boolean);
        const allowedScripts = [mainScript, ...matchedCampaigns.map(c => `${c.clientId}-${c._id}.js`)];

        // Ensure mainScript exists
        if (!scriptFileNames.includes(mainScript)) {
            console.log("Main script not found, nothing to load.");
            return res.type("application/javascript").send(`
        main script not found: ${user.scripts?.map(s => s.name)}, userid: ${user._id}
      `);
        }

        // Loader for main + campaign scripts
        const baseUrl = 'http://localhost:5008/scripts';
        const loader = `
      (function loadScripts() {
      const matchedCampaigns = ${JSON.stringify(matchedCampaigns.map(c => c._id))};
      const activeSitesForDomain = ${JSON.stringify(activeSitesForDomain.map(s => s._id))};
        const files = ${JSON.stringify(allowedScripts)};
        const base = '${baseUrl}/';
        files.forEach(file => {
          const s = document.createElement('script');
          s.src = base + file;
          s.async = true;
          document.head.appendChild(s);
        });
      })();
    `;

        // Cookie consent
        const cookieContent = user.cookieContent || 'This website uses cookies to enhance your browsing experience.';
        const loader2 = `
${loader}
(function showCookieConsent() {
  const COOKIE_NAME = "cookie_consent";
  function setConsentCookie(value) { document.cookie = COOKIE_NAME + "=" + value + "; path=/; max-age=31536000; SameSite=Lax"; }
  function hasConsent() { return document.cookie.split('; ').some(row => row.startsWith(COOKIE_NAME + '=accepted')); }
  function addBanner() {
    if (hasConsent()) return;
    const banner = document.createElement('div');
    banner.setAttribute('role','alert');
    banner.style.position="fixed"; banner.style.bottom="0"; banner.style.left="0";
    banner.style.width="100%"; banner.style.background="linear-gradient(90deg,#f7f7f7 0%,#d1d5db 100%)";
    banner.style.color="#111"; banner.style.textAlign="center"; banner.style.fontSize="14px";
    banner.style.fontWeight="600"; banner.style.letterSpacing="0.03em"; banner.style.padding="12px 20px";
    banner.style.boxShadow="0 -2px 10px rgba(0,0,0,0.1)"; banner.style.zIndex="9999"; banner.style.display="flex";
    banner.style.justifyContent="center"; banner.style.alignItems="center"; banner.style.gap="10px";
    banner.style.flexWrap="wrap"; banner.style.opacity="0"; banner.style.transition="opacity 0.5s ease";

    banner.innerHTML = '<span>${cookieContent}</span><div style="display:flex;gap:8px;">' +
      '<button style="background-color:#3b82f6;color:white;border:none;padding:8px 14px;font-weight:600;border-radius:4px;cursor:pointer;">Accept</button></div>';

    const acceptBtn = banner.querySelector('button');
    acceptBtn.addEventListener('mouseenter',()=>acceptBtn.style.backgroundColor='#2563eb');
    acceptBtn.addEventListener('mouseleave',()=>acceptBtn.style.backgroundColor='#3b82f6');
    acceptBtn.addEventListener('click',()=>{setConsentCookie("accepted"); banner.style.opacity='0'; setTimeout(()=>banner.remove(),400);});

    document.body.appendChild(banner);
    requestAnimationFrame(()=>{banner.style.opacity="1";});
  }
  if(document.body) addBanner(); else window.addEventListener('load', addBanner);
})();
`;

        res.type("application/javascript").send(user.showCookiePopup ? loader2 : loader);

    } catch (error) {
        return next(error);
    }
};


const fs = require('fs').promises;
const path = require('path');
const { createMainScript } = require("../utils/scriptUtils");
const scriptModel = require("../models/scriptModel");
const { getTemplate } = require("../template/editorTemplate");
const sendEmail = require("../utils/mailer");
const sendSendGridMail = require("../utils/sendGridMailer"); //we are not using this
const { sendSMS } = require("../utils/smsHelper");
const { sendEmailCampaign } = require("../utils/emailHelper");
const { extractPlainText } = require("../utils/helper");


exports.createMainScript = async (req, res, next) => {
    try {
        const users = await User.find();

        if (users && users.length) {
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const fileName = `${user._id}-main.js`;

                const scriptsDir = path.join(__dirname, '..', 'scripts');
                const filePath = path.join(scriptsDir, fileName);

                if (fs.existsSync(filePath)) {
                    console.log(`File exists: ${fileName}`);
                    const scriptData = await scriptModel.findOne({ name: fileName })
                    if (!scriptData) {
                        const sPayload = {
                            name: fileName,
                            isActive: true,
                            userId: user._id
                        }
                        await scriptModel.create(sPayload)
                    }
                } else {
                    await createMainScript(user)
                }
            }
        }

        res.status(200).json({ message: 'File check complete' });

    } catch (error) {
        next(error);
    }
};

// exports.sendMail = async (req, res, next) => {
//     try {
//         const {templateId, email } = req.body
//         const template = await Campaign.findById(templateId)

//         if(template && template.elements && template.elements.length){
//             const mailHtml = getTemplate(template.elements)
//             const data = await sendSendGridMail({email, subject: template.subject, mailHtml})
//         }

//         res.json({
//             success: true,
//             message: "Email Sent successfully."
//         })
//     } catch (error) {
//         next(error);
//     }
// };

exports.sendMail = async (req, res, next) => {
    try {

        const { templateId, email, userId } = req.body;

        const template = await Campaign.findById(templateId);
        if (!template || !template.elements?.length) {
            return res.status(400).json({ success: false, message: "Invalid or empty template." });
        }

        const subscription = await getActiveSubscription(userId);

        let maxMail = subscription?.packageDetails?.emailLimit;
        let subscriptionStartDate = subscription?.createdAt;

        if (!subscription || !maxMail) {
            const fallback = await packageModel.findOne({ isDefault: true });
            if (!fallback || !fallback.emailLimit) {
                return res.status(400).json({ message: "No valid subscription or fallback package found." });
            }
            maxMail = fallback.emailLimit;
            subscriptionStartDate = fallback.createdAt;
        }

        const latestSubscription = await Usersubscription.findOne({ userId: new mongoose.Types.ObjectId(userId), status: "deactive" }).sort({ createdAt: -1 });

        let remainEmails;
        if (latestSubscription && typeof latestSubscription.remainEmail === "number") {
            remainEmails = maxMail - latestSubscription.remainEmail;
        } else {
            remainEmails = maxMail
        }

        const sentEmails = await EmailActivity.countDocuments({
            userId,
            status: "sent",
            createdAt: { $gte: subscriptionStartDate }
        });

        if (sentEmails === remainEmails) {
            return res.status(400).json({
                message: `Email limit reached. Maximum allowed: ${remainEmails}`
            });
        }

        const mailHtml = getTemplate(template.elements);

        let status = "sent";
        let errorMessage = "";

        try {
            await sendSendGridMailforuser({ email, subject: template.subject, mailHtml });
        } catch (err) {
            status = "failed";
            errorMessage = err.message;
        }

        await EmailActivity.create({
            userId,
            to: email,
            subject: template.subject,
            status,
            sentAt: new Date()
        });

        if (status === "sent") {
            const newRemain = Math.max(0, (remainEmails - 1) - sentEmails);
            await Usersubscription.updateOne(
                { userId: new mongoose.Types.ObjectId(userId), status: "active" },
                { $set: { remainEmail: newRemain } }
            );
        }

        return res.json({
            success: status === "sent",
            message: status === "sent" ? "Email sent successfully." : `Email failed: ${errorMessage}`
        });

    } catch (error) {
        next(error);
    }
};

const getActiveSubscription = async (userId) => {
    const objectClientId = new mongoose.Types.ObjectId(userId);

    const [subscription] = await Usersubscription.aggregate([
        { $match: { userId: objectClientId, status: "active" } },
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
        {
            $lookup: {
                from: "packages",
                localField: "subCriptionId",
                foreignField: "_id",
                as: "packageDetails"
            }
        },
        {
            $unwind: {
                path: "$packageDetails",
                preserveNullAndEmptyArrays: true
            }
        }
    ]);

    return subscription || null;
};

// exports.sendSMS = async (req, res, next) => {
//     try {

//         console.log(req.body)

//         const { templateId, contact } = req.body
//         const template = await Campaign.findById(templateId)
//         if (template && template.elements && template.elements.length) {
//             const plainText = extractPlainText(template.elements)
//             const messageObj = {
//                 srcNumber: "+919559333592",
//                 dstNumber: contact,
//                 message: plainText
//             }

//             await sendSMS(messageObj)
//             res.json({
//                 success: true,
//                 message: "SMS send successfully."
//             })
//         }
//         return next(new ErrorHandler('Failed to send SMS'))

//     } catch (error) {
//         next(error);
//     }
// };

exports.sendSMS = async (req, res, next) => {
    try {
        console.log('📱 SMS API Call Received:', {
            timestamp: new Date().toISOString(),
            body: req.body
        });

        const { templateId, contact, userId, visitorId, visitId } = req.body;

        console.log('🔍 SMS Request Details:', {
            templateId,
            contact: contact ? contact.substring(0, 4) + '***' + contact.substring(-4) : null,
            userId,
            hasTemplateId: !!templateId,
            hasContact: !!contact,
            hasUserId: !!userId
        });

        const template = await Campaign.findById(templateId);
        console.log('📋 Template Lookup Result:', {
            found: !!template,
            templateName: template?.name,
            hasElements: template?.elements?.length > 0,
            elementCount: template?.elements?.length || 0
        });

        if (!template || !template.elements?.length) {
            console.log('❌ Template validation failed');
            return res.status(400).json({ success: false, message: "Invalid or empty template." });
        }

        console.log('✅ Template validation passed, checking subscription...');

        const subscription = await getActiveSubscription(userId);
        console.log('💳 Subscription Check:', {
            found: !!subscription,
            maxSMS: subscription?.packageDetails?.SMSLimit,
            subscriptionStartDate: subscription?.createdAt
        });

        let maxSMS = subscription?.packageDetails?.SMSLimit;
        let subscriptionStartDate = subscription?.createdAt;

        if (!subscription || !maxSMS) {
            console.log('⚠️ No subscription found, using fallback package...');
            const fallback = await packageModel.findOne({ isDefault: true });
            console.log('🔄 Fallback Package:', {
                found: !!fallback,
                maxSMS: fallback?.SMSLimit
            });

            if (!fallback || !fallback.SMSLimit) {
                console.log('❌ No valid subscription or fallback package found');
                return res.status(400).json({ message: "No valid subscription or fallback package found." });
            }
            maxSMS = fallback.SMSLimit;
            subscriptionStartDate = fallback.createdAt;
        }

        const latestSubscription = await Usersubscription.findOne({ userId: new mongoose.Types.ObjectId(userId), status: "deactive" }).sort({ createdAt: -1 });

        let remainSMSs;
        if (latestSubscription && typeof latestSubscription.remainSMS === "number") {
            remainSMSs = maxSMS - latestSubscription.remainSMS;
        } else {
            remainSMSs = maxSMS;
        }

        console.log('📊 SMS Limit Check:', {
            maxSMS,
            remainSMSs,
            subscriptionStartDate
        });

        const sentSMS = await SMSActivity.countDocuments({
            userId,
            status: "sent",
            createdAt: { $gte: subscriptionStartDate }
        });

        console.log('📈 SMS Usage:', {
            sentSMS,
            remainSMSs,
            canSend: sentSMS < remainSMSs
        });

        if (sentSMS === remainSMSs) {
            console.log('❌ SMS limit reached');
            return res.status(400).json({
                message: `SMS limit reached. Maximum allowed: ${remainSMSs}`
            });
        }

        console.log('✅ SMS limit check passed, preparing message...');

        const plainText = extractPlainText(template.elements);
        console.log('📝 Message Content:', {
            length: plainText.length,
            preview: plainText.substring(0, 50) + (plainText.length > 50 ? '...' : ''),
            templateName: template.name
        });

        const messageObj = {
            dstNumber: contact,
            message: plainText,
            userId: userId
        };

        console.log('📤 SMS Message Object:', {
            dstNumber: contact.substring(0, 4) + '***' + contact.substring(-4),
            messageLength: plainText.length,
            timestamp: new Date().toISOString()
        });

        let status = "sent";
        let errorMessage = "";

        console.log('🚀 Attempting to send SMS via Twilio...');
        try {
            const result = await sendSMS(messageObj);
            console.log('✅ SMS sent successfully via Twilio:', {
                messageSid: result?.sid,
                status: result?.status,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('❌ SMS send failed:', {
                error: err.message,
                timestamp: new Date().toISOString()
            });
            status = "failed";
            errorMessage = err.message;
        }

        console.log('💾 Saving SMS activity to database...');
        await SMSActivity.create({
            userId,
            to: contact,
            message: plainText,
            status,
            sentAt: new Date(),
            visitorId: visitorId || null,
            visitId: visitId || null,
            errorMessage: errorMessage || null
        });
        console.log('✅ SMS activity saved to database');

        if (status === "sent") {
            const newRemain = Math.max(0, (remainSMSs - 1) - sentSMS);
            console.log('📊 Updating subscription SMS count:', {
                oldRemain: remainSMSs,
                newRemain,
                decrement: 1
            });

            await Usersubscription.updateOne(
                { userId: new mongoose.Types.ObjectId(userId), status: "active" },
                { $set: { remainSMS: newRemain } }
            );
            console.log('✅ Subscription SMS count updated');
        }

        const response = {
            success: status === "sent",
            message: status === "sent" ? "SMS sent successfully." : `SMS failed: ${errorMessage}`
        };

        console.log('📤 Sending response to client:', response);
        console.log('🎉 SMS Campaign Process Complete!');

        return res.json(response);

    } catch (error) {
        next(error);
    }
};

// 📧 Send Email Campaign Function
exports.sendEmailCampaign = async (req, res, next) => {
    try {
        console.log('📧 Email Campaign API Call Received:', {
            timestamp: new Date().toISOString(),
            body: req.body
        });

        const { templateId, email, userId, visitorId, visitId } = req.body;

        console.log('🔍 Email Campaign Request Details:', {
            templateId,
            email: email ? email.substring(0, 3) + '***' + email.substring(email.indexOf('@')) : null,
            userId,
            hasTemplateId: !!templateId,
            hasEmail: !!email,
            hasUserId: !!userId
        });

        const template = await Campaign.findById(templateId);
        console.log('📋 Template Lookup Result:', {
            found: !!template,
            templateName: template?.name,
            hasElements: template?.elements?.length > 0,
            elementCount: template?.elements?.length || 0
        });

        if (!template || !template.elements?.length) {
            console.log('❌ Template validation failed');
            return res.status(400).json({ success: false, message: "Invalid or empty template." });
        }

        console.log('✅ Template validation passed, checking subscription...');

        const subscription = await getActiveSubscription(userId);
        console.log('💳 Subscription Check:', {
            found: !!subscription,
            maxEmail: subscription?.packageDetails?.emailLimit,
            subscriptionStartDate: subscription?.createdAt
        });

        let maxEmail = subscription?.packageDetails?.emailLimit;
        let subscriptionStartDate = subscription?.createdAt;

        if (!subscription || !maxEmail) {
            console.log('⚠️ No subscription found, using fallback package...');
            const fallback = await packageModel.findOne({ isDefault: true });
            console.log('🔄 Fallback Package:', {
                found: !!fallback,
                maxEmail: fallback?.emailLimit
            });

            if (!fallback || !fallback.emailLimit) {
                console.log('❌ No valid subscription or fallback package found');
                return res.status(400).json({ message: "No valid subscription or fallback package found." });
            }
            maxEmail = fallback.emailLimit;
            subscriptionStartDate = fallback.createdAt;
        }

        const latestSubscription = await Usersubscription.findOne({ userId: new mongoose.Types.ObjectId(userId), status: "deactive" }).sort({ createdAt: -1 });

        let remainEmails;
        if (latestSubscription && typeof latestSubscription.remainEmail === "number") {
            remainEmails = maxEmail - latestSubscription.remainEmail;
        } else {
            remainEmails = maxEmail;
        }

        console.log('📊 Email Limit Check:', {
            maxEmail,
            remainEmails,
            subscriptionStartDate
        });

        const sentEmails = await EmailActivity.countDocuments({
            userId,
            status: "sent",
            createdAt: { $gte: subscriptionStartDate }
        });

        console.log('📈 Email Usage:', {
            sentEmails,
            remainEmails,
            canSend: sentEmails < remainEmails
        });

        if (sentEmails === remainEmails) {
            console.log('❌ Email limit reached');
            return res.status(400).json({
                message: `Email limit reached. Maximum allowed: ${remainEmails}`
            });
        }

        console.log('✅ Email limit check passed, preparing email...');

        const mailHtml = getTemplate(template.elements);
        console.log('📝 Email Content:', {
            length: mailHtml.length,
            preview: mailHtml.substring(0, 100) + (mailHtml.length > 100 ? '...' : ''),
            templateName: template.name
        });

        const emailObj = {
            to: email,
            subject: template.subject || 'Campaign Email',
            message: mailHtml
        };

        console.log('📤 Email Object:', {
            to: email.substring(0, 3) + '***' + email.substring(email.indexOf('@')),
            subject: emailObj.subject,
            messageLength: mailHtml.length,
            timestamp: new Date().toISOString()
        });

        let status = "sent";
        let errorMessage = "";

        console.log('🚀 Attempting to send email...');
        try {

            const cred = await userMailCredentials.findOne({ userId, active: true });
            if (!cred) {
                console.log('no api found for mail by Website Owner.')
                //        const result = await sendEmailCampaign(emailObj);
            }
            // Send email
            if (cred.platform == 'sendGrid') {
                await sendSendGridMailforuser({
                    email: emailObj.to,
                    subject: emailObj.subject,
                    mailHtml: emailObj.message
                });
            } else if (cred.platform == 'custom') {
                const transporter = nodemailer.createTransport({
                    host: cred.credentials.smtpHost,
                    port: cred.credentials.smtpPort,
                    secure: Number(cred.credentials.smtpPort) === 465,
                    auth: {
                        user: cred.credentials.smtpUser,
                        pass: cred.credentials.smtpPassword,
                    },
                    tls: {
                        rejectUnauthorized: false,
                    },
                });

                const mailOptions = {
                    from: cred.credentials.smtpUser,
                    to: emailObj.to,
                    subject: emailObj.subject,
                    html: emailObj.message
                };

                const result = await transporter.sendMail(mailOptions);


                console.log('✅ Email sent successfully:', {
                    messageId: result?.messageId,
                    accepted: result?.accepted,
                    timestamp: new Date().toISOString()
                });

            }

            // mail by our own mailer
            //        const result = await sendEmailCampaign(emailObj);

            // console.log('✅ Email sent successfully:', {
            //     messageId: result?.messageId,
            //     accepted: result?.accepted,
            //     timestamp: new Date().toISOString()
            // });
        } catch (err) {
            console.error('❌ Email send failed:', {
                error: err.message,
                timestamp: new Date().toISOString()
            });
            status = "failed";
            errorMessage = err.message;
        }

        console.log('💾 Saving email activity to database...');
        await EmailActivity.create({
            userId,
            to: email,
            subject: emailObj.subject,
            message: mailHtml,
            status,
            sentAt: new Date(),
            visitorId: visitorId || null,
            visitId: visitId || null,
            errorMessage: errorMessage || null
        });
        console.log('✅ Email activity saved to database');

        if (status === "sent") {
            const newRemain = Math.max(0, (remainEmails - 1) - sentEmails);
            console.log('📊 Updating subscription email count:', {
                oldRemain: remainEmails,
                newRemain,
                decrement: 1
            });

            await Usersubscription.updateOne(
                { userId: new mongoose.Types.ObjectId(userId), status: "active" },
                { $set: { remainEmail: newRemain } }
            );
            console.log('✅ Subscription email count updated');
        }

        const response = {
            success: status === "sent",
            message: status === "sent" ? "Email sent successfully." : `Email failed: ${errorMessage}`
        };

        console.log('📤 Sending response to client:', response);
        console.log('🎉 Email Campaign Process Complete!');

        return res.json(response);

    } catch (error) {
        next(error);
    }
};

// 📱 Send WhatsApp Campaign Function
exports.sendWhatsAppCampaign = async (req, res, next) => {
    try {
        const { templateId, phoneNumber, userId, visitorId, visitId } = req.body;

        whatsappLogger.info('CAMPAIGN_SEND', 'WhatsApp campaign send request received', {
            templateId,
            phoneNumber: phoneNumber ? phoneNumber.substring(0, 4) + '***' + phoneNumber.substring(-4) : null,
            userId,
            visitorId,
            visitId
        });

        // Get user's WhatsApp configuration
        const user = await User.findById(userId).select('whatsappConfig whatsapp');

        if (!user) {
            whatsappLogger.error('CAMPAIGN_SEND', 'User not found', { userId });
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Check for new WhatsApp config first, then fallback to old config
        const whatsappConfig = user.whatsappConfig || user.whatsapp;
        const isTestingMode = whatsappConfig?.isTestingMode || false;

        if (!whatsappConfig?.accessToken) {
            whatsappLogger.warn('CAMPAIGN_SEND', 'WhatsApp not configured for user', { userId });
            return res.status(400).json({
                success: false,
                message: "WhatsApp is not configured. Please configure WhatsApp in Account Settings."
            });
        }

        whatsappLogger.success('CAMPAIGN_SEND', 'WhatsApp configuration found for user', {
            userId,
            isTestingMode,
            phoneNumbersCount: whatsappConfig.phoneNumbers?.length || 0
        });

        const template = await Campaign.findById(templateId);

        if (!template || !template.elements?.length) {
            whatsappLogger.error('CAMPAIGN_SEND', 'Invalid or empty template', { templateId });
            return res.status(400).json({ success: false, message: "Invalid or empty template." });
        }

        whatsappLogger.info('CAMPAIGN_SEND', 'Template validated', {
            templateId,
            templateName: template?.campaigndesignerName || template?.name,
            elementCount: template?.elements?.length
        });

        // Extract plain text from template elements
        const plainText = extractPlainText(template.elements);

        whatsappLogger.info('CAMPAIGN_SEND', 'Message content prepared', {
            templateId,
            messageLength: plainText.length,
            preview: plainText.substring(0, 50) + (plainText.length > 50 ? '...' : '')
        });

        // Get template name from campaign data (default to hello_world if not specified)
        const templateName = template.whatsappTemplate || 'hello_world';

        whatsappLogger.info('CAMPAIGN_SEND', 'Using template', {
            templateName,
            campaignId: templateId
        });

        // Get phone number ID (use first available phone number)
        const phoneNumberId = whatsappConfig.phoneNumbers?.[0]?.id || whatsappConfig.phoneNumberId;

        // Prepare WhatsApp message object
        const whatsappObj = {
            phoneNumberId: phoneNumberId,
            accessToken: whatsappConfig.accessToken,
            to: phoneNumber.replace(/[^0-9]/g, ''), // Remove any non-numeric characters
            message: plainText,
            templateName: templateName, // Use template from campaign or default to hello_world
            isTestingMode: isTestingMode
        };

        whatsappLogger.info('CAMPAIGN_SEND', 'Prepared WhatsApp message object', {
            to: phoneNumber.substring(0, 4) + '***' + phoneNumber.substring(-4),
            templateName: whatsappObj.templateName,
            campaignId: templateId,
            isTestingMode: isTestingMode,
            phoneNumberId: phoneNumberId
        });

        let status = "sent";
        let errorMessage = "";
        let messageId = null;

        whatsappLogger.info('CAMPAIGN_SEND', 'Attempting to send WhatsApp message via Meta API');
        try {
            const result = await sendWhatsApp(whatsappObj);
            messageId = result?.messageId;

            whatsappLogger.messageSent(userId, phoneNumber, templateId, 'sent');
            whatsappLogger.success('CAMPAIGN_SEND', 'WhatsApp message sent successfully', {
                messageId,
                campaignId: templateId
            });
        } catch (err) {
            status = "failed";
            errorMessage = err.message;

            whatsappLogger.messageSent(userId, phoneNumber, templateId, 'failed');
            whatsappLogger.error('CAMPAIGN_SEND', 'WhatsApp send failed', {
                error: err.message,
                campaignId: templateId
            });
        }

        // Log WhatsApp activity to database
        whatsappLogger.info('CAMPAIGN_SEND', 'Saving activity to database', {
            userId,
            status,
            campaignId: templateId
        });

        await SMSActivity.create({
            userId,
            to: phoneNumber,
            message: plainText,
            status,
            sentAt: new Date(),
            visitorId: visitorId || null,
            visitId: visitId || null,
            errorMessage: errorMessage || null,
            messageType: 'whatsapp',
            messageId: messageId
        });

        const response = {
            success: status === "sent",
            message: status === "sent"
                ? (isTestingMode
                    ? "WhatsApp test message simulated successfully (Testing Mode)"
                    : "WhatsApp message sent successfully")
                : `Failed to send WhatsApp: ${errorMessage}`,
            isTestingMode: isTestingMode,
            testNote: isTestingMode ? "This is a test message - no actual WhatsApp message was sent. Add a real phone number for production use." : null
        };

        whatsappLogger.info('CAMPAIGN_SEND', 'Campaign send process complete', {
            success: response.success,
            campaignId: templateId
        });

        return res.json(response);

    } catch (error) {
        whatsappLogger.error('CAMPAIGN_SEND', 'Unexpected error in campaign send', {
            error: error.message,
            stack: error.stack
        });
        next(error);
    }
};

exports.addFormTrackingScript = async (req, res, next) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return next(new ErrorHandler('User ID is required', 400));
        }

        const user = await User.findById(userId);
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        const dir = `${process.env.SCRIPT_DIRECTORY}/client`;
        const userDir = path.join(dir, userId);
        const scriptsJsonPath = path.join(userDir, `scripts.json`);

        // Ensure user directory exists
        await fs.mkdir(userDir, { recursive: true });

        // Read existing scripts or create new array
        let existingScripts = [];
        try {
            const scriptsData = await fs.readFile(scriptsJsonPath, 'utf8');
            existingScripts = JSON.parse(scriptsData);
        } catch (error) {
            // File doesn't exist, start with empty array
            existingScripts = [];
        }

        // Check if form tracking script already exists
        const hasFormTracking = existingScripts.some(script => script.scriptName === 'htmlFormTrackingScript.js');

        if (hasFormTracking) {
            return res.json({
                success: true,
                message: "Form tracking script already exists for this user"
            });
        }

        // Add form tracking script
        existingScripts.push({
            scriptName: "htmlFormTrackingScript.js",
            isActive: true,
            name: "Form Tracking Script",
            description: "Automatically tracks form submissions and saves contacts/conversions"
        });

        // Save updated scripts.json
        await fs.writeFile(scriptsJsonPath, JSON.stringify(existingScripts, null, 2));

        // Copy form tracking script file
        const formTrackingScriptPath = path.join(__dirname, '../scripts/scripts-htmlFormTrackingScript.js');
        const userFormTrackingPath = path.join(userDir, 'htmlFormTrackingScript.js');

        await fs.copyFile(formTrackingScriptPath, userFormTrackingPath);

        res.json({
            success: true,
            message: "Form tracking script added successfully",
            scripts: existingScripts
        });

    } catch (error) {
        console.error('Error adding form tracking script:', error);
        next(error);
    }
};
