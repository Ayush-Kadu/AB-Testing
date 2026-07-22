const mongoose = require("mongoose");

const ExperimentSchema = new mongoose.Schema(
{
    campaignId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "usercampaign",
        required: true
    },

    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    websiteId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },

    experimentName: {
        type: String,
        required: true
    },

    status: {
        type: String,
        enum: ["draft","running","paused","completed"],
        default: "draft"
    },

    trafficSplit: {
        type: Number,
        default: 50
    },

    winnerVariant: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    }

},
{
    timestamps:true
});

module.exports = mongoose.model("Experiment", ExperimentSchema);