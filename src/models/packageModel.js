const mongoose = require("mongoose");

const pricingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  billingCycle: {
    type: String,
    enum: ["monthly", "yearly"],
    required: true
  },
  noOfCampaign: {
    type: Number,
    required: true
  },
  noOfVisitors: {
    type: Number,
    required: true
  },
  emailLimit: {
    type: Number,
    required: true
  },
  SMSLimit: {
    type: Number,
    required: true
  },
  category: {
    type: Array,
    required: true
  },
  subCategory: {
    type: Array,
    required: true
  },
  triggerType: {
    type: Array,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  percentage: {
    type: Number,
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  features: [{ type: String }],
  isPopular: { type: Boolean, default: false },
}, { versionKey: false, timestamps: true });

module.exports = mongoose.model("packages", pricingSchema);
