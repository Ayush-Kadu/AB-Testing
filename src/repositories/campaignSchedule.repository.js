// ============================================================================
// Repository layer — the only place in this feature that touches Mongoose
// directly. Services call these functions and never build queries
// themselves; that keeps the atomic-claim logic (the thing that prevents
// double-publishing) in exactly one place.
// ============================================================================
const mongoose = require("mongoose");
const Campaign = require("../models/user.campaign.model");
const SchedulerLog = require("../models/schedulerLog.model");

const SCHEDULE_FIELDS =
  "_id clientId campaigndesignerName isActive status schedule createdAt updatedAt";

async function findCampaignForOwner(campaignId, clientId) {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) return null;
  return Campaign.findOne({ _id: campaignId, clientId }).select(SCHEDULE_FIELDS);
}

async function findCampaignById(campaignId) {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) return null;
  return Campaign.findById(campaignId).select(SCHEDULE_FIELDS);
}

// Sets/replaces the entire schedule sub-object. Used by both "schedule
// campaign" (fresh) and "update schedule" (overwrite) — the service layer
// decides which fields carry over vs reset (e.g. attempts always resets
// to 0 on a genuine reschedule).
async function saveSchedule(campaignId, scheduleData) {
  return Campaign.findByIdAndUpdate(
    campaignId,
    { $set: { schedule: scheduleData } },
    { new: true, runValidators: true }
  ).select(SCHEDULE_FIELDS);
}

async function cancelSchedule(campaignId) {
  return Campaign.findByIdAndUpdate(
    campaignId,
    {
      $set: {
        "schedule.status": "cancelled",
        "schedule.cancelledAt": new Date()
      }
    },
    { new: true }
  ).select(SCHEDULE_FIELDS);
}

async function getSchedule(campaignId, clientId) {
  const campaign = await Campaign.findOne({ _id: campaignId, clientId }).select("schedule campaigndesignerName");
  return campaign;
}

async function listScheduled({ clientId, status, page = 1, limit = 20 }) {
  const filter = { clientId, "schedule.mode": { $ne: null } };
  if (status) {
    filter["schedule.status"] = status;
  } else {
    // Default view: anything still "in flight" — not cancelled, not a
    // terminal failure the user hasn't dealt with, and not yet folded
    // back into normal published state without a trace (published stays
    // visible too, so users can see recently-auto-published campaigns).
    filter["schedule.status"] = { $in: ["scheduled", "publishing", "published", "failed"] };
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [items, total] = await Promise.all([
    Campaign.find(filter)
      .select(SCHEDULE_FIELDS)
      .sort({ "schedule.effectivePublishAt": 1 })
      .skip(skip)
      .limit(limit),
    Campaign.countDocuments(filter)
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// The scheduler's core read: everything due right now, oldest-due first,
// capped to a batch size so one tick can't try to process an unbounded
// number of campaigns at once.
async function findDueCampaigns(now, batchSize = 50) {
  return Campaign.find({
    "schedule.status": "scheduled",
    "schedule.effectivePublishAt": { $lte: now }
  })
    .select(SCHEDULE_FIELDS)
    .sort({ "schedule.effectivePublishAt": 1 })
    .limit(batchSize);
}

// Atomic claim: only succeeds if the campaign is still "scheduled" at the
// moment of the update. If two scheduler ticks (or two server instances
// running the same cron) race for the same campaign, only one of these
// findOneAndUpdate calls can match — Mongo resolves the race, not
// application code. This is what makes duplicate publishing impossible
// even when the process restarts mid-tick or runs on multiple instances.
async function claimForPublishing(campaignId) {
  return Campaign.findOneAndUpdate(
    { _id: campaignId, "schedule.status": "scheduled" },
    {
      $set: { "schedule.status": "publishing", "schedule.lastAttemptAt": new Date() },
      $inc: { "schedule.attempts": 1 }
    },
    { new: true }
  ).select(SCHEDULE_FIELDS);
}

// Successful publish: flip the campaign live (isActive/status — the same
// two fields getScripts and the Campaigns dashboard already key off of)
// and close out the schedule.
async function markPublished(campaignId) {
  const now = new Date();
  return Campaign.findByIdAndUpdate(
    campaignId,
    {
      $set: {
        isActive: true,
        status: "published",
        "schedule.status": "published",
        "schedule.publishedAt": now,
        "schedule.lastError": null,
        "schedule.lastAttemptAt": now
      }
    },
    { new: true }
  ).select(SCHEDULE_FIELDS);
}

// Failed attempt: if attempts remain, drop back to "scheduled" so the next
// tick retries; otherwise mark "failed" (terminal — the scheduler will
// never pick this campaign up again until the user reschedules it).
async function markAttemptResult(campaignId, { errorMessage, attempts, maxAttempts }) {
  const exhausted = attempts >= maxAttempts;
  return Campaign.findByIdAndUpdate(
    campaignId,
    {
      $set: {
        "schedule.status": exhausted ? "failed" : "scheduled",
        "schedule.lastError": errorMessage
      }
    },
    { new: true }
  ).select(SCHEDULE_FIELDS);
}

async function createLog(logData) {
  return SchedulerLog.create(logData);
}

// Window-mode campaigns currently live whose end time has passed. Mirrors
// findDueCampaigns above: same batch cap and oldest-expired-first order, so
// one tick can't try to stop an unbounded number of campaigns at once.
async function findCampaignsToStop(now, batchSize = 50) {
    return Campaign.find({
        isActive: true,
        "schedule.endAt": {$ne: null, $lte: now },
        "schedule.status": "published"
    })
        .select(SCHEDULE_FIELDS)
        .sort({ "schedule.endAt": 1 })
        .limit(batchSize);
}

// Atomic stop: only succeeds if the campaign is still live and "published"
// at the moment of the update — same pattern as claimForPublishing above,
// so a campaign being cancelled/rescheduled by the user at the exact
// instant its window closes can't race with the scheduler stopping it out
// from under that action (or be double-completed by two ticks/instances).
async function markCompleted(campaignId) {
    return Campaign.findOneAndUpdate(
        { _id: campaignId, isActive: true, "schedule.status": "published" },
        {
            $set: {
                isActive: false,
                status: "completed",
                "schedule.status": "completed",
                "schedule.completedAt": new Date()
            }
        },
        { new: true }
    ).select(SCHEDULE_FIELDS);
}

module.exports = {
  findCampaignForOwner,
  findCampaignById,
  saveSchedule,
  cancelSchedule,
  getSchedule,
  listScheduled,
  findDueCampaigns,
  claimForPublishing,
  markPublished,
  markAttemptResult,
  createLog,
  findCampaignsToStop,
  markCompleted
};
