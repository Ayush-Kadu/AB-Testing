// ============================================================================
// SchedulerLog — one row per scheduler execution attempt against a campaign.
// Written on every tick that touches a campaign (successful publish, failed
// attempt, final failure after exhausting retries, and cancellations), so
// there's a full audit trail independent of the campaign document itself
// (which only holds the *current* schedule state, not its history).
//
// TTL index auto-expires logs after 90 days so this collection stays
// bounded regardless of campaign volume — adjust `expireAfterSeconds`
// below if you need a longer retention window for compliance/debugging.
// ============================================================================
const mongoose = require("mongoose");

const schedulerLogSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "usercampaign",
      required: true
    },
    // Denormalized so logs can be queried/filtered without a populate.
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    action: {
      type: String,
      enum: ["publish_attempt", "publish_success", "publish_failed", "publish_exhausted", "cancelled", "startup_catchup"],
      required: true
    },
    status: {
      type: String,
      enum: ["success", "failure", "info"],
      required: true
    },
    attempt: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 3
    },
    error: {
      type: String,
      default: null
    },
    message: {
      type: String,
      default: null
    },
    // How long the publish attempt itself took, in ms — useful for
    // spotting a slow downstream step (e.g. DB latency) separate from
    // scheduler tick cadence.
    durationMs: {
      type: Number,
      default: null
    },
    executedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Fetch a campaign's schedule history, newest first.
schedulerLogSchema.index({ campaignId: 1, executedAt: -1 });

// Auto-expire after 90 days.
schedulerLogSchema.index({ executedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model("SchedulerLog", schedulerLogSchema);
