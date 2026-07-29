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
},

/* ===========================
   Campaign Scheduling
   ---------------------------
   Deliberately kept as its own sub-object rather than touching the
   existing top-level `status`/`isActive` fields — those already have a
   well-established meaning everywhere a campaign is served or listed
   (isActive:true + status:'published' = live). The scheduler's job is
   just to flip those two fields at the right time; it never introduces
   a competing notion of "is this campaign live."

   `effectivePublishAt` is the one field the scheduler actually queries
   on. Today it's always set equal to `startAt` (exact mode) or the
   window's start (window mode, "publish at window start" per current
   spec). Wiring in an AI publish-time optimizer later means computing a
   smarter value into this same field — the scheduler itself never has
   to change.
=========================== */
schedule: {
    repeat: {
    type: String,
    enum: [
        "none",
        "daily",
        "weekly",
        "monthly"
    ],
    default: "none"
    },
    excludeWeekends: {
    type: Boolean,
    default: false
    },
    priority: {
    type: String,
    enum: [
        "low",
        "medium",
        "high"
    ],
    default: "medium"
    },
    mode: {
        type: String,
        enum: ["exact", "window"],
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    // IANA timezone name the user scheduled in, e.g. "Asia/Kolkata". Used
    // only to convert the user's wall-clock input to UTC at schedule-set
    // time; everything stored below (startAt/endAt/effectivePublishAt) is
    // always UTC.
    timezone: {
        type: String,
        default: null
    },
    // Exact mode: the single publish instant (UTC).
    // Window mode: the window's start (UTC).
    startAt: {
        type: Date,
        default: null
    },
    // Window mode only: the window's end (UTC). Not used for publish
    // timing yet (see effectivePublishAt), just stored so a future
    // optimizer has the full window to reason about.
    endAt: {
        type: Date,
        default: null
    },
    effectivePublishAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ["unscheduled", "scheduled", "publishing", "published", "failed", "cancelled", "completed"],
        default: "unscheduled"
    },
    attempts: {
        type: Number,
        default: 0
    },
    maxAttempts: {
        type: Number,
        default: 3
    },
    lastError: {
        type: String,
        default: null
    },
    lastAttemptAt: {
        type: Date,
        default: null
    },
    publishedAt: {
        type: Date,
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    scheduledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },
    scheduledAt: {
        type: Date,
        default: null
    }
}

  },
  {
    timestamps: true,
    versionKey: false,
    strict: false
  }
);

// Primary scheduler query: "find campaigns due to publish right now."
// Partial index (only campaigns actually in play for scheduling) keeps
// this small and fast regardless of total campaign volume.
userCampaign.index(
  { "schedule.status": 1, "schedule.effectivePublishAt": 1 },
  {
    name: "schedule_due_lookup",
    partialFilterExpression: { "schedule.status": { $in: ["scheduled", "publishing"] } }
  }
);

// "List scheduled campaigns for this account" queries.
userCampaign.index({ clientId: 1, "schedule.status": 1 }, { name: "schedule_by_client" });

const Usercampaign = new mongoose.model("usercampaign", userCampaign);
module.exports = Usercampaign;
