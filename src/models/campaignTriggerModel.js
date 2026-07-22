const mongoose = require('mongoose')


const TriggerSchema = new mongoose.Schema({
    triggerName: {
        type: String,
        require: true,
    },
    campaignTypeId: {
        type: [mongoose.Types.ObjectId],
        default: []
    },
    campaignActionId: {
        type: [mongoose.Types.ObjectId],
        default: []
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

module.exports = mongoose.model('campaign-triggers', TriggerSchema)