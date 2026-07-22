const Razorpay = require("razorpay");
const TransactionModel = require('../models/transactionModel');
const ErrorHandler = require("../utils/errorHandler");
require('dotenv').config()
const crypto = require("crypto");
const mongoose = require("mongoose");
const Usersubscription = require('../models/user.subscription.model');
const Pricing = require('./../models/packageModel');
const User = require("../models/user.model");
const { invoiceTemplate } = require("../template/invoice-template");
const puppeteer = require("puppeteer");
const { sendInvoiceEmail } = require("../utils/mailer");
const { generateNextInvoiceNumber } = require('./adminSettingControllers');
const cron = require("node-cron");


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res, next) => {
    try {
        const { name, amount, currency, customer_name, customer_email, customer_addressLine1, customer_addressLine2, customer_city, customer_zip, customer_country, customer_state, duration, sDate, eDate, noOfCampaign, noOfVisitors, emailLimit, SMSLimit, gst_details, isDowngrade, adjustedDays } = req.body;

        const order = await razorpay.orders.create({
            amount: Number(amount * 100),
            currency: currency,
        });

        if (!order) {
            return next(new ErrorHandler('Failed to create order'));
        }

        const fixedOrder = {
            ...order,
            amount: order.amount / 100,
            amount_due: order.amount_due / 100,
            amount_paid: order.amount_paid / 100,
        };

        const transactionPayload = {
            userId: new mongoose.Types.ObjectId(req.user._id),
            paymentName: name,
            amount,
            currency,
            razorpayOrderId: order.id,
            status: order.status,
            customer_name: customer_name,
            email: customer_email,
            customer_address: `${customer_addressLine1}, ${customer_addressLine2}`,
            customer_city: customer_city,
            customer_zip: customer_zip,
            customer_country: customer_country,
            customer_state: customer_state,
            contact: req.user.mobileNumber,
            raw_data: fixedOrder,
            duration: duration,
            startDate: sDate,
            endDate: eDate,
            noOfCampaign: noOfCampaign,
            noOfVisitors: noOfVisitors,
            emailLimit: emailLimit,
            SMSLimit: SMSLimit,
            gst_details: gst_details,
            isDowngrade: isDowngrade || false,
            adjustedDays: adjustedDays || null
        };

        const userUpdateFields = {
            address1: customer_addressLine1,
            address2: customer_addressLine2,
            city: customer_city,
            state: customer_state,
            country: customer_country,
            pinCode: customer_zip
        };

        const [transaction, updatedUser] = await Promise.all([
            TransactionModel.create(transactionPayload),
            User.findByIdAndUpdate(
                new mongoose.Types.ObjectId(req.user._id),
                userUpdateFields,
                { new: true }
            )
        ]);
        const transactionId = transaction._id;
        //    console.log(transactionId);

        res.json({
            success: true,
            data: order,
            user: updatedUser,
            transactionId: transactionId
        });
    } catch (error) {
        return next(error);
    }
};


exports.verifyPayment = async (req, res, next) => {

    try {
        const { razorpay_payment_id, razorpay_order_id, razorpay_signature, package_id, package_name, duration, userId, amount, sDate, eDate, payment_failed } = req.body;

        if (payment_failed == true) {
            await TransactionModel.findOneAndUpdate(
                { "razorpayOrderId": razorpay_order_id },
                {
                    status: "failed"
                }
            );
            return next(new ErrorHandler('Payment failed - no payment ID provided', 400));
        }

        const verifyString = razorpay_order_id + "|" + razorpay_payment_id
        const expect = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(verifyString).digest("hex")
        const isValid = expect === razorpay_signature;
        if (!isValid) {
            return next(new ErrorHandler('Payment verification failed!', 500))
        }

        // Fetch full payment details dynamically from Razorpay
        const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

        let paymentMethodDetails = {
            method: paymentDetails.method
        };

        if (paymentDetails.method === "card" && paymentDetails.card) {
            paymentMethodDetails.card = {
                last4: paymentDetails.card.last4 || null,
                network: paymentDetails.card.network || null,
                type: paymentDetails.card.type || null,
                issuer: paymentDetails.card.issuer || null,
            };
        } else if (paymentDetails.method === "upi" && paymentDetails.upi) {
            paymentMethodDetails.upi = {
                vpa: paymentDetails.upi.vpa || null,
            };
        } else if (paymentDetails.method === "wallet" && paymentDetails.wallet) {
            paymentMethodDetails.wallet = {
                name: paymentDetails.wallet || null,
            };
        }

        const selectedPackage = await Pricing.findOne({ name: package_name });
        if (!selectedPackage) {
            return res.status(400).json({ error: "Invalid package" });
        }

        await Usersubscription.updateMany(
            { userId: new mongoose.Types.ObjectId(userId), status: "active" },
            { $set: { status: "deactive" } }
        );

        let startDate, endDate;
        if (sDate && eDate) {
            startDate = new Date(sDate);

            if (isNaN(startDate.getTime())) {
                return res.status(400).json({ error: "Invalid start date format" });
            }

            if (duration === "monthly") {
                endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 1);
            } else if (duration === "yearly") {
                endDate = new Date(startDate);
                endDate.setFullYear(endDate.getFullYear() + 1);
            } else {
                return res.status(400).json({ error: "Invalid duration" });
            }

        } else {
            startDate = new Date();
            endDate = new Date(startDate);

            if (duration === "monthly") {
                endDate.setMonth(endDate.getMonth() + 1);
            } else if (duration === "yearly") {
                endDate.setFullYear(endDate.getFullYear() + 1);
            } else {
                return res.status(400).json({ error: "Invalid duration" });
            }
        }


        const formatDateTime = (date) => date.toISOString().slice(0, 19).replace("T", " ");
        const formattedStartDate = formatDateTime(startDate);
        const formattedEndDate = formatDateTime(endDate);

        const filter = { "razorpayOrderId": razorpay_order_id }

        const updates = {
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            status: "success",
            raw_data: paymentDetails,
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            method: paymentDetails.method,
            email: paymentDetails.email,
            contact: paymentDetails.contact,
            paymentMethodDetails: paymentMethodDetails
        };

        const transaction = await TransactionModel.findOneAndUpdate(filter, updates);
        if (!transaction) {
            return next(new ErrorHandler('Transaction not found!', 404));
        }

        // Check if this is a downgrade scenario
        const transactionData = await TransactionModel.findOne({ razorpayOrderId: razorpay_order_id });
        const isDowngrade = transactionData?.isDowngrade || false;
        const adjustedDays = transactionData?.adjustedDays || null;

        console.log("=== PAYMENT VERIFICATION DEBUG ===");
        console.log("Is Downgrade:", isDowngrade);
        console.log("Adjusted Days:", adjustedDays);
        console.log("Transaction Data:", transactionData);
        console.log("=== END PAYMENT VERIFICATION DEBUG ===");

        // Check if this is an upgrade scenario to maintain same billing cycle
        const previousSubscription = await Usersubscription.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            status: "deactive"
        }).sort({ updatedAt: -1 }); // Get the most recently deactivated one

        let newSubscription;
        
        if (isDowngrade && adjustedDays) {
            // This is a downgrade - create new billing cycle with adjusted days
            console.log("=== PAYMENT FLOW DOWNGRADE DETECTED ===");
            console.log("Downgrade detected in payment flow:", {
                to: package_name,
                adjustedDays: adjustedDays,
                amount: amount
            });

            // Create new subscription with adjusted billing cycle
            const currentDate = new Date();
            const newSubscriptionStartDate = currentDate;
            // Add adjusted days to a full monthly cycle (30 days + adjusted days)
            const totalDays = 30 + adjustedDays;
            const newSubscriptionEndDate = new Date(currentDate.getTime() + (totalDays * 24 * 60 * 60 * 1000));

            console.log("Downgrade - New Start Date:", newSubscriptionStartDate.toISOString());
            console.log("Downgrade - New End Date:", newSubscriptionEndDate.toISOString());
            console.log("Downgrade - Adjusted Days:", adjustedDays);
            console.log("Downgrade - Total Days (30 + adjusted):", totalDays);
            console.log("=== END PAYMENT FLOW DOWNGRADE DEBUG ===");

            newSubscription = new Usersubscription({
                userId: new mongoose.Types.ObjectId(userId),
                subCriptionId: new mongoose.Types.ObjectId(package_id),
                subCriptionType: package_name,
                duration: "monthly", // Always monthly for downgrades
                price: selectedPackage.price,
                startDate: formatDateTime(newSubscriptionStartDate),
                endDate: formatDateTime(newSubscriptionEndDate),
                status: "active",
                remainCampaign: selectedPackage.noOfCampaign,
                remainVisitors: selectedPackage.noOfVisitors,
                remainEmail: selectedPackage.emailLimit,
                remainSMS: selectedPackage.SMSLimit,
                proratedDays: adjustedDays,
                creditAmount: amount // Amount paid for adjusted days
            });
        } else if (previousSubscription && amount > previousSubscription.price) {
            // This is an upgrade - maintain same billing cycle
            console.log("=== PAYMENT FLOW UPGRADE DETECTED ===");
            console.log("Upgrade detected in payment flow - maintaining same billing cycle:", {
                from: previousSubscription.subCriptionType,
                to: package_name,
                fromPrice: previousSubscription.price,
                toPrice: amount
            });

            // Calculate remaining days for upgrade cost calculation
            const currentDate = new Date();
            const subscriptionStartDate = new Date(previousSubscription.startDate);
            const subscriptionEndDate = new Date(previousSubscription.endDate);
            
            // Normalize dates to remove time component for accurate day calculation
            const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            const startDateOnly = new Date(subscriptionStartDate.getFullYear(), subscriptionStartDate.getMonth(), subscriptionStartDate.getDate());
            const endDateOnly = new Date(subscriptionEndDate.getFullYear(), subscriptionEndDate.getMonth(), subscriptionEndDate.getDate());
            
            console.log("Payment Flow - Original Current Date:", currentDate.toISOString());
            console.log("Payment Flow - Original Subscription Start Date:", subscriptionStartDate.toISOString());
            console.log("Payment Flow - Original Subscription End Date:", subscriptionEndDate.toISOString());
            console.log("Payment Flow - Normalized Current Date:", currentDateOnly.toISOString());
            console.log("Payment Flow - Normalized Start Date:", startDateOnly.toISOString());
            console.log("Payment Flow - Normalized End Date:", endDateOnly.toISOString());
            
            const daysUsed = Math.floor((currentDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
            const totalDays = Math.ceil((endDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
            const remainingDays = totalDays - daysUsed;
            
            console.log("Payment Flow - Days Used:", daysUsed);
            console.log("Payment Flow - Total Days in Cycle:", totalDays);
            console.log("Payment Flow - Remaining Days:", remainingDays);
            console.log("Payment Flow - Amount Paid:", amount);
            console.log("=== END PAYMENT FLOW UPGRADE DEBUG ===");

            newSubscription = new Usersubscription({
                userId: new mongoose.Types.ObjectId(userId),
                subCriptionId: new mongoose.Types.ObjectId(package_id),
                subCriptionType: package_name,
                duration,
                price: selectedPackage.price, // Store full package price for reference
                startDate: previousSubscription.startDate, // SAME start date
                endDate: previousSubscription.endDate, // SAME end date
                status: "active",
                remainCampaign: selectedPackage.noOfCampaign,
                remainVisitors: selectedPackage.noOfVisitors,
                remainEmail: selectedPackage.emailLimit,
                remainSMS: selectedPackage.SMSLimit,
                upgradedFrom: new mongoose.Types.ObjectId(previousSubscription.subCriptionId),
                upgradeCost: amount, // Amount actually paid for upgrade
                proratedDays: remainingDays // Days remaining in current cycle
            });
        } else {
            // This is a new subscription - create new billing cycle
            newSubscription = new Usersubscription({
                userId: new mongoose.Types.ObjectId(userId),
                subCriptionId: new mongoose.Types.ObjectId(package_id),
                subCriptionType: package_name,
                duration,
                price: amount,
                startDate: formattedStartDate,
                endDate: formattedEndDate,
                status: "active",
                remainCampaign: selectedPackage.noOfCampaign,
                remainVisitors: selectedPackage.noOfVisitors,
                remainEmail: selectedPackage.emailLimit,
                remainSMS: selectedPackage.SMSLimit
            });
        }

        await newSubscription.save();

        // Check if this is a downgrade scenario and send downgrade email
        if (isDowngrade && adjustedDays) {
            try {
                // Get user details for email
                const User = require('../models/user.model');
                const user = await User.findById(new mongoose.Types.ObjectId(userId));
                
                if (user) {
                    const userName = `${user.firstName} ${user.lastName}`.trim() || user.firstName || 'User';
                    const newEndDateFormatted = new Date(newSubscription.endDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    
                    // Get the previous subscription to show the from plan
                    const previousSubscription = await Usersubscription.findOne({
                        userId: new mongoose.Types.ObjectId(userId),
                        status: "deactive"
                    }).sort({ updatedAt: -1 });
                    
                    const fromPlan = previousSubscription ? previousSubscription.subCriptionType : "Previous Plan";
                    
                    // Send downgrade email
                    const { sendEmail } = require('../utils/mailer');
                    const { downgradeEmailTemplate } = require('../template/emailTemplates');
                    
                    await sendEmail(
                        user.email, 
                        "Subscription Downgraded - URLPT", 
                        downgradeEmailTemplate(
                            userName, 
                            fromPlan,
                            package_name, 
                            amount, // creditAmount
                            newEndDateFormatted // newEndDate
                        )
                    );
                    console.log(`Downgrade email sent to: ${user.email}`);
                }
            } catch (emailError) {
                console.error('Failed to send downgrade email in payment flow:', emailError);
                // Don't fail the payment if email fails
            }
        }

        // Check if this is an upgrade scenario and send upgrade email
        try {
            // Get the previous subscription that was just deactivated
            const previousSubscription = await Usersubscription.findOne({
                userId: new mongoose.Types.ObjectId(userId),
                status: "deactive",
                _id: { $ne: newSubscription._id } // Exclude the current subscription
            }).sort({ updatedAt: -1 }); // Get the most recently deactivated one

            // Check if this is an upgrade (new package price > previous package price)
            if (previousSubscription && amount > previousSubscription.price) {
                console.log("Upgrade detected in payment flow:", {
                    from: previousSubscription.subCriptionType,
                    to: package_name,
                    fromPrice: previousSubscription.price,
                    toPrice: amount
                });

                // Get user details for email
                const User = require('../models/user.model');
                const user = await User.findById(new mongoose.Types.ObjectId(userId));
                
                if (user) {
                    const userName = `${user.firstName} ${user.lastName}`.trim() || user.firstName || 'User';
                    const newEndDateFormatted = new Date(endDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    
                    // Calculate upgrade cost (difference in prices)
                    const upgradeCost = amount - previousSubscription.price;
                    
                    // Send upgrade email
                    const { sendEmail } = require('../utils/mailer');
                    const { upgradeEmailTemplate } = require('../template/emailTemplates');
                    
                    await sendEmail(
                        user.email, 
                        "Subscription Upgraded - URLPT", 
                        upgradeEmailTemplate(
                            userName, 
                            previousSubscription.subCriptionType, 
                            package_name, 
                            upgradeCost, 
                            newEndDateFormatted
                        )
                    );
                    console.log(`Upgrade email sent to: ${user.email}`);
                    
                    // Update the previous subscription to mark it as upgraded
                    await Usersubscription.updateOne(
                        { _id: previousSubscription._id },
                        { 
                            $set: { 
                                upgradedAt: new Date(),
                                upgradeReason: "upgraded_to_higher_plan"
                            } 
                        }
                    );
                    
                    // Update the new subscription to include upgrade relationship
                    await Usersubscription.updateOne(
                        { _id: newSubscription._id },
                        { 
                            $set: { 
                                upgradedFrom: new mongoose.Types.ObjectId(previousSubscription.subCriptionId),
                                upgradeCost: upgradeCost
                            } 
                        }
                    );
                }
            }
        } catch (emailError) {
            console.error('Failed to send upgrade email in payment flow:', emailError);
            // Don't fail the payment if email fails
        }

        res.status(200).json({ success: true });

    } catch (error) {
        return next(error)
    }

}


exports.getTransaction = async (req, res, next) => {
    try {
        const { role, _id } = req.user;
        let { page, limit, paymentName, status, razorpayOrderId, amount, email, contact, createdAt } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        let filter = {};

        // Role-based filtering
        if (role === 'user') {
            filter.userId = new mongoose.Types.ObjectId(_id);
        }


        if (paymentName) filter.paymentName = { $regex: paymentName, $options: "i" };
        if (razorpayOrderId) filter.razorpayOrderId = { $regex: razorpayOrderId, $options: "i" };
        if (amount) filter.amount = amount;
        if (status) filter.status = status;
        if (email) filter.email = { $regex: email, $options: "i" };
        if (contact) filter.contact = { $regex: contact, $options: "i" };

        let transactions = await TransactionModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalRecords = await TransactionModel.countDocuments(filter);

        res.json({
            success: true,
            data: transactions,
            total: totalRecords,
            pages: Math.ceil(totalRecords / limit),
        });
    } catch (error) {
        next(error);
    }
};


//sanjeev code

exports.postTransaction = async (req, res, next) => {

    const { orderId } = req.body;

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
        };

        let paymentDetails = '';

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



        const order = {
            id: invoiceNumber, //newly generated invoice
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

        // 2. Create PDF from HTML
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: "networkidle0" });

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
        });

        await browser.close();
        const attachments = [
            {
                filename: `invoice-${order?.id || Date.now()}.pdf`,
                content: pdfBuffer,
            },
        ];


        if (razorpayPaymentId) {
            try {
                const info = await sendInvoiceEmail(email, "Payment Invoice", html, attachments);

                res.status(200).json({
                    success: true,
                    message: "Invoice email sent",
                    info
                });
            } catch (error) {
                console.error("Failed to send invoice email:", error);

                res.status(500).json({
                    success: false,
                    message: "Payment succeeded but email failed",
                    error: error.message,
                    stack: error.stack,
                    details: error,
                });
            }
        } else {
            res.status(400).json({ success: false, msg: "Payment Failed." });
        }


    } catch (error) {
        console.error('Email sending Failed', error);
        res.status(500).send('Failed to Send Invoice on Email.');
    }

}

