// models/admin-setting.model.js
const mongoose = require('mongoose');

const adminSettingSchema = new mongoose.Schema({
    InrValue: {
        type: Number,
        required: true
    },
    logoutTime: {
        type: Number,
        default: 5,
        min: [1, 'Logout time must be at least 1 minute']
    },
    gstSettings: {
        intra_state_tax: {
            sgst: { type: Number, default: 0, min: 0, max: 100 },
            cgst: { type: Number, default: 0, min: 0, max: 100 },
            igst: { type: Number, default: 0, min: 0, max: 100 }
        },
        inter_state_tax: {
            sgst: { type: Number, default: 0, min: 0, max: 100 },
            cgst: { type: Number, default: 0, min: 0, max: 100 },
            igst: { type: Number, default: 0, min: 0, max: 100 }
        },
        International_tax: {
            gst: { type: Number, default: 0, min: 0, max: 100 }
        }
    },
    invoiceSeries: {
        prefix: { type: String, default: 'MJ' },
        currentNumber: { type: Number, default: 1 },
        currentYear: { type: String },
        currentMonth: { type: String },
        isFrozen: { type: Boolean, default: false },
        lastResetDate: { type: Date }
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('admin-setting', adminSettingSchema);