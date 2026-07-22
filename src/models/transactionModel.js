const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    paymentName: {
      type: String,
      required: true
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpayOrderId: {
      type: String,
      required: true
    },
    razorpaySignature: {
      type: String,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
    },
    status: {
      type: String,
      enum: ["created", "success", "failed", "pending"],
      required: true,
    },
    method: {
      type: String,
    },
    email: {
      type: String,
    },
    contact: {
      type: String,
    },
    raw_data: {
      type: Object,
    },
    customer_name: {
      type: String,
    },
    customer_address: {
      type: String,
    },
    customer_city: {
      type: String,
    },
    customer_zip: {
      type: String,
    },
    customer_country: {
      type: String,
    },
    customer_state: {
      type: String,
    },
    duration: {
      type: String,
    },
    startDate: {
      type: String,
    },
    endDate: {
      type: String,
    },
    noOfCampaign: {
      type: Number,
    },
    noOfVisitors: {
      type: Number,
    },
    emailLimit: {
      type: Number,
    },
    SMSLimit: {
      type: Number,
    },
    paymentMethodDetails: {
      type: {
        method: { type: String },
        card: {
          last4: { type: String },
          network: { type: String },
          type: { type: String },
          issuer: { type: String },
        },
        upi: {
          vpa: { type: String },
        },
        wallet: {
          name: { type: String },
        }
      },
      default: {},
    },
    gst_details: {
      is_same_country: { type: Boolean, required: true },
      is_same_state: { type: Boolean, required: true },
      gst_amount: { type: Number, required: true },
      gst_breakdown: {
        cgst: { type: Number, required: true },
        sgst: { type: Number, required: true },
        igst: { type: Number, required: true },
        international_gst: { type: Number, required: true }
      },
      gst_percentages: {
        cgst: { type: Number, required: true },
        sgst: { type: Number, required: true },
        igst: { type: Number, required: true },
        international_gst: { type: Number, required: true }
      }
    },
    payment_failed: {
      type: Boolean,
      default: false
    },
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    isDowngrade: {
      type: Boolean,
      default: false
    },
    adjustedDays: {
      type: Number,
      default: null
    }
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model("Transaction", transactionSchema);
