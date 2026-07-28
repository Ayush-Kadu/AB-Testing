// ============================================================================
// Background scheduler — the process that actually makes scheduled
// campaigns go live. Runs as a node-cron job inside the same process as
// the API server (no separate worker deployment needed to get started).
//
// Duplicate-publish safety: even though this ticks every minute and could
// in principle run on more than one server instance (horizontal scaling),
// it can never publish the same campaign twice. Each tick calls
// publishDueCampaign(), which does an atomic Mongo findOneAndUpdate
// (repo.claimForPublishing) that only succeeds for exactly one caller per
// campaign — a second instance racing for the same campaign simply gets
// null back and moves on. No distributed lock service required.
//
// Startup catch-up: on boot, this runs one pass immediately (before the
// first cron tick) so campaigns whose publish time already passed while
// the server was down (deploy, crash, restart) go out right away instead
// of waiting up to a minute — or, if the process had been down for the
// full window, would otherwise be picked up late anyway on the first tick.
// The immediate pass just makes that recovery instant instead of
// depending on tick timing.
// ============================================================================
const cron = require("node-cron");
const repo = require("../repositories/campaignSchedule.repository");
const scheduleService = require("../services/campaignSchedule.service");

const DEFAULT_CRON_EXPRESSION = "* * * * *"; // every minute
const BATCH_SIZE = 50;

async function runDueCampaigns({ isStartupCatchup = false } = {}) {
  const now = new Date();
  const due = await repo.findDueCampaigns(now, BATCH_SIZE);

  if (!due.length) {
    return { processed: 0, total: 0 };
  }

  console.log(
    `[scheduler] ${isStartupCatchup ? "Startup catch-up" : "Tick"}: ${due.length} campaign(s) due for publishing.`
  );

  if (isStartupCatchup) {
    // Fire-and-forget audit marker — doesn't block publishing, just gives
    // scheduler logs a clear "this went out late because of a restart"
    // signal, separate from a normal on-time publish.
    Promise.all(
      due.map((c) =>
        repo.createLog({
          campaignId: c._id,
          clientId: c.clientId,
          action: "startup_catchup",
          status: "info",
          message: "Picked up by startup catch-up sweep after a server restart."
        })
      )
    ).catch((err) => console.error("[scheduler] Failed to write startup catch-up log:", err.message));
  }

  const results = await Promise.allSettled(due.map((campaign) => scheduleService.publishDueCampaign(campaign)));

  const processed = results.filter((r) => r.status === "fulfilled").length;
  const errored = results.filter((r) => r.status === "rejected");
  if (errored.length) {
    errored.forEach((r) => console.error("[scheduler] Unexpected error processing a due campaign:", r.reason));
  }

  return { processed, total: due.length };
}

let cronTask = null;

function startScheduler({ cronExpression = DEFAULT_CRON_EXPRESSION } = {}) {
  if (cronTask) {
    console.warn("[scheduler] startScheduler() called more than once — ignoring duplicate start.");
    return cronTask;
  }

  // Immediate catch-up sweep before the first tick.
  runDueCampaigns({ isStartupCatchup: true }).catch((err) =>
    console.error("[scheduler] Startup catch-up sweep failed:", err.message)
  );

  cronTask = cron.schedule(cronExpression, () => {
    runDueCampaigns().catch((err) => console.error("[scheduler] Tick failed:", err.message));
  });

  console.log(`[scheduler] Campaign scheduler started (cron: "${cronExpression}").`);
  return cronTask;
}

function stopScheduler() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log("[scheduler] Campaign scheduler stopped.");
  }
}

module.exports = { startScheduler, stopScheduler, runDueCampaigns };
