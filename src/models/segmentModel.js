const mongoose = require('mongoose');

const SegmentModel = new mongoose.Schema({

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    filters: [{
        condition: String,
        field: String,
        values: [String],
        logicalOperator: String
    }],
    isDelete: {
        default: false,
        type: Boolean
    }
},
    {
        timestamps: true,
        versionKey: false,
        strict: false
    });

module.exports = mongoose.model('segment', SegmentModel);
