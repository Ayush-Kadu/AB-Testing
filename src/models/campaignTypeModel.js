const mongoose = require('mongoose')


const CampaignType = new mongoose.Schema({
    name: {
        type: String,
        require: true,
        unique: true
    }, 
    isActive: {
        type: Boolean,
        default: true,
    },
    isDelete: {
        type: Boolean,
        default: false
    }
}, {versionKey: false, timestamps: true})

module.exports = mongoose.model('campaign-type', CampaignType)