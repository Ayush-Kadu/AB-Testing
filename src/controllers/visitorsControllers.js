const visitorDataModel = require('../models/visitorDataModel')
const { getIpDetails } = require('../utils/helper')
const Visitors = require('./../models/user.visitor.model')
const Usersubscription = require('../models/user.subscription.model');
const packageModel = require("./../models/packageModel");
const userProfile = require('./../models/userProfile.model');
const EmailSubmission = require('./../models/emailSubmission.model');
const Contact = require('./../models/contact.model');
const Conversion = require('./../models/conversion.model');
const mongoose = require('mongoose');
const Variant = require('./../models/variant.model');
const VariantEvent = require('./../models/variantEvent.model');

// A/B Testing — if this campaignId happens to belong to a variant's cloned
// campaign, this submission IS that variant's conversion event (this app's
// existing "conversion" for an on-site campaign already is an email/feedback
// submission — reusing that instead of inventing a second conversion
// concept). Best-effort and non-blocking: never lets a tracking hiccup fail
// the actual email submission being saved.
async function recordVariantConversionIfApplicable(campaignId, visitorId) {
    try {
        if (!campaignId) return;
        const variant = await Variant.findOne({ campaignId });
        if (!variant) return;

        if (visitorId) {
            const already = await VariantEvent.findOne({ variantId: variant._id, visitorId, type: 'conversion' });
            if (already) return;
        }

        await Variant.findByIdAndUpdate(variant._id, { $inc: { conversions: 1 } });
        await VariantEvent.create({
            variantId: variant._id,
            experimentId: variant.experimentId,
            campaignId,
            type: 'conversion',
            visitorId: visitorId || ''
        });
    } catch (err) {
        console.warn('recordVariantConversionIfApplicable - non-fatal error:', err.message);
    }
}


exports.addVisitors = async (req, res, next) => {
    try {
        const { clientId, urlpt_ip, ...restPayload } = req.body;

        if (!clientId) {
            return res.status(400).send({ message: "Client ID is required" });
        }

        const objectClientId = new mongoose.Types.ObjectId(clientId);

        // Step 1: Get Subscription
        const subscription = await Usersubscription.aggregate([
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
            { $unwind: { path: "$packageDetails", preserveNullAndEmptyArrays: true } }
        ]);

        const activeSubscription = subscription?.[0];
        let maxVisitors = activeSubscription?.packageDetails?.noOfVisitors;
        let subscriptionStartDate = activeSubscription?.createdAt;

        // Step 2: Fallback to free package
        if (!activeSubscription || !maxVisitors) {
            const freePackage = await packageModel.findOne({ isDefault: true });
            if (!freePackage?.noOfVisitors) {
                return res.status(400).send({ message: "No valid subscription or fallback package found" });
            }
            maxVisitors = freePackage.noOfVisitors;
            subscriptionStartDate = freePackage.createdAt;
        }

        // Step 3: Count existing visitors
        const uniqueVisitorIds = await Visitors.distinct("visitorId", {
            clientId: objectClientId,
            createdAt: { $gte: subscriptionStartDate }
        });

        const visitorsSinceSubscription = uniqueVisitorIds.length;


        if (visitorsSinceSubscription >= maxVisitors) {
            return res.status(400).json({
                message: `Visitor limit reached. Maximum allowed: ${maxVisitors}`
            });
        }

        // Step 4: IP Location Lookup
        let locationData = {};
        try {
            locationData = await getIpDetails(urlpt_ip);
        } catch (err) {
            console.warn("Failed to fetch IP location data:", err?.message);
        }

        const payload = {
            ...restPayload,
            clientId: objectClientId,
            urlpt_ip: urlpt_ip, // Store the IP address
            ...(locationData && {
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                country: locationData.country_name,
                state: locationData.region_name,
                city: locationData.city
            })
        };

        // Step 5: Create visitor record
        const visitor = await Visitors.create(payload);

        // Step 6: Ensure userProfile exists
        const existingUser = await userProfile.findOne({ visitorId: restPayload.visitorId });

        let userData;
        if (!existingUser) {
            userData = await userProfile.create({
                userId: objectClientId,
                visitorId: restPayload.visitorId
            });
            console.log("New userProfile created:", userData);
        } else {
            console.log("UserProfile already exists for this visitorId. Skipping creation.");
        }

        // Step 7: Fallback safety check
        if (!visitor && !existingUser && !userData) {
            return res.status(400).send({ message: "Unable to add visitor and user profile" });
        }

        return res.status(201).send({
            message: "Visitor added successfully",
            visitor
        });

    } catch (error) {
        console.error("Error adding visitor:", error);
        return next(error);
    }
};



exports.addVisitorData = async (req, res, next) => {
    try {
        let payload = req.body
        payload['clientId'] = new mongoose.Types.ObjectId(req.body.clientId)
        await visitorDataModel.create(payload)
        res.json({
            success: true,
            message: "Visitor Data saved successfully."
        })



    } catch (error) {
        return next(error)
    }
}

exports.addEmailSubmission = async (req, res, next) => {
    try {
        const { email, name, clientId, visitorId, visitId, campaignId, campaignType, campaignAction, feedbackData } = req.body;

        console.log('📧 addEmailSubmission - Received data:', { email, name, clientId, visitorId, visitId, campaignId, campaignType, campaignAction, feedbackData });

        if (!clientId || !campaignId) {
            return res.status(400).json({
                success: false,
                message: "clientId and campaignId are required."
            });
        }

        let submissionEmail = email || 'N/A';
        let submissionName = name || 'N/A';

        // Try to extract email and name from feedbackData if they were not provided explicitly
        if (feedbackData) {
            for (const [key, value] of Object.entries(feedbackData)) {
                if (!value || typeof value !== 'string') continue;
                const lowerKey = key.toLowerCase();
                
                // If we don't have a real email yet, and this looks like an email field
                if ((submissionEmail === 'N/A' || submissionEmail.includes('anonymous_feedback_')) && 
                    (lowerKey.includes('email') || lowerKey.includes('e-mail')) && 
                    value.includes('@')) {
                    submissionEmail = value;
                }
                
                // If we don't have a real name yet, and this looks like a name field
                if ((submissionName === 'N/A' || !submissionName) && 
                    (lowerKey.includes('name') || lowerKey === 'first name' || lowerKey === 'last name')) {
                    submissionName = value;
                }
            }
        }

        // Create email submission record
        const emailSubmission = await EmailSubmission.create({
            email: submissionEmail,
            name: submissionName,
            clientId: new mongoose.Types.ObjectId(clientId),
            campaignId: new mongoose.Types.ObjectId(campaignId),
            visitorId,
            visitId,
            campaignType,
            campaignAction,
            ...(feedbackData ? { feedbackData } : {})
        });

        console.log('📧 addEmailSubmission - Created email submission record:', emailSubmission);

        // Get visitor data for location information
        let visitorData = null;
        if (visitorId) {
            visitorData = await Visitors.findOne({ visitorId: visitorId });
            console.log('📧 addEmailSubmission - Found visitor data:', visitorData);
        }

        let firstName = '';
        let lastName = '';

        if (submissionName && submissionName !== 'N/A' && submissionName.trim()) {
            const nameParts = submissionName.trim().split(' ');
            firstName = nameParts[0];
            lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        } else {
            // Extract firstname and lastname from email
            const emailParts = submissionEmail.split('@')[0];
            firstName = emailParts;

            // Try to split by common separators
            if (emailParts.includes('.')) {
                const nameParts = emailParts.split('.');
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join('.');
            } else if (emailParts.includes('_')) {
                const nameParts = emailParts.split('_');
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join('_');
            } else if (emailParts.includes('-')) {
                const nameParts = emailParts.split('-');
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join('-');
            }
        }

        // Capitalize first letter of each name
        if (firstName) firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        if (lastName) lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);

        // Get campaign information for creation source
        let creationSource = 'Campaign';
        try {
            const campaign = await mongoose.model('usercampaign').findById(campaignId);
            if (campaign) {
                creationSource = campaign.campaignName || campaign.domain || 'Campaign';
            }
        } catch (err) {
            console.log('📧 addEmailSubmission - Could not fetch campaign details:', err.message);
        }

        // Create contact record
        const contactData = {
            userId: new mongoose.Types.ObjectId(clientId),
            visitorId: visitorId ? [visitorId] : [],
            firstName: firstName,
            lastName: lastName,
            email: submissionEmail,
            phone: '',
            creation_source: creationSource,
            city: visitorData?.city || visitorData?.cityName || '',
            state: visitorData?.state || visitorData?.region_name || '',
            country: visitorData?.country || visitorData?.countryName || ''
        };

        console.log('📧 addEmailSubmission - Creating contact with data:', contactData);

        // Check if contact already exists
        const hasRealEmail = submissionEmail && submissionEmail !== 'N/A' && submissionEmail.includes('@');
        let existingContact = null;

        if (hasRealEmail) {
            existingContact = await Contact.findOne({
                userId: new mongoose.Types.ObjectId(clientId),
                email: submissionEmail
            });
        }

        if (!existingContact && visitorId) {
            existingContact = await Contact.findOne({
                userId: new mongoose.Types.ObjectId(clientId),
                visitorId: visitorId,
                $or: [
                    { firstName: firstName },
                    { firstName: 'N/A' },
                    { firstName: '' },
                    { firstName: null }
                ]
            });
        }

        let contact;
        if (!existingContact) {
            contact = await Contact.create(contactData);
            console.log('📧 addEmailSubmission - Created new contact record:', contact);
        } else {
            console.log('📧 addEmailSubmission - Existing contact found, updating visitorId array and details');
            const setFields = { userId: new mongoose.Types.ObjectId(clientId) };

            // Enrich details only if they are not already set
            if (!existingContact.city && contactData.city) {
                setFields.city = contactData.city;
            }
            if (!existingContact.state && contactData.state) {
                setFields.state = contactData.state;
            }
            if (!existingContact.country && contactData.country) {
                setFields.country = contactData.country;
            }
            if ((!existingContact.firstName || existingContact.firstName === 'N/A') && contactData.firstName && contactData.firstName !== 'N/A') {
                setFields.firstName = contactData.firstName;
            }
            if ((!existingContact.lastName || existingContact.lastName === 'N/A') && contactData.lastName && contactData.lastName !== 'N/A') {
                setFields.lastName = contactData.lastName;
            }
            if ((!existingContact.email || existingContact.email === 'N/A') && hasRealEmail) {
                setFields.email = submissionEmail;
            }

            await Contact.updateOne(
                { _id: existingContact._id },
                {
                    $addToSet: { visitorId: visitorId },
                    $set: setFields
                }
            );
            contact = await Contact.findById(existingContact._id);
        }

        // Create conversion record
        const isFeedback = campaignAction === 'feedback_submission';
        const conversionData = {
            userId: new mongoose.Types.ObjectId(clientId),
            visitorId: visitorId || '',
            visitId: visitId ? parseInt(visitId) : null,
            product_name: creationSource, // Use campaign name as product name
            conversion_value: 0, // Email submissions have no monetary value
            currency: 'USD',
            conversion_key: isFeedback ? `feedback_submission_${campaignId}` : `email_submission_${campaignId}`,
            conversion_date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
            level: isFeedback ? 'Feedback Submission' : 'Email Submission'
        };

        console.log('📧 addEmailSubmission - Creating conversion with data:', conversionData);

        const conversion = await Conversion.create(conversionData);
        console.log('📧 addEmailSubmission - Created conversion record:', conversion);

        await recordVariantConversionIfApplicable(campaignId, visitorId);

        res.json({
            success: true,
            message: "Email submission tracked successfully.",
            data: {
                emailSubmission,
                contact: contact,
                conversion: conversion
            }
        });

    } catch (error) {
        console.error("Error tracking email submission:", error);
        return next(error);
    }
}


exports.getVisitorlimit = async (req, res, next) => {
    try {
        const { _id, role } = req.user;
        console.log("🔍 getVisitorlimit called for user:", _id, "role:", role);

        if (role !== 'user') {
            console.log("❌ Visitor limit check not applicable for this role:", role);
            return;
        }

        const objectClientId = new mongoose.Types.ObjectId(_id);

        // Get latest active subscription
        const subscription = await Usersubscription.aggregate([
            { $match: { userId: objectClientId, status: "active" } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
                $lookup: {
                    from: "packages",
                    localField: "subCriptionId",
                    foreignField: "_id",
                    as: "packageDetails",
                },
            },
            {
                $unwind: { path: "$packageDetails", preserveNullAndEmptyArrays: true },
            },
        ]);

        const activeSubscription = subscription?.[0];
        console.log("📊 Active subscription found:", activeSubscription ? "Yes" : "No");

        let maxVisitors = activeSubscription?.packageDetails?.noOfVisitors;
        let subscriptionStartDate = activeSubscription?.createdAt;
        console.log("📊 Max visitors from subscription:", maxVisitors);

        // If no active subscription, fallback to free
        if (!activeSubscription || !maxVisitors) {
            console.log("🆓 No active subscription, falling back to free package");
            const freePackage = await packageModel.findOne({ isDefault: true });
            if (!freePackage || !freePackage.noOfVisitors) {
                console.log("❌ No free package found");
                return res.status(400).json({
                    success: false,
                    message: "No valid subscription or fallback package found",
                });
            }
            maxVisitors = freePackage.noOfVisitors;
            subscriptionStartDate = freePackage.createdAt;
            console.log("🆓 Using free package - max visitors:", maxVisitors);
        }

        // Count only unique visitors added since current subscription started
        const uniqueVisitorIds = await Visitors.distinct("visitorId", {
            clientId: objectClientId,
            createdAt: { $gte: subscriptionStartDate }
        });
        const visitorsSinceSubscription = uniqueVisitorIds.length;

        console.log("📊 Unique visitor IDs found:", uniqueVisitorIds.length);
        console.log("📊 Visitors since subscription:", visitorsSinceSubscription);
        console.log("📊 Max visitors allowed:", maxVisitors);
        console.log("📊 Limit reached?", visitorsSinceSubscription >= maxVisitors);
        console.log("📊 Calculation:", `${visitorsSinceSubscription} >= ${maxVisitors} = ${visitorsSinceSubscription >= maxVisitors}`);

        if (visitorsSinceSubscription >= maxVisitors) {
            console.log("🚨 VISITOR LIMIT REACHED! Returning success: false");
            return res.status(200).json({
                success: false,
                message: `Visitor limit reached. Maximum allowed: ${maxVisitors}`,
                data: {
                    maxVisitors,
                    currentVisitorCount: visitorsSinceSubscription,
                },
            });
        }

        // Limit not yet reached
        console.log("✅ Visitor limit not reached, returning success: true");
        return res.status(200).json({
            success: true,
            message: `Visitor limit check passed. You have ${maxVisitors - visitorsSinceSubscription} visitor slot(s) remaining.`,
            data: {
                maxVisitors,
                currentVisitorCount: visitorsSinceSubscription,
            },
        });

    } catch (error) {
        console.error("Error in getVisitorlimit:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while checking visitor limit",
            error: error.message,
        });
    }
};