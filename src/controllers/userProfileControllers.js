const userProfile = require('../models/userProfile.model');
const Uservisitor = require("../models/user.visitor.model");
const Conversion = require('../models/conversion.model');
const Contact = require('../models/contact.model');
const ErrorHandler = require('../utils/errorHandler');
const userMailCredentials = require('../models/userMailCredentials.model');

exports.getAllUserProfile = async (req, res) => {
    try {
        const { _id, role } = req.user;
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 10;
        const skip = page * limit;

        const filter = role === "user" ? { userId: _id } : {};

        const [userData, total] = await Promise.all([
            userProfile.aggregate([
                { $match: filter },
                { $sort: { _id: -1 } },
                { $skip: skip },
                { $limit: limit },
                {
                    $addFields: {
                        latestVisitorId: {
                            $cond: {
                                if: { $isArray: "$visitorId" },
                                then: { $arrayElemAt: ["$visitorId", -1] },
                                else: "$visitorId"
                            }
                        }
                    }
                },
                {
                    $lookup: {
                        from: "uservisitors",
                        let: { latestVisitorId: "$latestVisitorId" },
                        pipeline: [
                            { $match: { $expr: { $eq: ["$visitorId", "$$latestVisitorId"] } } },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 },
                            {
                                $project: {
                                    _id: 0,
                                    city: 1,
                                    state: 1,
                                    country: 1
                                }
                            }
                        ],
                        as: "visitorInfo"
                    }
                },
                {
                    $unwind: {
                        path: "$visitorInfo",
                        preserveNullAndEmptyArrays: true
                    }
                }
            ]),
            userProfile.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: userData,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
};

exports.getUserProfile = async (req, res, next) => {
    try {
        const userData = await userProfile.findById(req.params.userProfileId);
        if (!userData) {
            return next(new ErrorHandler('User Profile not found.', 404));
        }

        const userVisitors = await Uservisitor.find({ visitorId: userData.visitorId }).sort({ createdAt: 1 });

        let firstVisit = null;
        let lastVisit = null;
        let location = { city: null, state: null, country: null };

        if (userVisitors.length > 0) {
            firstVisit = userVisitors[0].createdAt;
            lastVisit = userVisitors[userVisitors.length - 1].createdAt;

            const latestVisitor = userVisitors[userVisitors.length - 1];

            location = {
                city: latestVisitor.city || null,
                state: latestVisitor.state || null,
                country: latestVisitor.country || null
            };
        }

        const conversions = await Conversion.find({ visitorId: userData.visitorId }).sort({ createdAt: -1 });

        let firstConversion = null;
        let lastConversion = null;
        if (conversions.length > 0) {
            firstConversion = conversions[0].createdAt;
            lastConversion = conversions[conversions.length - 1].createdAt;
        }

        const contacts = await Contact.find({ visitorId: userData.visitorId }).sort({ createdAt: -1 });

        let firstContact = null;
        let lastContact = null;
        if (contacts.length > 0) {
            firstContact = contacts[0].createdAt;
            lastContact = contacts[contacts.length - 1].createdAt;
        }

        const userDataObj = userData.toObject();
        userDataObj.location = location;
        userDataObj.firstVisit = firstVisit;
        userDataObj.lastVisit = lastVisit;
        userDataObj.firstConversion = firstConversion;
        userDataObj.lastConversion = lastConversion;
        userDataObj.firstContact = firstContact;
        userDataObj.lastContact = lastContact;
        userDataObj.conversions = conversions;
        userDataObj.userVisitors = userVisitors;
        userDataObj.contacts = contacts;

        res.json({
            success: true,
            data: userDataObj
        });

    } catch (error) {
        next(error);
    }
};
exports.postUserEmailCredentials = async (req, res, next) => {
    try {
        const { platform, credentials, active } = req.body; // accept active from frontend
        const { _id } = req.user;

        if (!platform || !credentials) {
            return next(new ErrorHandler("Platform and credentials are required.", 400));
        }

        // If new credential is active, deactivate all others
        if (active) {
            await userMailCredentials.updateMany(
                { userId: _id },
                { $set: { active: false } }
            );
        }

        const newCredential = new userMailCredentials({
            userId: _id,
            platform,
            credentials,
            active: active || false, // default false if not provided
        });

        await newCredential.save();

        res.status(201).json({
            success: true,
            message: "Email credentials saved successfully.",
            data: newCredential,
        });
    } catch (error) {
        next(error);
    }

};

// Get all credentials of a user
exports.getUserEmailCredentials = async (req, res, next) => {
    try {
        const { userId } = req.params;
        if (!userId) return next(new ErrorHandler("User ID is required.", 400));

        const credentials = await userMailCredentials.find({ userId });
        res.json({ success: true, data: credentials });
    } catch (error) {
        next(error);
    }
};

// Update existing credential
exports.updateUserEmailCredentials = async (req, res, next) => {
    try {
        const { editingId } = req.params;
        const { platform, credentials, active } = req.body;
        console.log("Editing ID:", editingId);
        console.log("Request Body:", req.body);
        if (!editingId) {
            return next(new ErrorHandler("Editing ID is required.", 400));
        }
        if (!platform || !credentials) {
            return next(new ErrorHandler("Platform and credentials are required.", 400));
        }

        // If updated credential is active, deactivate all others for the user
        if (active) {
            const credential = await userMailCredentials.findById(editingId);
            if (credential) {
                await userMailCredentials.updateMany(
                    { userId: credential.userId, _id: { $ne: editingId } },
                    { $set: { active: false } }
                );
            }
        }

        const updatedCredential = await userMailCredentials.findByIdAndUpdate(
            editingId,
            { platform, credentials, active: active || false },
            { new: true }
        );

        res.json({
            success: true,
            message: "Email credentials updated successfully.",
            data: updatedCredential,
        });
    } catch (error) {
        next(error);
    }

};

// Toggle active status
// Toggle Active - only one active per user
exports.toggleEmailCredentialStatus = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Find the credential being toggled
        const credential = await userMailCredentials.findById(id);
        if (!credential) return next(new ErrorHandler("Email credentials not found.", 404));

        // If already active, just deactivate
        if (credential.active) {
            credential.active = false;
            await credential.save();
            return res.json({
                success: true,
                message: "Credential deactivated successfully.",
                data: credential,
            });
        }

        // Deactivate all other credentials of this user
        await userMailCredentials.updateMany(
            { userId: credential.userId },
            { $set: { active: false } }
        );

        // Activate the selected credential
        credential.active = true;
        await credential.save();

        res.json({
            success: true,
            message: "Credential activated successfully.",
            data: credential,
        });
    } catch (error) {
        next(error);
    }
};

// Delete credential
exports.deleteEmailCredential = async (req, res, next) => {
    try {
        const { id } = req.params;

        const deleted = await userMailCredentials.findByIdAndDelete(id);

        if (!deleted) return next(new ErrorHandler("Email credentials not found.", 404));

        res.json({
            success: true,
            message: "Credential deleted successfully.",
        });
    } catch (error) {
        next(error);
    }
};

// ----------------------
// 📱 SMS Credentials Controllers
// ----------------------
const SmsCredential = require("../models/userSmsCredentials.model");

// ---------------------------------------------------------
// 📱 Create New SMS Credential
// ---------------------------------------------------------
exports.postUserSmsCredentials = async (req, res, next) => {
    try {
        const userId = req.user?._id;
        const { platform, credentials, active } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID missing." });
        }

        // If setting as active, deactivate all others for same user
        if (active) {
            await SmsCredential.updateMany({ userId }, { $set: { active: false } });
        }

        const newCredential = await SmsCredential.create({
            userId,
            platform,
            credentials,
            active: active ?? true,
        });

        res.status(201).json(newCredential);
    } catch (error) {
        console.error("Error creating SMS credential:", error);
        res.status(500).json({ message: "Failed to create SMS credential", error: error.message });
    }
};

// ---------------------------------------------------------
// 📄 Get All SMS Credentials for a User
// ---------------------------------------------------------

exports.getUserSmsCredentials = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const credentials = await SmsCredential.find({ userId });
        res.json({ success: true, data: credentials });
    } catch (error) {
        console.error("Error fetching SMS credentials:", error);
        res.status(500).json({ message: "Failed to fetch SMS credentials", error: error.message });
    }
};

// ---------------------------------------------------------
// ✏️ Update SMS Credential by ID
// ---------------------------------------------------------
exports.updateUserSmsCredentials = async (req, res, next) => {
    try {
        const { editingId } = req.params;
        const { platform, credentials, active } = req.body;

        const smsCredential = await SmsCredential.findById(editingId);
        if (!smsCredential) {
            return res.status(404).json({ message: "SMS credential not found" });
        }

        // If updating to active, deactivate others
        if (active) {
            await SmsCredential.updateMany(
                { userId: smsCredential.userId, _id: { $ne: editingId } },
                { $set: { active: false } }
            );
        }

        smsCredential.platform = platform;
        smsCredential.credentials = credentials;
        smsCredential.active = active;
        await smsCredential.save();

        res.status(200).json({ message: "SMS credential updated successfully", smsCredential });
    } catch (error) {
        console.error("Error updating SMS credential:", error);
        res.status(500).json({ message: "Failed to update SMS credential", error: error.message });
    }
};

// ---------------------------------------------------------
// 🔁 Toggle Active Status
// ---------------------------------------------------------
exports.toggleSmsCredentialStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const credential = await SmsCredential.findById(id);
        if (!credential) {
            return res.status(404).json({ message: "SMS credential not found" });
        }

        const newStatus = !credential.active;

        if (newStatus) {
            // If activating, deactivate all others
            await SmsCredential.updateMany(
                { userId: credential.userId, _id: { $ne: id } },
                { $set: { active: false } }
            );
        }

        credential.active = newStatus;
        await credential.save();

        res.status(200).json({ message: "Status updated successfully", credential });
    } catch (error) {
        console.error("Error toggling SMS credential:", error);
        res.status(500).json({ message: "Failed to toggle active status", error: error.message });
    }
};

// ---------------------------------------------------------
// ❌ Delete SMS Credential
// ---------------------------------------------------------
exports.deleteSmsCredential = async (req, res, next) => {
    try {
        const { id } = req.params;
        const deleted = await SmsCredential.findByIdAndDelete(id);

        if (!deleted) {
            return res.status(404).json({ message: "SMS credential not found" });
        }

        res.status(200).json({ message: "SMS credential deleted successfully" });
    } catch (error) {
        console.error("Error deleting SMS credential:", error);
        res.status(500).json({ message: "Failed to delete SMS credential", error: error.message });
    }
};

const sendSendGridMail = require('../utils/sendGridMailerforUser'); // your mailer
const nodemailer = require("nodemailer");

// POST /userProfile/sendgrid-test-email
exports.sendTestEmail = async (req, res, next) => {
    try {
        const { to } = req.body;
        const userId = req.user._id;

        // Find the user's active SendGrid credential
        const cred = await userMailCredentials.findOne({ userId, active: true });
        if (!cred) {
            return res.status(400).json({ message: "No active SendGrid credential found." });
        }
        // Send email
        if (cred.platform == 'sendGrid') {
            await sendSendGridMail({
                email: to,
                subject: "Test Email from URLPT sendgrid mail testing.",
                mailHtml: "<p>This is a test email.</p>"
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
                to,
                subject: "Test Email from URLPT custom mail testing.",
                html: "<p>This is a confirmation email by URLPT from custom mail config.</p>"
            };

            const info = await transporter.sendMail(mailOptions);


            console.log("Email sent successfully: %s", info?.accepted);


        }
        res.json({ message: "Test email sent successfully!" });

    } catch (error) {
        console.error("Send test email error:", error);
        res.status(500).json({ message: error.message || "Failed to send test email." });
    }
};

const twilio = require('twilio')
exports.sendTestSms = async (req, res, next) => {
    try {
        const { to, message } = req.body;
        const userId = req.user._id;

        if (!to || !message) {
            return res.status(400).json({ message: "Recipient number and message are required." });
        }

        const cred = await SmsCredential.findOne({ userId, active: true });
        if (!cred) {
            return res.status(400).json({ message: "No active SMS credential found." });
        }

        if (cred.platform === 'twilio') {
            const client = twilio(cred.credentials.accountSID, cred.credentials.authToken);

            const from =
                cred.credentials.senderType === "messagingService"
                    ? cred.credentials.messagingServiceSid
                    : cred.credentials.senderId;

            const sms = await client.messages.create({
                body: message,
                from, // dynamically chosen sender
                to,
            });


            console.log("SMS sent successfully:", sms.sid);
            res.json({ data: { message: "Test SMS sent successfully!", sid: sms.sid } });
        } else {
            return res.status(400).json({ message: `Unsupported SMS platform: ${cred.platform}` });
        }
    } catch (error) {
        console.error("Send test SMS error:", error);
        res.status(500).json({ message: error.message || "Failed to send test SMS." });
    }

}
