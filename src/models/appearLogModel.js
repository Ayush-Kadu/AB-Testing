const mongoose = require('mongoose')


const AppearLogSchema = new mongoose.Schema({
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'usercampaign',
        require: true,
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

module.exports = mongoose.model('appear-log', AppearLogSchema)