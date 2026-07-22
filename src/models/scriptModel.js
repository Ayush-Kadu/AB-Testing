const mongoose = require("mongoose");

const ScriptSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: false
    },
    isDelete: {
        type: Boolean,
        default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

}, { versionKey: false, timestamps: true });

module.exports = mongoose.model("scripts", ScriptSchema);
