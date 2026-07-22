const ErrorHandler = require('../utils/errorHandler')
const Pricing = require('./../models/packageModel')

exports.addPackage = async (req, res, next) => {
    try {
        const isExisting = await Pricing.findOne({ name: req.body.name, billingCycle: req.body.billingCycle });
        if (isExisting) {
            return next(new ErrorHandler('Plan already exists.', 403))
        }
        const plan = await Pricing.create(req.body)
        if (plan && plan._id) {
            res.json({
                success: true,
                data: plan
            })
        } else {
            return next(new ErrorHandler('Failed to create Plan.', 500))
        }
    } catch (error) {
        next(error)
    }
}

exports.editPackage = async (req, res, next) => {
    try {
        const updatedPlan = await Pricing.findByIdAndUpdate(req.params.packageId, req.body, { new: true });
        if (!updatedPlan) {
            return next(new ErrorHandler('Plan not found.', 404))
        }
        res.json({
            success: true,
            data: updatedPlan
        })
    } catch (error) {
        next(error)
    }
}

exports.getPackage = async (req, res, next) => {
    try {
        const plan = await Pricing.findById(req.params.packageId);
        if (!plan) {
            return next(new ErrorHandler('Package not found.'))
        }

        res.json({
            success: true,
            data: plan
        })
    } catch (error) {
        next(error)
    }
}

exports.deletePackage = async (req, res, next) => {
    try {
        const plan = await Pricing.findById(req.params.packageId);
        if (!plan) {
            return next(new ErrorHandler('Package not found.'))
        }
        await Pricing.findByIdAndDelete(req.params.packageId)
        res.json({
            success: true,
            data: "Package Deleted Successfully."
        })
    } catch (error) {
        next(error)
    }
}

exports.getAllPackages = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const totalPlans = await Pricing.countDocuments();

        const plans = await Pricing.find()
            .sort({ isDefault: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const monthly = plans.filter(plan => plan.billingCycle === 'monthly');
        const yearly = plans.filter(plan => plan.billingCycle === 'yearly');

        // const yearly = monthly.map(plan => {
        //     const yearlyPrice = 12 * plan.price;
        //     const discountedPrice = plan.percentage
        //         ? yearlyPrice - (yearlyPrice * plan.percentage) / 100
        //         : yearlyPrice;

        //     return {
        //         ...plan.toObject(),
        //         price: Math.round(discountedPrice), // Optional: round off the final price
        //         billingCycle: 'yearly',
        //         originalYearlyPrice: yearlyPrice,
        //         discountPercentage: plan.percentage || 0
        //     };
        // });

        res.status(200).json({
            total: totalPlans,
            totalPages: Math.ceil(totalPlans / limit),
            currentPage: page,
            monthly,
            yearly
        });
    } catch (error) {
        next(error);
    }
};


exports.makeDefaultPackage = async (req, res, next) => {
    try {
        const plan = await Pricing.findById(req.params.packageId);
        if (!plan) {
            return next(new ErrorHandler("Package not found", 404));
        }

        if (plan.isDefault) {
            return next(new ErrorHandler("Package is already set as default", 400));
        }

        await Pricing.updateMany({}, { isDefault: false });

        plan.isDefault = true;
        await plan.save();

        res.status(200).json({
            success: true,
            message: "Default package updated successfully",
            package: plan,
        });
    } catch (error) {
        next(error);
    }
};

exports.UpdatePackage = async (req, res, next) => {
    try {
        const packageId = req.params.id;
        const updateData = req.body;
        console.log("Update Data:", updateData);
        if (!packageId) {
            return res.status(400).json({ success: false, message: "Package ID is required" });
        }

        const updatedPackage = await Pricing.findByIdAndUpdate(packageId, updateData, { new: true });
        console.log("Updated Package:", updatedPackage);
        if (!updatedPackage) {
            return res.status(404).json({ success: false, message: "Package not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Package updated successfully",
            data: updatedPackage
        });
    } catch (error) {
        console.error("Error updating package:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
