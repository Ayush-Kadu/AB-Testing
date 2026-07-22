const mongoose = require("mongoose");

const emailSubmissionSchema = new mongoose.Schema(
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
    email: { 
      type: String, 
      required: true 
    },
    name: { 
      type: String, 
      required: false 
    },
    visitorId: { 
      type: String, 
      required: false 
    },
    visitId: { 
      type: String, 
      required: false 
    },
    campaignType: {
      type: String,
      required: false
    },
    campaignAction: {
      type: String,
      required: false
    }
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false
  }
);

const EmailSubmission = mongoose.model("email-submissions", emailSubmissionSchema);
module.exports = EmailSubmission; 