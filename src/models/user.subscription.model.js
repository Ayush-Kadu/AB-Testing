const mongoose = require("mongoose");

const userSubscription = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    subCriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'packages', required: true },
    subCriptionType: { type: String, required: true },
    duration: { type: String, required: true },
    price: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: { type: String, required: true },
    remainEmail: { type: Number, required: false },
    remainSMS: { type: Number, required: false },
    remainCampaign: { type: Number, required: false },
    remainVisitors: { type: Number, required: false },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    userCancellationReason: { type: String },
    willExpireAt: { type: Date },
    upgradedAt: { type: Date },
    upgradeReason: { type: String },
    upgradedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'packages' },
    upgradeCost: { type: Number },
    proratedDays: { type: Number },
    reactivationEligible: { type: Boolean, default: true },
    // Downgrade fields
    downgradedAt: { type: Date },
    downgradeReason: { type: String },
    downgradedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'packages' },
    downgradedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'packages' },
    creditAmount: { type: Number },
    scheduledDowngrade: {
        packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'packages' },
        packageName: { type: String },
        scheduledAt: { type: Date },
        creditAmount: { type: Number }
    },


  },
  {
    timestamps: true,
    versionKey: false,
  }
);


const Usersubscription = new mongoose.model("usersubcription", userSubscription);
module.exports = Usersubscription;
