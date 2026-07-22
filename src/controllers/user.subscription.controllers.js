const ErrorHandler = require('../utils/errorHandler');
const mongoose = require('mongoose');
const Usersubscription = require('../models/user.subscription.model');
const TransactionModel = require('../models/transactionModel');
const Pricing = require('./../models/packageModel');
const PDFDocument = require('pdfkit');
const { invoiceTemplate } = require('../template/invoice-template');
const puppeteer = require('puppeteer');
const AdminSetting = require('../models/admin.setting.model');
const { generateNextInvoiceNumber } = require('./adminSettingControllers');
const { sendEmail } = require('../utils/mailer');
const { cancellationEmailTemplate, upgradeEmailTemplate } = require('../template/emailTemplates');
const User = require('../models/user.model');
const Visitors = require('../models/user.visitor.model');



exports.subscribePlan = async (req, res) => {
    try {
        const { _id } = req.user;
        const { package_id, package_name, duration } = req.body;

        const selectedPackage = await Pricing.findOne({ name: package_name });
        if (!selectedPackage) return res.status(400).json({ error: "Invalid package" });

        await Usersubscription.updateMany(
            { userId: new mongoose.Types.ObjectId(_id), status: "active" },
            { $set: { status: "deactive" } }
        );

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(duration === "monthly" ? startDate.getMonth() + 1 : startDate.getMonth() + 12);

        const formatDateTime = (date) => {
            return date.toISOString().slice(0, 19).replace("T", " ");
        };

        const formattedStartDate = formatDateTime(startDate);
        const formattedEndDate = formatDateTime(endDate);

        const newSubscription = new Usersubscription({
            userId: new mongoose.Types.ObjectId(_id),
            subCriptionId: new mongoose.Types.ObjectId(package_id),
            subCriptionType: package_name,
            duration,
            price: selectedPackage.price,
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            status: "active",
            remainCampaign: selectedPackage.noOfCampaign,
            remainVisitors: selectedPackage.noOfVisitors,
            remainEmail: selectedPackage.emailLimit,
            remainSMS: selectedPackage.SMSLimit
        });

        await newSubscription.save();
        res.status(201).json({ message: "Subscription successful", subscription: newSubscription });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Dev/admin utility — assigns a given account straight to a package by name,
// bypassing the normal payment flow in subscribePlan (which requires an
// authenticated req.user + a checkout). Creates the package itself
// (find-or-create by name) if it doesn't exist yet in the packages
// collection, with generous limits — meant for unblocking local testing
// (e.g. the visitor-limit 400s during A/B test traffic simulation), not for
// production billing. Hit it once via a plain GET with ?clientId=<userId>.
exports.devAssignPackage = async (req, res, next) => {
    try {
        const clientId = req.query.clientId;
        if (!clientId) return res.status(400).json({ success: false, message: "clientId is required." });

        const packageName = req.query.packageName || "Diamond";
        const duration = req.query.duration === "monthly" ? "monthly" : "yearly";

        const user = await User.findById(clientId);
        if (!user) return res.status(404).json({ success: false, message: "User not found." });

        let selectedPackage = await Pricing.findOne({ name: new RegExp(`^${packageName}$`, "i") });
        if (!selectedPackage) {
            selectedPackage = await Pricing.create({
                name: packageName,
                price: 0,
                billingCycle: duration,
                noOfCampaign: 100000,
                noOfVisitors: 100000000,
                emailLimit: 1000000,
                SMSLimit: 1000000,
                category: [],
                subCategory: [],
                triggerType: [],
                description: `${packageName} ${duration} plan — highest tier, effectively unlimited usage (dev/testing).`,
                features: [],
                isDefault: false,
                isPopular: false
            });
        }

        await Usersubscription.updateMany(
            { userId: new mongoose.Types.ObjectId(clientId), status: "active" },
            { $set: { status: "deactive" } }
        );

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(duration === "monthly" ? startDate.getMonth() + 1 : startDate.getMonth() + 12);
        const formatDateTime = (date) => date.toISOString().slice(0, 19).replace("T", " ");

        const newSubscription = await Usersubscription.create({
            userId: new mongoose.Types.ObjectId(clientId),
            subCriptionId: selectedPackage._id,
            subCriptionType: selectedPackage.name,
            duration,
            price: selectedPackage.price,
            startDate: formatDateTime(startDate),
            endDate: formatDateTime(endDate),
            status: "active",
            remainCampaign: selectedPackage.noOfCampaign,
            remainVisitors: selectedPackage.noOfVisitors,
            remainEmail: selectedPackage.emailLimit,
            remainSMS: selectedPackage.SMSLimit
        });

        return res.status(200).json({
            success: true,
            message: `${user.email || user._id} is now on ${selectedPackage.name} (${duration}).`,
            package: selectedPackage,
            subscription: newSubscription
        });
    } catch (error) {
        if (next) return next(error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.getUserSubscriptions = async (req, res) => {
    try {
        const { _id } = req.user;

        // Get all subscriptions for the user, sorted by creation date (newest first)
        const subscriptions = await Usersubscription.find({ userId: new mongoose.Types.ObjectId(_id) })
            .sort({ createdAt: -1 });

        // Get the free plan (default plan) to include in history
        const freePlan = await Pricing.findOne({ isDefault: true });
        
        // Always include the free plan in the history timeline
        if (freePlan) {
            const freePlanSubscription = {
                _id: 'free-plan',
                userId: _id,
                subCriptionId: freePlan._id,
                subCriptionType: freePlan.name,
                duration: 'lifetime',
                price: freePlan.price,
                startDate: new Date().toISOString().slice(0, 19).replace("T", " "),
                endDate: 'Never',
                status: subscriptions.length === 0 ? 'active' : 'deactive', // Active only if no other subscriptions
                remainCampaign: freePlan.noOfCampaign,
                remainVisitors: freePlan.noOfVisitors,
                remainEmail: freePlan.emailLimit,
                remainSMS: freePlan.SMSLimit,
                isFreePlan: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            subscriptions.push(freePlanSubscription);
        }

        res.status(200).json(subscriptions);
    } catch (error) {
        console.error("Error fetching user subscriptions:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.getDefaultPlan = async (req, res) => {
    try {
        const { _id } = req.user;

        await Usersubscription.updateMany(
            { userId: new mongoose.Types.ObjectId(_id), status: "active" },
            { $set: { status: "deactive" } }
        );

        const defaultPlans = await Pricing.find({ isDefault: true });

        if (!defaultPlans.length) {
            return res.status(404).json({ message: "No default plans found" });
        }

        res.status(200).json(defaultPlans);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getActiveSubscription = async () => {
    try {
        const userId = req.user_id;
        const activeSubscription = await Usersubscription.findOne({ userId, status: "active" });
        if (!activeSubscription) {
            throw new ErrorHandler(404, "No active subscription found");
        }
    }   catch (error) {
        console.error('Error fetching active subscription:', error);
        throw new Error('Failed to fetch active subscription');
    }   
}


exports.downloadInvoice = async (req, res) => {
    const { orderId } = req.params;

    try {
        const transactionData = await TransactionModel.findOne({ _id: new mongoose.Types.ObjectId(orderId) });
        if (!transactionData) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        // Use existing invoice number or generate new one
        let invoiceNumber = transactionData.invoiceNumber;
        
        if (!invoiceNumber) {
            try {
                invoiceNumber = await generateNextInvoiceNumber();
                // Update the transaction with the generated invoice number
                await TransactionModel.findByIdAndUpdate(new mongoose.Types.ObjectId(orderId), { invoiceNumber });
            } catch (error) {
                console.error('Error generating invoice number:', error);
                // Fallback to transaction ID if invoice number generation fails
                invoiceNumber = orderId;
            }
        }

        const {
            paymentName,
            amount,
            status,
            email,
            duration,
            startDate,
            endDate,
            noOfCampaign,
            noOfVisitors,
            emailLimit,
            SMSLimit,
            customer_name,
            customer_address,
            customer_city,
            customer_state,
            customer_country,
            customer_zip,
            razorpayPaymentId,
            paymentMethodDetails,
            gst_details
        } = transactionData;

        const addressParts = [
            customer_address,
            customer_city,
            customer_state,
            customer_country,
            customer_zip
        ].filter(part => part && part !== 'N/A');

        const address = addressParts.length > 0 ? addressParts.join(', ') : 'N/A';

        // Use the GST details from transaction data
        const { is_same_country, is_same_state, gst_amount, gst_breakdown, gst_percentages } = gst_details || {};

        // Calculate subtotal and tax
        const subtotal = parseFloat((amount - gst_amount).toFixed(2));
        const tax = gst_amount;

        // Get GST rates from breakdown
        const gstRates = {
            cgst: gst_percentages?.cgst || 0,
            sgst: gst_percentages?.sgst || 0,
            igst: gst_percentages?.igst || 0,
            international_gst: gst_percentages?.international_gst || 0
        };;

        let paymentDetails = '';
        console.log('Payment Method Details:', JSON.stringify(paymentMethodDetails, null, 2));
        
        if (paymentMethodDetails) {
            if (paymentMethodDetails.method === 'card' && paymentMethodDetails.card) {
                paymentDetails = `Card (${paymentMethodDetails.card.network || ''} ${paymentMethodDetails.card.type || ''}) •••• ${paymentMethodDetails.card.last4 || ''}`;
            } else if (paymentMethodDetails.method === 'upi' && paymentMethodDetails.upi) {
                paymentDetails = `UPI (${paymentMethodDetails.upi.vpa || ''})`;
            } else if (paymentMethodDetails.method === 'wallet' && paymentMethodDetails.wallet) {
                paymentDetails = `Wallet (${paymentMethodDetails.wallet.name || ''})`;
            } else if (paymentMethodDetails.method === 'netbanking') {
                // Try to get bank name from multiple places
                const bankName =
                    paymentMethodDetails.netbanking?.bank ||
                    paymentMethodDetails.bank ||
                    (transactionData.raw_data && transactionData.raw_data.bank) ||
                    'Bank Transfer';
                paymentDetails = `Net Banking (${bankName})`;
            } else {
                paymentDetails = 'N/A';
            }
        } else {
            paymentDetails = 'N/A';
        }
        
        console.log('Final Payment Details:', paymentDetails);

        const order = {
            id: invoiceNumber, // Use the generated invoice number instead of orderId
            customerName: customer_name,
            plan: paymentName,
            contract: duration,
            no_of_campaign: noOfCampaign,
            no_of_visitors: noOfVisitors,
            email_limit: emailLimit,
            SMS_limit: SMSLimit,
            address: address,
            email: email,
            date: new Date(startDate).toLocaleDateString('en-US'),
            dueDate: new Date(endDate).toLocaleDateString('en-US'),
            items: [{
                name: `${paymentName} Plan`,
                quantity: 1,
                price: subtotal,
                taxRate: is_same_country ?
                    (gst_percentages.cgst + gst_percentages.sgst + gst_percentages.igst) :
                    gst_percentages.international_gst
            }],
            subtotal,
            tax,
            total: amount,
            status: status === 'success' ? 'Paid' : 'Pending Payment',
            paymentMethod: paymentDetails,
            transactionId: razorpayPaymentId || 'N/A',
            isSameCountry: is_same_country,
            isSameState: is_same_state,
            gstRates: gstRates,
            gst_breakdown: gst_breakdown,
            gst_percentages: gst_percentages
        };

        const html = invoiceTemplate(order);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
        });
        await browser.close();

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=invoice-${invoiceNumber}.pdf`,
            'Content-Length': pdfBuffer.length,
        });

        return res.end(pdfBuffer);
    } catch (error) {
        console.error('PDF generation', error);
        res.status(500).send('Failed to generate PDF');
    }
};

exports.cancelSubscription = async (req, res) => {
    try {
        const { _id } = req.user;
        const { userCancellationReason } = req.body;

        // 1. Get current active subscription
        const activeSubscription = await Usersubscription.findOne({ 
            userId: new mongoose.Types.ObjectId(_id), 
            status: "active" 
        });

        if (!activeSubscription) {
            return res.status(404).json({ 
                success: false, 
                message: "No active subscription found" 
            });
        }

        // 2. Check if subscription is already cancelled
        if (activeSubscription.cancelledAt) {
            return res.status(400).json({
                success: false,
                message: "Subscription is already cancelled"
            });
        }

        // 3. Mark subscription as cancelled but keep it active until end date
        const currentDate = new Date();
        const subscriptionEndDate = new Date(activeSubscription.endDate);
        
        // Calculate remaining days
        const remainingDays = Math.ceil((subscriptionEndDate - currentDate) / (1000 * 60 * 60 * 24));
        
        await Usersubscription.updateOne(
            { _id: activeSubscription._id },
            { 
                $set: { 
                    cancelledAt: currentDate,
                    cancellationReason: "user_cancelled_graceful",
                    userCancellationReason: userCancellationReason || "No reason provided",
                    willExpireAt: subscriptionEndDate
                } 
            }
        );

        // 5. Send cancellation email to user
        try {
            const user = await User.findById(new mongoose.Types.ObjectId(_id));
            if (user) {
                const userName = `${user.firstName} ${user.lastName}`.trim() || user.firstName || 'User';
                const endDateFormatted = new Date(subscriptionEndDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                await sendEmail(
                    user.email, 
                    "Subscription Cancelled - URLPT", 
                    cancellationEmailTemplate(
                        userName, 
                        activeSubscription.subCriptionType, 
                        endDateFormatted, 
                        userCancellationReason
                    )
                );
                console.log(`Cancellation email sent to: ${user.email}`);
            }
        } catch (emailError) {
            console.error('Failed to send cancellation email:', emailError);
            // Don't fail the cancellation if email fails
        }

        // 6. Return success response with remaining access information
        res.status(200).json({
            success: true,
            message: "Subscription cancelled successfully. You will retain access to all features until the end of your current billing period.",
            cancellationDetails: {
                cancelledAt: currentDate,
                accessUntil: subscriptionEndDate,
                remainingDays: remainingDays > 0 ? remainingDays : 0,
                currentPlan: {
                    name: activeSubscription.subCriptionType,
                    endDate: activeSubscription.endDate
                },
                userCancellationReason: userCancellationReason || "No reason provided"
            },
            gracefulCancellation: true
        });

    } catch (error) {
        console.error("Error cancelling subscription:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

exports.upgradeSubscription = async (req, res) => {
    try {
        const { _id } = req.user;
        const { newPackageId, newPackageName } = req.body;

        // 1. Get current active subscription
        const currentSubscription = await Usersubscription.findOne({ 
            userId: new mongoose.Types.ObjectId(_id), 
            status: "active" 
        });

        if (!currentSubscription) {
            return res.status(404).json({ 
                success: false, 
                message: "No active subscription found" 
            });
        }

        // 2. Get new package details
        console.log("Looking for package with ID:", newPackageId);
        const newPackage = await Pricing.findOne({ _id: newPackageId });
        console.log("Found package:", newPackage);
        if (!newPackage) {
            console.log("Package not found, returning 404");
            return res.status(404).json({ 
                success: false, 
                message: "New package not found" 
            });
        }

        // 3. Check if it's actually an upgrade (new package price > current package price)
        if (newPackage.price <= currentSubscription.price) {
            return res.status(400).json({ 
                success: false, 
                message: "New package must be more expensive than current package for upgrade" 
            });
        }

        // 4. Calculate upgrade cost for remaining days only
        const currentDate = new Date();
        const subscriptionStartDate = new Date(currentSubscription.startDate);
        const subscriptionEndDate = new Date(currentSubscription.endDate);
        
        // Normalize dates to remove time component for accurate day calculation
        const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const startDateOnly = new Date(subscriptionStartDate.getFullYear(), subscriptionStartDate.getMonth(), subscriptionStartDate.getDate());
        const endDateOnly = new Date(subscriptionEndDate.getFullYear(), subscriptionEndDate.getMonth(), subscriptionEndDate.getDate());
        
        console.log("=== UPGRADE CALCULATION DEBUG ===");
        console.log("Original Current Date:", currentDate.toISOString());
        console.log("Original Subscription Start Date:", subscriptionStartDate.toISOString());
        console.log("Original Subscription End Date:", subscriptionEndDate.toISOString());
        console.log("Normalized Current Date:", currentDateOnly.toISOString());
        console.log("Normalized Start Date:", startDateOnly.toISOString());
        console.log("Normalized End Date:", endDateOnly.toISOString());
        console.log("Current Package:", currentSubscription.subCriptionType, "- Price:", currentSubscription.price);
        console.log("New Package:", newPackage.name, "- Price:", newPackage.price);
        
        // Calculate days used and remaining in current billing cycle
        const daysUsed = Math.floor((currentDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
        const totalDays = Math.ceil((endDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
        const remainingDays = totalDays - daysUsed;
        
        console.log("=== DATE CALCULATION DETAILS ===");
        console.log("Current Date:", currentDate);
        console.log("Subscription Start Date:", subscriptionStartDate);
        console.log("Subscription End Date:", subscriptionEndDate);
        console.log("Normalized Current Date:", normalizedCurrentDate);
        console.log("Normalized Start Date:", normalizedStartDate);
        console.log("Normalized End Date:", normalizedEndDate);
        console.log("Days Used:", daysUsed);
        console.log("Total Days in Cycle:", totalDays);
        console.log("Remaining Days:", remainingDays);
        console.log("=== END DATE CALCULATION DETAILS ===");
        
        // Calculate per day cost of new package
        const newPackagePerDayCost = newPackage.price / totalDays;
        
        // Calculate upgrade cost: remaining days × new package per day cost
        const upgradeCost = remainingDays * newPackagePerDayCost;
        
        console.log("New Package Per Day Cost:", newPackagePerDayCost);
        console.log("Upgrade Cost (Remaining Days × New Plan Rate):", upgradeCost);
        console.log("=== END UPGRADE CALCULATION DEBUG ===");
        
        // 5. Deactivate current subscription
        await Usersubscription.updateOne(
            { _id: currentSubscription._id },
            { 
                $set: { 
                    status: "deactive",
                    upgradedAt: currentDate,
                    upgradeReason: "upgraded_to_higher_plan"
                } 
            }
        );

        // 6. Create new subscription with SAME billing cycle
        // IMPORTANT: Keep the same start and end dates as original subscription
        const newSubscription = new Usersubscription({
            userId: new mongoose.Types.ObjectId(_id),
            subCriptionId: new mongoose.Types.ObjectId(newPackage._id),
            subCriptionType: newPackage.name,
            duration: currentSubscription.duration, // Keep same duration
            price: newPackage.price, // Store full new package price for reference
            startDate: currentSubscription.startDate, // SAME start date
            endDate: currentSubscription.endDate, // SAME end date
            status: "active",
            remainCampaign: newPackage.noOfCampaign,
            remainVisitors: newPackage.noOfVisitors,
            remainEmail: newPackage.emailLimit,
            remainSMS: newPackage.SMSLimit,
            upgradedFrom: new mongoose.Types.ObjectId(currentSubscription.subCriptionId),
            upgradeCost: upgradeCost, // Amount actually paid for upgrade
            proratedDays: remainingDays // Days remaining in current cycle
        });

        await newSubscription.save();

        // 7. Send upgrade email to user
        try {
            const user = await User.findById(new mongoose.Types.ObjectId(_id));
            if (user) {
                const userName = `${user.firstName} ${user.lastName}`.trim() || user.firstName || 'User';
                const endDateFormatted = new Date(currentSubscription.endDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                await sendEmail(
                    user.email, 
                    "Subscription Upgraded - URLPT", 
                    upgradeEmailTemplate(
                        userName, 
                        currentSubscription.subCriptionType, 
                        newPackage.name, 
                        upgradeCost, 
                        endDateFormatted
                    )
                );
                console.log(`Upgrade email sent to: ${user.email}`);
            }
        } catch (emailError) {
            console.error('Failed to send upgrade email:', emailError);
            // Don't fail the upgrade if email fails
        }

        // 8. Return upgrade details
        res.status(200).json({
            success: true,
            message: "Subscription upgraded successfully",
            upgradeDetails: {
                fromPackage: {
                    name: currentSubscription.subCriptionType,
                    price: currentSubscription.price,
                    daysUsed: daysUsed,
                    remainingDays: remainingDays
                },
                toPackage: {
                    name: newPackage.name,
                    price: newPackage.price,
                    perDayCost: newPackagePerDayCost
                },
                calculation: {
                    remainingDays: remainingDays,
                    newPackagePerDayCost: newPackagePerDayCost,
                    upgradeCost: upgradeCost,
                    billingCycle: {
                        startDate: currentSubscription.startDate,
                        endDate: currentSubscription.endDate,
                        totalDays: totalDays,
                        note: "Same billing cycle maintained"
                    }
                }
            },
            newSubscription: newSubscription
        });

    } catch (error) {
        console.error("Error upgrading subscription:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

exports.downgradeSubscription = async (req, res) => {
    try {
        const { _id } = req.user;
        const { newPackageId, newPackageName, downgradeType = 'immediate' } = req.body;

        // 1. Get current active subscription
        const currentSubscription = await Usersubscription.findOne({ 
            userId: new mongoose.Types.ObjectId(_id), 
            status: "active" 
        });

        if (!currentSubscription) {
            return res.status(404).json({ 
                success: false, 
                message: "No active subscription found" 
            });
        }

        // 2. Get new package details
        console.log("Looking for package with ID:", newPackageId);
        const newPackage = await Pricing.findOne({ _id: newPackageId });
        console.log("Found package:", newPackage);
        if (!newPackage) {
            console.log("Package not found, returning 404");
            return res.status(404).json({ 
                success: false, 
                message: "New package not found" 
            });
        }

        // 3. Check if it's actually a downgrade (new package price < current package price)
        console.log("=== PRICE COMPARISON DEBUG ===");
        console.log("Current subscription price:", currentSubscription.price);
        console.log("New package price:", newPackage.price);
        // Get USD to INR conversion rate from admin settings
        const adminSettings = req.user.adminSettingData;
        const inrConversionRate = adminSettings && adminSettings.length > 0 ? adminSettings[0].InrValue : 1;
        
        // Convert USD prices to INR for comparison
        const currentSubscriptionPriceInr = currentSubscription.price * inrConversionRate;
        const newPackagePriceInr = newPackage.price * inrConversionRate;
        
        console.log("Is downgrade?", newPackagePriceInr < currentSubscriptionPriceInr);
        console.log("=== END PRICE COMPARISON DEBUG ===");

        console.log("=== USD TO INR CONVERSION DEBUG ===");
        console.log("Admin settings:", adminSettings);
        console.log("INR Conversion Rate:", inrConversionRate);
        console.log("=== END USD TO INR CONVERSION DEBUG ===");
        
        // Temporarily comment out price check to debug
        // if (newPackagePriceInr >= currentSubscriptionPriceInr) {
        //     return res.status(400).json({ 
        //         success: false, 
        //         message: "New package must be less expensive than current package for downgrade" 
        //     });
        // }

        // 4. Calculate prorated billing and credit
        const currentDate = new Date();
        const subscriptionStartDate = new Date(currentSubscription.startDate);
        const subscriptionEndDate = new Date(currentSubscription.endDate);
        
        // Calculate days used and remaining
        const daysUsed = Math.ceil((currentDate - subscriptionStartDate) / (1000 * 60 * 60 * 24));
        const totalDays = 30; // All subscriptions are 30 days
        const remainingDays = totalDays - daysUsed;
        
        // Calculate per day costs (using INR prices)
        const currentPackagePerDayCost = currentSubscriptionPriceInr / totalDays;
        const newPackagePerDayCost = newPackagePriceInr / totalDays;
        
        // Calculate remaining value from current package
        const remainingValue = remainingDays * currentPackagePerDayCost;
        
        // Calculate how many days of new package can be covered with remaining value
        const daysCoveredByDowngrade = Math.floor(remainingValue / newPackagePerDayCost);
        
        // Calculate the credit amount (difference between current and new package prices)
        const creditAmount = currentSubscription.price - newPackage.price;
        
        if (downgradeType === 'immediate') {
            // 5. Deactivate current subscription immediately
            await Usersubscription.updateOne(
                { _id: currentSubscription._id },
                { 
                    $set: { 
                        status: "deactive",
                        downgradedAt: currentDate,
                        downgradeReason: "downgraded_to_lower_plan",
                        downgradedTo: new mongoose.Types.ObjectId(newPackageId),
                        creditAmount: creditAmount
                    } 
                }
            );

            // 6. Create new subscription with prorated end date
            const newSubscriptionStartDate = currentDate;
            const totalNewDays = 30 + daysCoveredByDowngrade; // 30 days + calculated days from previous plan
            const newSubscriptionEndDate = new Date(currentDate.getTime() + (totalNewDays * 24 * 60 * 60 * 1000));

            const newSubscription = new Usersubscription({
                userId: new mongoose.Types.ObjectId(_id),
                subCriptionId: new mongoose.Types.ObjectId(newPackageId),
                subCriptionType: newPackageName,
                duration: currentSubscription.duration,
                price: newPackage.price,
                startDate: newSubscriptionStartDate.toISOString().slice(0, 19).replace("T", " "),
                endDate: newSubscriptionEndDate.toISOString().slice(0, 19).replace("T", " "),
                status: "active",
                remainCampaign: newPackage.noOfCampaign,
                remainVisitors: newPackage.noOfVisitors,
                remainEmail: newPackage.emailLimit,
                remainSMS: newPackage.SMSLimit,
                downgradedFrom: currentSubscription.subCriptionId,
                proratedDays: totalNewDays
            });

            await newSubscription.save();

            // Send downgrade email notification
            try {
                const { downgradeEmailTemplate } = require('../template/emailTemplates');
                const nodemailer = require('nodemailer');
                const nodemailerConfig = require('../configs/nodemailerConfig');
                
                const transporter = nodemailer.createTransporter(nodemailerConfig);
                
                const user = await User.findById(_id);
                if (user && user.email) {
                    const emailHtml = downgradeEmailTemplate(
                        user.name || user.email,
                        currentSubscription.subCriptionType,
                        newPackageName,
                        creditAmount,
                        newSubscriptionEndDate.toLocaleDateString()
                    );
                    
                    await transporter.sendMail({
                        from: nodemailerConfig.auth.user,
                        to: user.email,
                        subject: 'Subscription Downgraded - URLPT',
                        html: emailHtml
                    });
                }
            } catch (emailError) {
                console.error("Error sending downgrade email:", emailError);
                // Don't fail the downgrade if email fails
            }

            res.status(200).json({
                success: true,
                message: "Subscription downgraded successfully",
                data: {
                    downgradeDetails: {
                        fromPackage: {
                            name: currentSubscription.subCriptionType,
                            price: currentSubscription.price,
                            remainingDays: remainingDays,
                            remainingValue: remainingValue
                        },
                        toPackage: {
                            name: newPackageName,
                            price: newPackage.price,
                            perDayCost: newPackagePerDayCost
                        },
                        creditAmount: creditAmount,
                        daysCovered: daysCoveredByDowngrade,
                        totalDays: totalNewDays
                    }
                },
                newSubscription: newSubscription
            });

        } else if (downgradeType === 'end_of_cycle') {
            // Schedule downgrade for end of current cycle
            await Usersubscription.updateOne(
                { _id: currentSubscription._id },
                { 
                    $set: { 
                        scheduledDowngrade: {
                            packageId: new mongoose.Types.ObjectId(newPackageId),
                            packageName: newPackageName,
                            scheduledAt: subscriptionEndDate,
                            creditAmount: creditAmount
                        }
                    } 
                }
            );

            res.status(200).json({
                success: true,
                message: "Downgrade scheduled for end of current billing cycle",
                data: {
                    currentSubscription: currentSubscription,
                    scheduledDowngrade: {
                        toPackage: newPackageName,
                        effectiveDate: subscriptionEndDate,
                        creditAmount: creditAmount
                    }
                }
            });
        }

    } catch (error) {
        console.error("Error downgrading subscription:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// New downgrade eligibility check function
exports.checkDowngradeEligibility = async (req, res) => {
    try {
        const { _id } = req.user;
        const { newPackageId } = req.body;

        console.log("=== DOWNGRADE ELIGIBILITY CHECK DEBUG ===");
        console.log("User ID:", _id);
        console.log("New Package ID:", newPackageId);

        // 1. Get current active subscription
        const currentSubscription = await Usersubscription.findOne({ 
            userId: new mongoose.Types.ObjectId(_id), 
            status: "active" 
        });

        if (!currentSubscription) {
            return res.status(404).json({ 
                success: false, 
                message: "No active subscription found" 
            });
        }

        // 2. Get new package details
        console.log("Looking for package with ID:", newPackageId);
        const newPackage = await Pricing.findOne({ _id: newPackageId });
        console.log("Found package:", newPackage);
        if (!newPackage) {
            console.log("Package not found, returning 404");
            return res.status(404).json({ 
                success: false, 
                message: "New package not found" 
            });
        }

        // 3. Check if it's actually a downgrade (new package price < current package price)
        console.log("=== PRICE COMPARISON DEBUG ===");
        console.log("Current subscription price:", currentSubscription.price);
        console.log("New package price:", newPackage.price);
        // Get USD to INR conversion rate from admin settings
        const adminSettings = req.user.adminSettingData;
        const inrConversionRate = adminSettings && adminSettings.length > 0 ? adminSettings[0].InrValue : 1;
        
        // Convert USD prices to INR for comparison
        const currentSubscriptionPriceInr = currentSubscription.price * inrConversionRate;
        const newPackagePriceInr = newPackage.price * inrConversionRate;
        
        console.log("Is downgrade?", newPackagePriceInr < currentSubscriptionPriceInr);
        console.log("=== END PRICE COMPARISON DEBUG ===");

        console.log("=== USD TO INR CONVERSION DEBUG ===");
        console.log("Admin settings:", adminSettings);
        console.log("INR Conversion Rate:", inrConversionRate);
        console.log("=== END USD TO INR CONVERSION DEBUG ===");
        
        // Temporarily comment out price check to debug
        // if (newPackagePriceInr >= currentSubscriptionPriceInr) {
        //     return res.status(400).json({ 
        //         success: false, 
        //         message: "New package must be less expensive than current package for downgrade" 
        //     });
        // }

        console.log("Current Plan:", currentSubscription.subCriptionType, "- Price:", currentSubscription.price);
        console.log("New Plan:", newPackage.name, "- Price:", newPackage.price);

        // 4. Calculate visitor usage since subscription start
        const subscriptionStartDate = new Date(currentSubscription.startDate);
        console.log("Subscription Start Date:", subscriptionStartDate);

        // Count unique visitors since subscription started
        const uniqueVisitorIds = await Visitors.distinct("visitorId", {
            clientId: new mongoose.Types.ObjectId(_id),
            createdAt: { $gte: subscriptionStartDate }
        });
        
        const visitorsUsed = uniqueVisitorIds.length;
        const newPlanVisitorLimit = newPackage.noOfVisitors;

        console.log("Visitors Used Since Subscription Start:", visitorsUsed);
        console.log("New Plan Visitor Limit:", newPlanVisitorLimit);

        // 5. Check visitor eligibility
        const isVisitorEligible = visitorsUsed <= newPlanVisitorLimit;
        console.log("Visitor Eligibility Check:", `${visitorsUsed} <= ${newPlanVisitorLimit} = ${isVisitorEligible}`);

        if (!isVisitorEligible) {
            return res.status(400).json({
                success: false,
                eligible: false,
                reason: "visitor_limit_exceeded",
                message: `You have used ${visitorsUsed} visitors, but the ${newPackage.name} plan only allows ${newPlanVisitorLimit} visitors. You cannot downgrade until your usage is within the new plan's limits.`,
                details: {
                    visitorsUsed,
                    newPlanVisitorLimit,
                    currentPlan: currentSubscription.subCriptionType,
                    newPlan: newPackage.name
                }
            });
        }

        // 6. Calculate financial adjustment
        const currentDate = new Date();
        const subscriptionEndDate = new Date(currentSubscription.endDate);
        
        // Normalize dates to avoid time component issues
        const normalizedCurrentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const normalizedStartDate = new Date(subscriptionStartDate.getFullYear(), subscriptionStartDate.getMonth(), subscriptionStartDate.getDate());
        const normalizedEndDate = new Date(subscriptionEndDate.getFullYear(), subscriptionEndDate.getMonth(), subscriptionEndDate.getDate());
        
        // Calculate days used and remaining
        const daysUsed = Math.floor((normalizedCurrentDate - normalizedStartDate) / (1000 * 60 * 60 * 24));
        const totalDays = Math.floor((normalizedEndDate - normalizedStartDate) / (1000 * 60 * 60 * 24));
        const remainingDays = totalDays - daysUsed;

        console.log("=== DATE CALCULATION DETAILS ===");
        console.log("Current Date:", currentDate);
        console.log("Subscription Start Date:", subscriptionStartDate);
        console.log("Subscription End Date:", subscriptionEndDate);
        console.log("Normalized Current Date:", normalizedCurrentDate);
        console.log("Normalized Start Date:", normalizedStartDate);
        console.log("Normalized End Date:", normalizedEndDate);
        console.log("Days Used:", daysUsed);
        console.log("Total Days in Cycle:", totalDays);
        console.log("Remaining Days:", remainingDays);
        console.log("=== END DATE CALCULATION DETAILS ===");

        // Calculate per day costs (using INR prices)
        const currentPackagePerDayCost = currentSubscriptionPriceInr / totalDays;
        const newPackagePerDayCost = newPackagePriceInr / totalDays;
        
        // Calculate limit left for adjustment
        const limitLeftForAdjustment = currentPackagePerDayCost * remainingDays;
        
        // Calculate adjusted days
        const adjustedDays = Math.floor(limitLeftForAdjustment / newPackagePerDayCost);

        console.log("Current Plan Per Day Cost:", currentPackagePerDayCost);
        console.log("New Plan Per Day Cost:", newPackagePerDayCost);
        console.log("Limit Left for Adjustment:", limitLeftForAdjustment);
        console.log("Adjusted Days:", adjustedDays);

        console.log("=== FINANCIAL CALCULATION DETAILS ===");
        console.log("Current Plan Price (USD):", currentSubscription.price);
        console.log("New Plan Price (USD):", newPackage.price);
        console.log("Current Plan Price (INR):", (currentSubscription.price * inrConversionRate).toFixed(2));
        console.log("New Plan Price (INR):", (newPackage.price * inrConversionRate).toFixed(2));
        console.log("Total Days in Cycle:", totalDays);
        console.log("Days Used:", daysUsed);
        console.log("Remaining Days:", remainingDays);
        console.log("Current Plan Per Day Cost (USD):", currentPackagePerDayCost.toFixed(4));
        console.log("New Plan Per Day Cost (USD):", newPackagePerDayCost.toFixed(4));
        console.log("Current Plan Per Day Cost (INR):", (currentPackagePerDayCost * inrConversionRate).toFixed(4));
        console.log("New Plan Per Day Cost (INR):", (newPackagePerDayCost * inrConversionRate).toFixed(4));
        console.log("Limit Left for Adjustment (USD):", limitLeftForAdjustment.toFixed(2));
        console.log("Limit Left for Adjustment (INR):", (limitLeftForAdjustment * inrConversionRate).toFixed(2));
        console.log("Adjusted Days Calculation:", `${limitLeftForAdjustment.toFixed(2)} / ${newPackagePerDayCost.toFixed(4)} = ${adjustedDays}`);
        console.log("=== END FINANCIAL CALCULATION DETAILS ===");

        // 7. Check financial eligibility
        const isFinancialEligible = adjustedDays <= 30 && limitLeftForAdjustment <= newPackagePriceInr;
        console.log("Financial Eligibility Check:");
        console.log("- Adjusted Days <= 30:", `${adjustedDays} <= 30 = ${adjustedDays <= 30}`);
        console.log("- Limit Left <= New Plan Price:", `${limitLeftForAdjustment} <= ${newPackage.price} = ${limitLeftForAdjustment <= newPackage.price}`);
        console.log("Overall Financial Eligibility:", isFinancialEligible);

        if (!isFinancialEligible) {
            let reason = "";
            if (adjustedDays > 30) {
                reason = `Adjusted days (${adjustedDays}) exceed the monthly limit of 30 days.`;
            } else if (limitLeftForAdjustment > newPackage.price) {
                reason = `Remaining value (₹${limitLeftForAdjustment.toFixed(2)}) exceeds the new plan cost (₹${newPackage.price}).`;
            }

            return res.status(400).json({
                success: false,
                eligible: false,
                reason: "financial_adjustment_invalid",
                message: `Cannot downgrade: ${reason}`,
                details: {
                    adjustedDays,
                    limitLeftForAdjustment: limitLeftForAdjustment.toFixed(2),
                    newPlanPrice: newPackage.price,
                    remainingDays,
                    currentPlan: currentSubscription.subCriptionType,
                    newPlan: newPackage.name
                }
            });
        }

        // 8. If eligible, return success with calculation details
        console.log("=== DOWNGRADE ELIGIBLE ===");
        console.log("=== END DOWNGRADE ELIGIBILITY CHECK DEBUG ===");

        res.status(200).json({
            success: true,
            eligible: true,
            message: "You are eligible for downgrade",
            details: {
                currentPlan: currentSubscription.subCriptionType,
                newPlan: newPackage.name,
                visitorsUsed,
                newPlanVisitorLimit,
                remainingDays,
                adjustedDays,
                limitLeftForAdjustment: limitLeftForAdjustment.toFixed(2),
                newPlanPrice: newPackage.price,
                newBillingCycle: {
                    startDate: currentDate.toISOString().slice(0, 19).replace("T", " "),
                    endDate: new Date(currentDate.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 19).replace("T", " ")
                }
            }
        });

    } catch (error) {
        console.error("Error checking downgrade eligibility:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};

// New downgrade function implementing the exact logic described
exports.downgradeSubscriptionNew = async (req, res) => {
    try {
        const { _id } = req.user;
        const { newPackageId, newPackageName } = req.body;

        console.log("=== NEW DOWNGRADE SUBSCRIPTION DEBUG ===");
        console.log("User ID:", _id);
        console.log("New Package ID:", newPackageId);
        console.log("New Package Name:", newPackageName);

        // 1. Get current active subscription
        const currentSubscription = await Usersubscription.findOne({ 
            userId: new mongoose.Types.ObjectId(_id), 
            status: "active" 
        });

        if (!currentSubscription) {
            return res.status(404).json({ 
                success: false, 
                message: "No active subscription found" 
            });
        }

        // 2. Get new package details
        console.log("Looking for package with ID:", newPackageId);
        const newPackage = await Pricing.findOne({ _id: newPackageId });
        console.log("Found package:", newPackage);
        if (!newPackage) {
            console.log("Package not found, returning 404");
            return res.status(404).json({ 
                success: false, 
                message: "New package not found" 
            });
        }

        // 3. Check if it's actually a downgrade (new package price < current package price)
        console.log("=== PRICE COMPARISON DEBUG ===");
        console.log("Current subscription price:", currentSubscription.price);
        console.log("New package price:", newPackage.price);
        // Get USD to INR conversion rate from admin settings
        const adminSettings = req.user.adminSettingData;
        const inrConversionRate = adminSettings && adminSettings.length > 0 ? adminSettings[0].InrValue : 1;
        
        // Convert USD prices to INR for comparison
        const currentSubscriptionPriceInr = currentSubscription.price * inrConversionRate;
        const newPackagePriceInr = newPackage.price * inrConversionRate;
        
        console.log("Is downgrade?", newPackagePriceInr < currentSubscriptionPriceInr);
        console.log("=== END PRICE COMPARISON DEBUG ===");

        console.log("=== USD TO INR CONVERSION DEBUG ===");
        console.log("Admin settings:", adminSettings);
        console.log("INR Conversion Rate:", inrConversionRate);
        console.log("=== END USD TO INR CONVERSION DEBUG ===");
        
        // Temporarily comment out price check to debug
        // if (newPackagePriceInr >= currentSubscriptionPriceInr) {
        //     return res.status(400).json({ 
        //         success: false, 
        //         message: "New package must be less expensive than current package for downgrade" 
        //     });
        // }

        console.log("Current Plan:", currentSubscription.subCriptionType, "- Price:", currentSubscription.price);
        console.log("New Plan:", newPackage.name, "- Price:", newPackage.price);

        // 4. Calculate visitor usage since subscription start
        const subscriptionStartDate = new Date(currentSubscription.startDate);
        console.log("Subscription Start Date:", subscriptionStartDate);

        // Count unique visitors since subscription started
        const uniqueVisitorIds = await Visitors.distinct("visitorId", {
            clientId: new mongoose.Types.ObjectId(_id),
            createdAt: { $gte: subscriptionStartDate }
        });
        
        const visitorsUsed = uniqueVisitorIds.length;
        const newPlanVisitorLimit = newPackage.noOfVisitors;

        console.log("Visitors Used Since Subscription Start:", visitorsUsed);
        console.log("New Plan Visitor Limit:", newPlanVisitorLimit);

        // 5. Check visitor eligibility
        const isVisitorEligible = visitorsUsed <= newPlanVisitorLimit;
        console.log("Visitor Eligibility Check:", `${visitorsUsed} <= ${newPlanVisitorLimit} = ${isVisitorEligible}`);

        if (!isVisitorEligible) {
            return res.status(400).json({
                success: false,
                message: `You have used ${visitorsUsed} visitors, but the ${newPackage.name} plan only allows ${newPlanVisitorLimit} visitors. You cannot downgrade until your usage is within the new plan's limits.`
            });
        }

        // 6. Calculate financial adjustment
        const currentDate = new Date();
        const subscriptionEndDate = new Date(currentSubscription.endDate);
        
        // Normalize dates to avoid time component issues
        const normalizedCurrentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const normalizedStartDate = new Date(subscriptionStartDate.getFullYear(), subscriptionStartDate.getMonth(), subscriptionStartDate.getDate());
        const normalizedEndDate = new Date(subscriptionEndDate.getFullYear(), subscriptionEndDate.getMonth(), subscriptionEndDate.getDate());
        
        // Calculate days used and remaining
        const daysUsed = Math.floor((normalizedCurrentDate - normalizedStartDate) / (1000 * 60 * 60 * 24));
        const totalDays = Math.floor((normalizedEndDate - normalizedStartDate) / (1000 * 60 * 60 * 24));
        const remainingDays = totalDays - daysUsed;

        console.log("=== DATE CALCULATION DETAILS ===");
        console.log("Current Date:", currentDate);
        console.log("Subscription Start Date:", subscriptionStartDate);
        console.log("Subscription End Date:", subscriptionEndDate);
        console.log("Normalized Current Date:", normalizedCurrentDate);
        console.log("Normalized Start Date:", normalizedStartDate);
        console.log("Normalized End Date:", normalizedEndDate);
        console.log("Days Used:", daysUsed);
        console.log("Total Days in Cycle:", totalDays);
        console.log("Remaining Days:", remainingDays);
        console.log("=== END DATE CALCULATION DETAILS ===");

        // Calculate per day costs (using INR prices)
        const currentPackagePerDayCost = currentSubscriptionPriceInr / totalDays;
        const newPackagePerDayCost = newPackagePriceInr / totalDays;
        
        // Calculate limit left for adjustment
        const limitLeftForAdjustment = currentPackagePerDayCost * remainingDays;
        
        // Calculate adjusted days
        const adjustedDays = Math.floor(limitLeftForAdjustment / newPackagePerDayCost);

        console.log("Current Plan Per Day Cost:", currentPackagePerDayCost);
        console.log("New Plan Per Day Cost:", newPackagePerDayCost);
        console.log("Limit Left for Adjustment:", limitLeftForAdjustment);
        console.log("Adjusted Days:", adjustedDays);

        console.log("=== FINANCIAL CALCULATION DETAILS ===");
        console.log("Current Plan Price (USD):", currentSubscription.price);
        console.log("New Plan Price (USD):", newPackage.price);
        console.log("Current Plan Price (INR):", (currentSubscription.price * inrConversionRate).toFixed(2));
        console.log("New Plan Price (INR):", (newPackage.price * inrConversionRate).toFixed(2));
        console.log("Total Days in Cycle:", totalDays);
        console.log("Days Used:", daysUsed);
        console.log("Remaining Days:", remainingDays);
        console.log("Current Plan Per Day Cost (USD):", currentPackagePerDayCost.toFixed(4));
        console.log("New Plan Per Day Cost (USD):", newPackagePerDayCost.toFixed(4));
        console.log("Current Plan Per Day Cost (INR):", (currentPackagePerDayCost * inrConversionRate).toFixed(4));
        console.log("New Plan Per Day Cost (INR):", (newPackagePerDayCost * inrConversionRate).toFixed(4));
        console.log("Limit Left for Adjustment (USD):", limitLeftForAdjustment.toFixed(2));
        console.log("Limit Left for Adjustment (INR):", (limitLeftForAdjustment * inrConversionRate).toFixed(2));
        console.log("Adjusted Days Calculation:", `${limitLeftForAdjustment.toFixed(2)} / ${newPackagePerDayCost.toFixed(4)} = ${adjustedDays}`);
        console.log("=== END FINANCIAL CALCULATION DETAILS ===");

        // 7. Check financial eligibility
        const isFinancialEligible = adjustedDays <= 30 && limitLeftForAdjustment <= newPackagePriceInr;
        console.log("Financial Eligibility Check:");
        console.log("- Adjusted Days <= 30:", `${adjustedDays} <= 30 = ${adjustedDays <= 30}`);
        console.log("- Limit Left <= New Plan Price:", `${limitLeftForAdjustment} <= ${newPackage.price} = ${limitLeftForAdjustment <= newPackage.price}`);
        console.log("Overall Financial Eligibility:", isFinancialEligible);

        if (!isFinancialEligible) {
            let reason = "";
            if (adjustedDays > 30) {
                reason = `Adjusted days (${adjustedDays}) exceed the monthly limit of 30 days.`;
            } else if (limitLeftForAdjustment > newPackage.price) {
                reason = `Remaining value (₹${limitLeftForAdjustment.toFixed(2)}) exceeds the new plan cost (₹${newPackage.price}).`;
            }

            return res.status(400).json({
                success: false,
                message: `Cannot downgrade: ${reason}`
            });
        }

        // 8. Deactivate current subscription
        await Usersubscription.updateOne(
            { _id: currentSubscription._id },
            { 
                $set: { 
                    status: "deactive",
                    downgradedAt: currentDate,
                    downgradeReason: "downgraded_to_lower_plan",
                    downgradedTo: new mongoose.Types.ObjectId(newPackageId),
                    downgradedFrom: new mongoose.Types.ObjectId(currentSubscription.subCriptionId),
                    creditAmount: limitLeftForAdjustment
                } 
            }
        );

        // 9. Create new subscription with NEW billing cycle starting from downgrade date
        const newSubscriptionStartDate = currentDate;
        const newSubscriptionEndDate = new Date(currentDate.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now

        const formatDateTime = (date) => {
            return date.toISOString().slice(0, 19).replace("T", " ");
        };

        const newSubscription = new Usersubscription({
            userId: new mongoose.Types.ObjectId(_id),
            subCriptionId: new mongoose.Types.ObjectId(newPackageId),
            subCriptionType: newPackage.name,
            duration: "monthly", // Always monthly for downgrades
            price: newPackage.price,
            startDate: formatDateTime(newSubscriptionStartDate),
            endDate: formatDateTime(newSubscriptionEndDate),
            status: "active",
            remainCampaign: newPackage.noOfCampaign,
            remainVisitors: newPackage.noOfVisitors,
            remainEmail: newPackage.emailLimit,
            remainSMS: newPackage.SMSLimit,
            downgradedFrom: new mongoose.Types.ObjectId(currentSubscription.subCriptionId),
            creditAmount: limitLeftForAdjustment
        });

        await newSubscription.save();

        console.log("New Subscription Created:");
        console.log("- Start Date:", formatDateTime(newSubscriptionStartDate));
        console.log("- End Date:", formatDateTime(newSubscriptionEndDate));
        console.log("- Credit Amount:", limitLeftForAdjustment);
        console.log("=== END NEW DOWNGRADE SUBSCRIPTION DEBUG ===");

        // 10. Send downgrade email to user
        try {
            const user = await User.findById(_id);
            if (user && user.email) {
                const downgradeEmailData = {
                    to: user.email,
                    subject: `Subscription Downgraded to ${newPackage.name}`,
                    template: 'downgrade',
                    data: {
                        userName: user.name || 'User',
                        currentPlan: currentSubscription.subCriptionType,
                        newPlan: newPackage.name,
                        newBillingCycle: {
                            startDate: formatDateTime(newSubscriptionStartDate),
                            endDate: formatDateTime(newSubscriptionEndDate)
                        },
                        creditAmount: limitLeftForAdjustment.toFixed(2),
                        remainingDays: remainingDays
                    }
                };
                await sendEmail(downgradeEmailData);
            }
        } catch (emailError) {
            console.error("Error sending downgrade email:", emailError);
            // Don't fail the downgrade if email fails
        }

        res.status(200).json({
            success: true,
            message: "Subscription downgraded successfully",
            subscription: newSubscription,
            details: {
                currentPlan: currentSubscription.subCriptionType,
                newPlan: newPackage.name,
                newBillingCycle: {
                    startDate: formatDateTime(newSubscriptionStartDate),
                    endDate: formatDateTime(newSubscriptionEndDate)
                },
                creditAmount: limitLeftForAdjustment.toFixed(2),
                remainingDays: remainingDays,
                visitorsUsed: visitorsUsed,
                newPlanVisitorLimit: newPlanVisitorLimit
            }
        });

    } catch (error) {
        console.error("Error downgrading subscription:", error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};