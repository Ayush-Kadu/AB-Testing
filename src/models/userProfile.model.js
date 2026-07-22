const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    visitorId: {
        type: String,
    }
},
    {
        timestamps: true,
        versionKey: false
    });

module.exports = mongoose.model('user-profile', userProfileSchema)
