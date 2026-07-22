const mongoose = require('mongoose');
const loginHistorySchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    loginTime: {
        type: Date,
        required: true
    },
    ip: {
        type: String,
        default: null
    },
    authType: {
        type: String,
    },
    method: {
        type: String,
    },
    city: {
        type: String,
    },
    state: {
        type: String,
    },
    country: {
        type: String,
    },
    postal: {
        type: String,
    },
    logOutTime: {
        type: Date,
    },
},
    {
        timestamps: true,
        versionKey: false
    });

module.exports = mongoose.model('login-histories', loginHistorySchema)
