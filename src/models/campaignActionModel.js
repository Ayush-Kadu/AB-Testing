const mongoose = require('mongoose')


const ActionSchema = new mongoose.Schema({
    actionName: {
        type: String,
        require: true,
    },
    campaignTypeId: {
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

module.exports = mongoose.model('campaign-action', ActionSchema)