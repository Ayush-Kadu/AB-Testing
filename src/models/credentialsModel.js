const mongoose = require('mongoose')


const CredentialModel = new mongoose.Schema({
    credName: {
        type: String,
        require: true,
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: 'users',
        required: true
    },
    isDelete: {
        type: Boolean,
        default: false
    }
}, {versionKey: false, timestamps: true, strict: false})

module.exports = mongoose.model('credentials', CredentialModel)