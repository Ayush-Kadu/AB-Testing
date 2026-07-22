const mongoose = require('mongoose')


const CampaignTrack = new mongoose.Schema({
    campaignId: {
        type: mongoose.Types.ObjectId,
        required: true,
        ref: 'usercampaign'
    },
    buttonValue: {
        type: String,
        default: null,
    },
    visitorId: {
        type: String,
        default: null
    },
    visitId: {
        type: String,
        default: null
    }
}, {versionKey: false, timestamps: true})

module.exports = mongoose.model('campaign-track', CampaignTrack)