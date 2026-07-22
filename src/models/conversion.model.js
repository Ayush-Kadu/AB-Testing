const mongoose = require('mongoose');
const conversionSchema = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    visitorId: {
        type: String,
        required: false
    },
    visitId: {
        type: Number,
        required: false
    },
    product_name: {
        type: String,
    },
    conversion_value: {
        type: Number,
    },
    currency: {
        type: String,
    },
    conversion_key: {
        type: String,
        required: false
    },
    conversion_date: {
        type: String,
    },
    level: {
        type: String,
    },

},
    {
        timestamps: true,
        versionKey: false
    });

module.exports = mongoose.model('conversion', conversionSchema)
