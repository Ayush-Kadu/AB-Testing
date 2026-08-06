// ============================================================================
// Service layer — all business logic and validation for campaign
// scheduling lives here. Controllers stay thin (parse request, call a
// service function, format the response); the repository stays dumb
// (pure Mongo access, no rules). This is also what the background
// scheduler calls into for the actual publish step, so the API and the
// cron job are guaranteed to run the exact same logic.
// ============================================================================
const moment = require("moment-timezone");
const repo = require("../repositories/campaignSchedule.repository");

const IN_FLIGHT_STATUSES = ["scheduled", "publishing"];

const MAX_RETRY = Number(process.env.SCHEDULER_MAX_RETRY || 3);

class ScheduleError extends Error {
  constructor(message, statusCode = 400, details = null) {
    super(message);
    this.name = "ScheduleError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function toUtcDate(dateStr, timeStr, timezone) {
  if (!dateStr || !timeStr) return null;
  const m = moment.tz(`${dateStr} ${timeStr}`, "YYYY-MM-DD HH:mm", true, timezone);
  return m.isValid() ? m.utc().toDate() : null;
}

function isValidTimezone(timezone) {
  return Boolean(timezone) && Boolean(moment.tz.zone(timezone));
}

// Shared validation + UTC conversion for both scheduleCampaign() and
// updateSchedule() — a fresh schedule and a rescheduled one go through
// exactly the same rules.
function buildScheduleFromInput({ mode, timezone, startDate, startTime, endDate, endTime, repeat, excludeweekends, priority }, { now = new Date() } = {}) {
  if (!["exact", "window"].includes(mode)) {
    throw new ScheduleError("mode must be 'exact' or 'window'.", 400);
  }
  if (!isValidTimezone(timezone)) {
    throw new ScheduleError(`'${timezone}' is not a recognized timezone.`, 400);
  }

  const startAt = toUtcDate(startDate, startTime, timezone);
  if (!startAt) {
    throw new ScheduleError("startDate/startTime is invalid or missing.", 400);
  }
  if (startAt.getTime() <= now.getTime()) {
    throw new ScheduleError("Start date/time must be in the future.", 400);
  }

  let endAt = null;
  if (mode === "window") {
    endAt = toUtcDate(endDate, endTime, timezone);
    if (!endAt) {
      throw new ScheduleError("endDate/endTime is invalid or missing for a window schedule.", 400);
    }
    if (endAt.getTime() <= startAt.getTime()) {
      throw new ScheduleError("Window end must be after window start.", 400);
    }
  }

  // "Publish at the start of the window" — the one line that changes when
  // an AI publish-time optimizer replaces this. Everything downstream
  // (the scheduler's query, the claim/publish logic) only ever reads
  // effectivePublishAt, so that swap is fully isolated to this function.
  const effectivePublishAt = startAt;

  return { mode, timezone, startAt, endAt, effectivePublishAt, repeat, excludeWeekends: excludeweekends, priority };
}

async function assertOwnedCampaign(campaignId, clientId) {
  const campaign = await repo.findCampaignForOwner(campaignId, clientId);
  if (!campaign) {
    throw new ScheduleError("Campaign not found.", 404);
  }
  return campaign;
}

async function scheduleCampaign({ campaignId, clientId, scheduledBy,notifyBeforeStart = false, ...input }) {
  const campaign = await assertOwnedCampaign(campaignId, clientId);

  const existingStatus = campaign.schedule?.status || "unscheduled";
  if (IN_FLIGHT_STATUSES.includes(existingStatus)) {
    throw new ScheduleError(
      `Campaign already has an active schedule (${existingStatus}). Use "update schedule" or cancel it first.`,
      409
    );
  }
  if (campaign.isActive && campaign.status === "published" && existingStatus !== "failed" && existingStatus !== "cancelled") {
    throw new ScheduleError("Campaign is already published/live. Nothing to schedule.", 409);
  }

  const built = buildScheduleFromInput(input);

  const schedule = {
    ...built,
    status: "scheduled",
    attempts: 0,
    maxAttempts: MAX_RETRY,
    lastError: null,
    lastAttemptAt: null,
    publishedAt: null,
    cancelledAt: null,
    scheduledBy: scheduledBy || null,
    scheduledAt: new Date(),
    notifyBeforeStart: notifyBeforeStart || false,
    notificationSent: false,
  };

  return repo.saveSchedule(campaignId, schedule);
}

async function updateSchedule({ campaignId, clientId, ...input }) {
  const campaign = await assertOwnedCampaign(campaignId, clientId);

  const existingStatus = campaign.schedule?.status || "unscheduled";
  if (existingStatus === "publishing") {
    throw new ScheduleError("Campaign is currently being published by the scheduler — try again in a moment.", 409);
  }

  const built = buildScheduleFromInput(input);

  const schedule = {
    ...built,
    status: "scheduled",
    attempts: 0,
    maxAttempts: campaign.schedule?.maxAttempts || MAX_RETRY,
    lastError: null,
    lastAttemptAt: null,
    publishedAt: null,
    cancelledAt: null,
    scheduledBy: campaign.schedule?.scheduledBy || null,
    scheduledAt: new Date(),
    notifyBeforeStart: input.notifyBeforeStart ?? false,
    notificationSent: false,
  };

  return repo.saveSchedule(campaignId, schedule);
}

async function cancelSchedule({ campaignId, clientId }) {
  const campaign = await assertOwnedCampaign(campaignId, clientId);

  const existingStatus = campaign.schedule?.status || "unscheduled";
  if (!IN_FLIGHT_STATUSES.includes(existingStatus)) {
    throw new ScheduleError(
      `Only a 'scheduled' or 'publishing' schedule can be cancelled (current status: ${existingStatus}).`,
      409
    );
  }

  return repo.cancelSchedule(campaignId);
}

async function getSchedule({ campaignId, clientId }) {
  const campaign = await repo.getSchedule(campaignId, clientId);
  if (!campaign) {
    throw new ScheduleError("Campaign not found.", 404);
  }
  return campaign;
}

async function listScheduled({ clientId, status, page, limit }) {
  return repo.listScheduled({ clientId, status, page: Number(page) || 1, limit: Number(limit) || 20 });
}

// ── Used by the background scheduler only (see src/scheduler) ──────────────

// Attempts to publish one due campaign. Returns a result object rather
// than throwing on a normal publish failure — the scheduler needs to keep
// moving through its batch even if one campaign's publish step fails.
async function publishDueCampaign(campaign) {
  const claimed = await repo.claimForPublishing(campaign._id);
  if (!claimed) {
    // Another tick/instance already claimed this one between the find and
    // now — not an error, just a race we lost harmlessly.
    return { campaignId: campaign._id, outcome: "already_claimed" };
  }

  const attempt = claimed.schedule.attempts;
  const maxAttempts = claimed.schedule.maxAttempts || 3;
  const startedAt = Date.now();

  try {
    // The actual "publish" step. Kept trivial and synchronous today
    // (flip isActive/status) but isolated here so a future version that
    // e.g. calls out to a CDN cache-purge or a webhook can throw and be
    // retried exactly like any other failure below.
    await repo.markPublished(claimed._id);

    await repo.createLog({
      campaignId: claimed._id,
      clientId: claimed.clientId,
      action: "publish_success",
      status: "success",
      attempt,
      maxAttempts,
      durationMs: Date.now() - startedAt
    });

    return { campaignId: claimed._id, outcome: "published" };
  } catch (err) {
    const exhausted = attempt >= maxAttempts;
    await repo.markAttemptResult(claimed._id, {
      errorMessage: err.message,
      attempts: attempt,
      maxAttempts
    });

    await repo.createLog({
      campaignId: claimed._id,
      clientId: claimed.clientId,
      action: exhausted ? "publish_exhausted" : "publish_failed",
      status: "failure",
      attempt,
      maxAttempts,
      error: err.message,
      durationMs: Date.now() - startedAt
    });

    return { campaignId: claimed._id, outcome: exhausted ? "failed" : "retry_scheduled", error: err.message };
  }
}

// Automatically stops (deactivates) campaigns whose scheduled end time has passed.
async function stopExpiredCampaign(campaign) {

  const startedAt = Date.now();

  try {

    // Skip if already inactive
    if (!campaign.isActive) {
      return {
        campaignId: campaign._id,
        outcome: "already_inactive"
      };
    }

    // Mark campaign as completed. This only succeeds if the campaign is
    // still isActive + "published" at the moment of the update — if
    // another tick already completed it, or the user cancelled/deactivated
    // it in the same instant, this comes back null and there's nothing
    // more to do (not an error, just a race we lost harmlessly).
    const completed = await repo.markCompleted(campaign._id);
    if (!completed) {
      return {
        campaignId: campaign._id,
        outcome: "already_completed"
      };
    }

    // Audit log
    await repo.createLog({
      campaignId: campaign._id,
      clientId: campaign.clientId,
      action: "campaign_completed",
      status: "success",
      durationMs: Date.now() - startedAt
    });

    return {
      campaignId: campaign._id,
      outcome: "completed"
    };

  } catch (err) {

    await repo.createLog({
      campaignId: campaign._id,
      clientId: campaign.clientId,
      action: "campaign_completion_failed",
      status: "failure",
      error: err.message,
      durationMs: Date.now() - startedAt
    });

    return {
      campaignId: campaign._id,
      outcome: "failed",
      error: err.message
    };

  }
}

// Sunday=0 .. Saturday=6, evaluated in the campaign's own configured
// timezone — a campaign scheduled for "Asia/Kolkata" is judged against
// India's calendar day, not the server's.
function isWeekendInZone(date, timezone) {
  const dow = moment.tz(date, timezone || "UTC").day();
  return dow === 0 || dow === 6;
}

// Runs every tick, independent of publish/stop. For every still-"published"
// campaign with Exclude Weekends on: pause it if it's currently live and
// today is a Saturday/Sunday in its own timezone, or resume it if today is
// a weekday and *we're* the one who paused it (see pauseForWeekend /
// resumeFromWeekend in the repository for the race-safety and the
// weekendPaused marker that keeps this from ever reactivating a campaign
// the user deactivated on purpose).
async function enforceWeekendExclusion(now = new Date()) {
  const candidates = await repo.findCampaignsWithWeekendExclusion();
  const results = [];

  for (const campaign of candidates) {
    const weekend = isWeekendInZone(now, campaign.schedule.timezone);

    if (weekend && campaign.isActive) {
      const paused = await repo.pauseForWeekend(campaign._id);
      if (!paused) continue; // lost a race — another tick/instance got it first
      await repo.createLog({
        campaignId: campaign._id,
        clientId: campaign.clientId,
        action: "weekend_paused",
        status: "info",
        message: "Paused for the weekend (Exclude Weekends is on)."
      });
      results.push({ campaignId: campaign._id, outcome: "paused_for_weekend" });
    } else if (!weekend && !campaign.isActive && campaign.schedule.weekendPaused) {
      const resumed = await repo.resumeFromWeekend(campaign._id);
      if (!resumed) continue;
      await repo.createLog({
        campaignId: campaign._id,
        clientId: campaign.clientId,
        action: "weekend_resumed",
        status: "info",
        message: "Resumed after the weekend."
      });
      results.push({ campaignId: campaign._id, outcome: "resumed_from_weekend" });
    }
  }

  return results;
}

module.exports = {
  ScheduleError,
  scheduleCampaign,
  updateSchedule,
  cancelSchedule,
  getSchedule,
  listScheduled,
  publishDueCampaign,
  stopExpiredCampaign,
  enforceWeekendExclusion
};
