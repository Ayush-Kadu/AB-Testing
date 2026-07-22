const User = require("../models/user.model")
const Usersubscription = require('../models/user.subscription.model');
const Pricing = require('./../models/packageModel');
const ErrorHandler = require("../utils/errorHandler")
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const packageModel = require("./../models/packageModel");
const AdminSetting = require('../models/admin.setting.model');

const SECRET_KEY = "TECHNIANS"

const auth = async (req, res, next) => {
    try {
        // Set CORS headers before any error handling to ensure they're present
        const origin = req.headers.origin;
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
        }
        
        const token = req.headers?.['authorization']?.replace('Bearer ', '')
        if (!token) {
            return next(new ErrorHandler('Unauthorized.', 401))
        }

        const userData = jwt.verify(token, SECRET_KEY);
        const user = await User.findOne({ _id: new mongoose.Types.ObjectId(userData.userId) });

        if (!user) {
            return next(new ErrorHandler("Unauthorized.", 401));
        }

        // Fetch the active subscription for the user
        const package = await packageModel.findOne()
        const subscription = await Usersubscription.aggregate([
            {
                $match: { userId: new mongoose.Types.ObjectId(user._id), status: "active" },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $limit: 1,
            },
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

        const adminData = await AdminSetting.find()
        req.user = {
            ...user.toObject(),
            subscription: subscription.length > 0 ? subscription[0] : null,
            packagePercentage: package.percentage,
            adminSettingData: adminData
        };

        next();

    } catch (error) {
        return next(error)
    }
}

module.exports = auth