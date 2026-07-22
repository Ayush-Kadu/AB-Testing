const mongoose = require("mongoose");

const userCampaign = new mongoose.Schema(
  {
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
     websiteId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Website",   // Reference Website model
      required: true    // make required if every campaign must be linked to a website
    },
    heading: { type: String, required: false },
    imageURL: { type: String, required: false },
    popupContent: { type: String, required: false },
    selectedOption: { type: String, required: false },
    triggerType: { type: String, required: false },
    onsiteAction: { type: String, required: false },
    pageTime: { type: String, required: false },
    campaigndesignerName: { type: String, required: false },
    scrollPercentage: { type: String, required: false },
    showCloseBtn: { type: String, required: false },
    username: { type: String, required: false },
    hours: { type: String, required: false },
    minutes: { type: String, required: false },
    seconds: { type: String, required: false },
    days: { type: String, required: false },
    timerStarted: { type: String, required: false },
    region: { type: String, required: false },
    trafficSource: { type: String, required: false },
    subject: { type: String, default: 'Campaign Email' }, // Subject field for email campaigns
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Templates', // replace 'Template' with the correct model name
    },
    segmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'segment', // replace 'Template' with the correct model name
    },
    hasContent: {
      type: Boolean,
      default: false
    },
    clicks: {
      type: Number,
      default: 0,
    },
    showTeaser: {
      type: Boolean,
      default: true
    },
/* ===========================
   A/B Testing
=========================== */

isABTesting: {
    type: Boolean,
    default: false
},

experimentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Experiment",
    default: null
}

  },
  {
    timestamps: true,
    versionKey: false,
    strict: false
  }
);

const Usercampaign = new mongoose.model("usercampaign", userCampaign);
module.exports = Usercampaign;
