const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
    countryName: {
        type: String,
        required: true
    },
    currencySymbol: {
        type: String,
        required: true
    },
    currencyCode: {
        type: String,
        required: true
    },
    isoNumber: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('Country', countrySchema);