const Uservisitor = require("../models/user.visitor.model");
const Conversion = require('../models/conversion.model');
const Contact = require('../models/contact.model');
const moment = require('moment');


exports.getVisitorLocation = async (req, res) => {
    try {
        const { role, _id: clientId } = req.user;

        if (role !== 'admin' && role !== 'user') {
            return res.status(403).json({ success: false, message: "Unauthorized role" });
        }
        const matchStage = { city: { $ne: null } };

        if (role === 'user') {
            matchStage.clientId = clientId;
        }

        const visitors = await Uservisitor.aggregate([
            { $match: matchStage },
            { $group: { _id: "$city", total: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: visitors.map(({ _id, total }) => ({ city: _id, total })),
        });
    } catch (error) {
        console.error("Error fetching city counts:", error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
};


exports.getVisitorDevice = async (req, res) => {
    try {
        const { role, _id: clientId } = req.user;

        if (role !== 'admin' && role !== 'user') {
            return res.status(403).json({ success: false, message: "Unauthorized role" });
        }

        const matchStage = { utm_device: { $ne: null } };

        if (role === 'user') {
            matchStage.clientId = clientId;
        }

        const visitors = await Uservisitor.aggregate([
            { $match: matchStage },
            { $group: { _id: "$utm_device", total: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: visitors.map(({ _id, total }) => ({ utm_device: _id, total })),
        });
    } catch (error) {
        console.error("Error fetching utm_device counts:", error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
};


exports.getVisitor = async (req, res) => {
    try {
        const { role, _id } = req.user;

        const now = moment();
        const startOfCurrentMonth = now.clone().startOf('month');
        const startOfLastMonth = now.clone().subtract(1, 'month').startOf('month');
        const endOfLastMonth = now.clone().startOf('month').subtract(1, 'day').endOf('day');

        const userVisitorQuery = role === "admin" ? {} : { clientId: _id };
        const conversionQuery = role === "admin" ? {} : { userId: _id };

        const [
            totalVisitors,
            uniqueVisitors,
            totalConversions,
            currentMonthConversions,
            lastMonthConversions,
            totalContacts
        ] = await Promise.all([
            Uservisitor.countDocuments(userVisitorQuery),
            Uservisitor.distinct("visitorId", userVisitorQuery),
            Conversion.countDocuments(conversionQuery),
            Conversion.countDocuments({
                ...conversionQuery,
                createdAt: { $gte: startOfCurrentMonth.toDate() }
            }),
            Conversion.countDocuments({
                ...conversionQuery,
                createdAt: {
                    $gte: startOfLastMonth.toDate(),
                    $lte: endOfLastMonth.toDate()
                }
            }),
            Contact.countDocuments(conversionQuery),
        ]);

        const calcPercentageChange = (current, last) => {
            if (last === 0) return current > 0 ? 100 : 0;
            return (((current - last) / last) * 100).toFixed(2);
        };

        res.status(200).json({
            success: true,
            totalVisitors,
            uniqueVisitorCount: uniqueVisitors.length,
            totalConversions,
            conversionGrowth: calcPercentageChange(currentMonthConversions, lastMonthConversions),
            totalContacts
        });

    } catch (error) {
        console.error("Error fetching visitor stats:", error);
        return res.status(500).send({ error: "Internal Server Error" });
    }
};


exports.getConversion = async (req, res) => {
    try {
        const { role, _id } = req.user;

        const startDate = moment().subtract(11, "months").startOf("month").toDate();
        const endDate = moment().endOf("month").toDate();

        const matchStage = {
            createdAt: { $gte: startDate, $lte: endDate },
        };

        if (role !== "admin") {
            matchStage.userId = _id;
        }

        const raw = await Conversion.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                    },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: {
                    "_id.year": 1,
                    "_id.month": 1,
                },
            },
        ]);

        const result = Array(12).fill(0);
        const categories = [];

        const current = moment();

        for (let i = 0; i < 12; i++) {
            const targetMonth = current.clone().subtract(11 - i, "months");
            const monthName = targetMonth.format("MMM");
            categories.push(monthName);

            const found = raw.find(
                (r) =>
                    r._id.month === targetMonth.month() + 1 &&
                    r._id.year === targetMonth.year()
            );

            result[i] = found ? found.count : 0;
        }

        res.status(200).json({
            success: true,
            data: result,
            categories,
        });
    } catch (error) {
        console.error("Error fetching conversions:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


exports.getStatistics = async (req, res) => {
    try {
        const { type } = req.query;
        const { role, _id } = req.user;

        if (!["daily", "monthly", "quarterly", "annually"].includes(type)) {
            return res.status(400).json({ message: "Invalid type parameter" });
        }

        const now = moment();
        const query = role === "admin" ? {} : { clientId: _id };
        const conversionQuery = role === "admin" ? {} : { userId: _id };

        let labels = [];
        let visit = [];
        let visitors = [];
        let conversion = [];

        // 1. DAILY - last 7 days
        if (type === "daily") {
            for (let i = 6; i >= 0; i--) {
                const day = moment().subtract(i, 'days');
                const start = day.clone().startOf('day');
                const end = day.clone().endOf('day');

                labels.push(day.format("DD MMM"));

                const [visitCount, uniqueVisitorCount, conversionCount] = await Promise.all([
                    Uservisitor.countDocuments({ ...query, createdAt: { $gte: start.toDate(), $lte: end.toDate() } }),
                    Uservisitor.distinct("visitorId", { ...query, createdAt: { $gte: start.toDate(), $lte: end.toDate() } }),
                    Conversion.countDocuments({ ...conversionQuery, createdAt: { $gte: start.toDate(), $lte: end.toDate() } })
                ]);

                visit.push(visitCount);
                visitors.push(uniqueVisitorCount.length);
                conversion.push(conversionCount);
            }
        }

        // 2. MONTHLY - last 6 months
        if (type === "monthly") {
            for (let i = 6; i >= 0; i--) {
                const month = moment().subtract(i, 'months');
                const start = month.clone().startOf('month');
                const end = month.clone().endOf('month');

                labels.push(month.format("MMM"));

                const [visitCount, uniqueVisitorCount, conversionCount] = await Promise.all([
                    Uservisitor.countDocuments({ ...query, createdAt: { $gte: start.toDate(), $lte: end.toDate() } }),
                    Uservisitor.distinct("visitorId", { ...query, createdAt: { $gte: start.toDate(), $lte: end.toDate() } }),
                    Conversion.countDocuments({ ...conversionQuery, createdAt: { $gte: start.toDate(), $lte: end.toDate() } })
                ]);

                visit.push(visitCount);
                visitors.push(uniqueVisitorCount.length);
                conversion.push(conversionCount);
            }
        }

        // 3. QUARTERLY - last 3 quarters (each quarter = 4 months)
        if (type === "quarterly") {
            for (let i = 2; i >= 0; i--) {
                // Calculate quarter start and end based on 4-month intervals
                const quarterEnd = moment().subtract(i * 4, 'months').endOf('month');
                const quarterStart = quarterEnd.clone().subtract(3, 'months').startOf('month');

                labels.push(`${quarterStart.format("MMM")} - ${quarterEnd.format("MMM")}`);

                const [visitCount, uniqueVisitorCount, conversionCount] = await Promise.all([
                    Uservisitor.countDocuments({ ...query, createdAt: { $gte: quarterStart.toDate(), $lte: quarterEnd.toDate() } }),
                    Uservisitor.distinct("visitorId", { ...query, createdAt: { $gte: quarterStart.toDate(), $lte: quarterEnd.toDate() } }),
                    Conversion.countDocuments({ ...conversionQuery, createdAt: { $gte: quarterStart.toDate(), $lte: quarterEnd.toDate() } })
                ]);

                visit.push(visitCount);
                visitors.push(uniqueVisitorCount.length);
                conversion.push(conversionCount);
            }
        }


        // 4. ANNUALLY - last 3 years (12 months each)
        if (type === "annually") {
            for (let i = 2; i >= 0; i--) {
                const yearStart = moment().subtract(i, 'years').startOf('year');
                const yearEnd = moment().subtract(i, 'years').endOf('year');

                labels.push(yearStart.format("YYYY"));

                const [visitCount, uniqueVisitorCount, conversionCount] = await Promise.all([
                    Uservisitor.countDocuments({ ...query, createdAt: { $gte: yearStart.toDate(), $lte: yearEnd.toDate() } }),
                    Uservisitor.distinct("visitorId", { ...query, createdAt: { $gte: yearStart.toDate(), $lte: yearEnd.toDate() } }),
                    Conversion.countDocuments({ ...conversionQuery, createdAt: { $gte: yearStart.toDate(), $lte: yearEnd.toDate() } })
                ]);

                visit.push(visitCount);
                visitors.push(uniqueVisitorCount.length);
                conversion.push(conversionCount);
            }
        }

        return res.status(200).json({
            success: true,
            data: {
                categories: labels,
                visit,
                visitors,
                conversion
            }
        });
    } catch (error) {
        console.error("Error fetching statistics:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

exports.getUniqueVisitorsSinceSignup = async (req, res) => {
    try {
        const { role, _id } = req.user;

        if (role !== 'user') {
            return res.status(403).json({ success: false, message: "This endpoint is only for users" });
        }

        // Get user's subscription data to determine actual payment window
        const User = require('../models/user.model');
        const Usersubscription = require('../models/user.subscription.model');
        const user = await User.findById(_id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const moment = require('moment-timezone');

        // Get user's active subscription to determine actual payment window
        const activeSubscription = await Usersubscription.findOne({
            userId: _id,
            status: "active"
        });

        let startDate, endDate;
        
        if (activeSubscription && activeSubscription.startDate && activeSubscription.endDate) {
            // Use actual subscription payment window dates
            startDate = moment(activeSubscription.startDate).tz("Asia/Kolkata").startOf('day');
            endDate = moment(activeSubscription.endDate).tz("Asia/Kolkata").endOf('day');
            console.log('🔍 Using subscription payment window for MAU:', {
                startDate: startDate.format('DD MMM YYYY'),
                endDate: endDate.format('DD MMM YYYY'),
                subscriptionType: activeSubscription.subCriptionType,
                duration: activeSubscription.duration
            });
        } else {
            // Fallback to signup-based calculation if no active subscription
            const signupDate = user.createdAt;
            startDate = moment(signupDate).tz("Asia/Kolkata").startOf('day');
            endDate = startDate.clone().add(1, 'month').endOf('day');
            console.log('⚠️ No active subscription found, using signup-based fallback for MAU:', {
                startDate: startDate.format('DD MMM YYYY'),
                endDate: endDate.format('DD MMM YYYY')
            });
        }

        // Convert to UTC for MongoDB query
        const startDateUTC = startDate.clone().utc().toDate();
        const endDateUTC = endDate.clone().utc().toDate();

        // 1. Get monthly unique visitors based on actual payment window
        const uniqueVisitors = await Uservisitor.distinct("visitorId", {
            clientId: _id,
            createdAt: {
                $gte: startDateUTC,
                $lte: endDateUTC
            }
        });
        const monthlyUniqueCount = uniqueVisitors.length;

        // 2. Get today's 24-hour window in IST but convert to UTC for query
        const startOfTodayUTC = moment().tz("Asia/Kolkata").startOf('day').utc().toDate();
        const endOfTodayUTC = moment().tz("Asia/Kolkata").endOf('day').utc().toDate();

        const todayDataAgg = await Uservisitor.aggregate([
            {
                $match: {
                    clientId: _id,
                    createdAt: { $gte: startOfTodayUTC, $lte: endOfTodayUTC }
                }
            },
            {
                $group: {
                    _id: null,
                    uniqueVisitors: { $addToSet: "$visitorId" }
                }
            },
            {
                $project: {
                    _id: 0,
                    uniqueVisitorCount: { $size: "$uniqueVisitors" }
                }
            }
        ]);

        // Prepare formatted IST ranges
        const dateRangeText = `${startDate.format('DD MMM YYYY')} to ${endDate.format('DD MMM YYYY')}`;
        const todayStartIST = moment(startOfTodayUTC).tz("Asia/Kolkata").format('DD MMM YYYY hh:mm A');
        const todayEndIST = moment(endOfTodayUTC).tz("Asia/Kolkata").format('DD MMM YYYY hh:mm A');

        console.log('📊 MAU Calculation Results:', {
            paymentWindow: dateRangeText,
            uniqueVisitors: monthlyUniqueCount,
            isUsingSubscriptionDates: !!(activeSubscription && activeSubscription.startDate && activeSubscription.endDate)
        });

        // Send response
        res.status(200).json({
            success: true,
            data: {
                monthly: {
                    uniqueVisitorCount: monthlyUniqueCount,
                    dateRange: dateRangeText,
                    startDate: startDate.format(), // in IST
                    endDate: endDate.format()      // in IST
                },
                daily: {
                    uniqueVisitorCount: todayDataAgg[0]?.uniqueVisitorCount || 0,
                    dateRange: `${todayStartIST} to ${todayEndIST}`
                }
            }
        });

    } catch (error) {
        console.error("Error fetching unique visitors since signup:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};
