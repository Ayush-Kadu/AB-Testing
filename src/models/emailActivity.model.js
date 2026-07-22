const mongoose = require('mongoose');

const emailActivitySchema = new mongoose.Schema({

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
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        default: ''
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
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "usercampaign",
        default: null
    }
},
    {
        timestamps: true,
        versionKey: false
    });

module.exports = mongoose.model('email-activity', emailActivitySchema);
