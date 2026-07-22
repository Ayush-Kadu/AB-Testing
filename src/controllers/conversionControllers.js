const mongoose = require('mongoose');
const Conversion = require('../models/conversion.model');
const Contact = require('../models/contact.model');
const ErrorHandler = require('../utils/errorHandler');
const Uservisitor = require("../models/user.visitor.model");
const Country = require('../models/country.model');
const userProfile = require('./../models/userProfile.model');
const axios = require('axios')

exports.addConversion = async (req, res, next) => {
    try {
        const { userId, visitorId, visitId, name, firstName, lastName, ...data } = req.body;

        if (!visitorId) {
            return res.status(400).json({ message: "visitorId is required" });
        }

        if (!userId) {
            console.error('❌ addConversion - No userId provided in request');
            return res.status(400).json({ message: "userId is required" });
        }

        let parsedFirstName = '';
        let parsedLastName = '';

        if (firstName || lastName) {
            parsedFirstName = firstName || '';
            parsedLastName = lastName || '';
        } else if (name) {
            const nameParts = name.trim().split(' ');
            parsedFirstName = nameParts[0];
            parsedLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
        }

        const existingConversion = await Conversion.findOne({ visitorId, visitId });

        let conversion = null;
        if (!existingConversion) {
            const conversionPayload = {
                userId,
                visitorId,
                visitId
            };

            // hello world

            conversion = await Conversion.create(conversionPayload);

            if (!conversion) {
                return res.status(400).json({ message: "Unable to save conversion data" });
            }

            conversion.conversion_key = conversion._id.toString();
            await conversion.save();

            try {
                const userProfilePayload = {
                    userId,
                    visitorId
                };
                const existingUser = await userProfile.findOne({ visitorId: visitorId });

                if (!existingUser) {
                    const userData = await userProfile.create(userProfilePayload);
                    console.log('New userProfile created:', userData);
                } else {
                    console.log('UserProfile already exists for this visitorId. Skipping creation.');
                }
            } catch (err) {
                console.error("Error creating userProfile for conversion:", err.message);
            }
        }

        const hasRealEmail = data.email && data.email !== 'N/A' && data.email.includes('@');
        let existingContact = null;

        if (hasRealEmail) {
            existingContact = await Contact.findOne({
                userId: userId,
                email: data.email
            });
        }

        if (!existingContact && visitorId) {
            existingContact = await Contact.findOne({
                userId: userId,
                visitorId: visitorId,
                $or: [
                    { firstName: parsedFirstName },
                    { firstName: 'N/A' },
                    { firstName: '' },
                    { firstName: null }
                ]
            });
        }

        let contact;
        if (existingContact) {
            const setFields = { userId: userId };

            // Enrich fields if needed
            if ((!existingContact.firstName || existingContact.firstName === 'N/A') && parsedFirstName && parsedFirstName !== 'N/A') {
                setFields.firstName = parsedFirstName;
            }
            if ((!existingContact.lastName || existingContact.lastName === 'N/A') && parsedLastName && parsedLastName !== 'N/A') {
                setFields.lastName = parsedLastName;
            }
            if ((!existingContact.email || existingContact.email === 'N/A') && hasRealEmail) {
                setFields.email = data.email;
            }
            if (!existingContact.phone && data.phone) {
                setFields.phone = data.phone;
            }
            if (!existingContact.gender && data.gender) {
                setFields.gender = data.gender;
            }
            if (!existingContact.dob && data.dob) {
                setFields.dob = data.dob;
            }

            await Contact.updateOne(
                { _id: existingContact._id },
                {
                    $addToSet: { visitorId },
                    $set: setFields
                }
            );
            contact = await Contact.findById(existingContact._id);
        } else {
            const contactPayload = {
                userId,
                visitorId: [visitorId],
                firstName: parsedFirstName || 'N/A',
                lastName: parsedLastName || 'N/A',
                email: data.email || 'N/A',
                phone: data.phone || 'N/A',
                gender: data.gender || 'N/A',
                dob: data.dob || 'N/A',
                creation_source: data.urlpt_url
            };

            contact = await Contact.create(contactPayload);

            try {
                const userProfilePayload = {
                    userId,
                    visitorId
                };
                const existingUser = await userProfile.findOne({ visitorId: visitorId });

                if (!existingUser) {
                    const userData = await userProfile.create(userProfilePayload);
                    console.log('New userProfile created:', userData);
                } else {
                    console.log('UserProfile already exists for this visitorId. Skipping creation.');
                }
            } catch (err) {
                console.error("Error creating userProfile for contact:", err.message);
            }
        }

        return res.status(201).json({
            message: existingConversion
                ? "Contact saved. Conversion already exists for this visitor."
                : "Contact and conversion saved successfully.",
            conversion: conversion || "Not created (already exists)",
            contact
        });

    } catch (error) {
        console.error('❌ addConversion - Error:', error);
        next(error);
    }
};

exports.getAllConversions = async (req, res) => {
    try {
        const { _id, role } = req.user;
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 10;
        const skip = page * limit;

        const { visitorId, visitId, product_name } = req.query;

        const filter = role === "user" ? { userId: _id } : {};

        if (visitorId) {
            let visitorIds = [];

            if (Array.isArray(visitorId)) {
                visitorIds = visitorId.flat();
            } else if (typeof visitorId === 'string' && visitorId.startsWith('[')) {
                try {
                    visitorIds = JSON.parse(visitorId);
                } catch (e) {
                    console.error('Failed to parse visitorId:', visitorId);
                }
            } else {
                visitorIds = [visitorId];
            }

            filter.visitorId = {
                $in: visitorIds.map(id => new RegExp(id, 'i'))
            };
        }

        if (visitId) {
            filter.visitId = parseInt(visitId);
        }

        if (product_name) {
            filter.product_name = { $regex: product_name, $options: 'i' };
        }

        const [conversions, total] = await Promise.all([
            Conversion.find(filter)
                .sort({ _id: -1 })
                .skip(skip)
                .limit(limit),
            Conversion.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: conversions,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching conversions:", error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
};

exports.getAllContacts = async (req, res) => {
    try {
        const { _id, role } = req.user;
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 10;
        const skip = page * limit;

        const filter = role === "user" ? { userId: _id } : {};

        const [contact, total] = await Promise.all([
            Contact.aggregate([
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
            Contact.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: contact,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        console.error("Error fetching contact:", error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
};

exports.addContact = async (req, res, next) => {
    try {
        const { _id } = req.user;

        const contact = await Contact.create({
            ...req.body,
            userId: _id,
            creation_source: 'Manual'
        });

        if (contact && contact._id) {
            res.json({
                success: true,
                data: contact
            });
        } else {
            return next(new ErrorHandler('Failed to create contact.', 500));
        }
    } catch (error) {
        next(error);
    }
};

exports.editContact = async (req, res, next) => {
    try {
        const updatedContact = await Contact.findByIdAndUpdate(
            req.params.contactId,
            req.body,
            { new: true }
        );

        if (!updatedContact) {
            return next(new ErrorHandler('Contact not found.', 404));
        }

        res.json({
            success: true,
            data: updatedContact
        });
    } catch (error) {
        next(error);
    }
};

exports.getContact = async (req, res, next) => {
    try {
        const contact = await Contact.findById(req.params.contactId);
        if (!contact) {
            return next(new ErrorHandler('Contact not found.', 404));
        }

        // Get current user ID for filtering
        const { _id: userId } = req.user;

        const visitorIds = Array.isArray(contact.visitorId) ? contact.visitorId : [contact.visitorId];

        let userVisitors = [];
        let conversions = [];

        for (const id of visitorIds) {
            const visitors = await Uservisitor.find({ visitorId: id }).sort({ createdAt: -1 });
            // Filter conversions by current user ID to match dashboard behavior
            const conversionData = await Conversion.find({
                visitorId: id,
                userId: userId  // Only get conversions for current user
            }).sort({ createdAt: -1 });

            userVisitors.push(...visitors);
            conversions.push(...conversionData);
        }

        userVisitors.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        conversions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const firstVisit = userVisitors[0]?.createdAt || null;
        const lastVisit = userVisitors[userVisitors.length - 1]?.createdAt || null;

        const firstConversion = conversions[0]?.createdAt || null;
        const lastConversion = conversions[conversions.length - 1]?.createdAt || null;

        const latestVisitor = userVisitors[userVisitors.length - 1];

        const location = latestVisitor
            ? {
                city: latestVisitor.city || null,
                state: latestVisitor.state || null,
                country: latestVisitor.country || null
            }
            : { city: null, state: null, country: null };

        const gaClientId = latestVisitor?.gaclientid || null;

        const conversionValueTotal = conversions.reduce((sum, conv) => {
            return sum + (parseFloat(conv.conversion_value) || 0);
        }, 0);

        const contactObj = contact.toObject();
        contactObj.gaClientId = gaClientId;
        contactObj.location = location;
        contactObj.firstVisit = firstVisit;
        contactObj.lastVisit = lastVisit;
        contactObj.firstConversion = firstConversion;
        contactObj.lastConversion = lastConversion;
        contactObj.userVisitors = userVisitors;
        contactObj.conversions = conversions;
        contactObj.conversionValueTotal = conversionValueTotal;

        res.json({
            success: true,
            data: contactObj
        });

    } catch (error) {
        next(error);
    }
};

exports.deleteContact = async (req, res, next) => {
    try {
        const contact = await Contact.findById(req.params.contactId);
        if (!contact) {
            return next(new ErrorHandler('Contact not found.', 404));
        }

        await Contact.findByIdAndDelete(req.params.contactId);
        res.json({
            success: true,
            data: 'Contact deleted successfully.'
        });
    } catch (error) {
        next(error);
    }
};

exports.addCurrencyCode = async (req, res, next) => {
    try {
        const response = await axios.get('https://restcountries.com/v3.1/all');
        const countries = response.data;

        const countryData = countries
            .map((country) => {
                const currencyCode = Object.keys(country.currencies || {})[0];
                const currency = country.currencies?.[currencyCode];

                if (!currency || !currency.symbol || !currencyCode || !country.ccn3) return null;

                return {
                    countryName: country.name?.common || '',
                    currencySymbol: currency.symbol,
                    currencyCode: currencyCode,
                    isoNumber: country.ccn3
                };
            })
            .filter(Boolean);

        await Country.deleteMany({});
        await Country.insertMany(countryData);

        res.status(200).json({ message: 'Countries imported successfully', count: countryData.length });
    } catch (error) {
        console.error('Error importing countries:', error);
        res.status(500).json({ error: 'Failed to import countries' });
    }
}

exports.createConversion = async (req, res, next) => {
    try {
        const { _id } = req.user;

        const conversion = await Conversion.create({
            ...req.body,
            userId: _id
        });

        if (conversion && conversion._id) {

            conversion.conversion_key = conversion._id.toString();
            await conversion.save();

            return res.json({
                success: true,
                data: conversion
            });
        } else {
            return next(new ErrorHandler('Failed to create conversion.', 500));
        }
    } catch (error) {
        console.log(error);
        return next(new ErrorHandler('Internal server error', 500));
    }
};
