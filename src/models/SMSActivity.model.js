const mongoose = require('mongoose');

const SMSActivitySchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    to: {
        type: String,
        required: true
    },
    from: {
        type: String,
        default: ''
    },
    message: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['sent', 'failed'],
        required: true
    },
    sentAt: {
        type: Date,
        default: Date.now
    },
    visitorId: {
        type: String,
        default: null
    },
    visitId: {
        type: String,
        default: null
    },
    errorMessage: {
        type: String,
        default: null
    },
    messageType: {
        type: String,
        enum: ['sms', 'whatsapp'],
        default: 'sms'
    },
    messageId: {
        type: String,
        default: null
    },
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "usercampaign",
        default: null
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    readAt: {
        type: Date,
        default: null
    }
},
    {
        timestamps: true,
        versionKey: false
    });

module.exports = mongoose.model('sms-activity', SMSActivitySchema);
