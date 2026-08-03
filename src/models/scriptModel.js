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
    // The actual JS text served to visitor browsers. This is the source of
    // truth now — Render's filesystem is ephemeral (wiped on every
    // redeploy), so a script that only ever existed as a file on disk
    // disappears the next time the service redeploys. Mongo survives that.
    content: {
        type: String,
        default: null
    },

}, { versionKey: false, timestamps: true });

module.exports = mongoose.model("scripts", ScriptSchema);
