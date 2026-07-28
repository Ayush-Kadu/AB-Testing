// ============================================================================
// Controller layer — thin HTTP adapters over campaignSchedule.service.js.
// No business logic here: parse the request, call the service, map the
// result (or a thrown ScheduleError) to an HTTP response.
// ============================================================================
const scheduleService = require("../services/campaignSchedule.service");
const { ScheduleError } = scheduleService;

function handleError(res, error) {
  if (error instanceof ScheduleError) {
    return res.status(error.statusCode).json({ success: false, message: error.message, details: error.details });
  }
  console.error("[campaignSchedule.controller]", error);
  return res.status(500).json({ success: false, message: error.message || "Internal server error." });
}

// POST /api/v2/campaign-schedule/:campaignId
// Body: { mode: "exact"|"window", timezone, startDate, startTime, endDate?, endTime? }
exports.scheduleCampaign = async (req, res) => {
  try {
    const campaign = await scheduleService.scheduleCampaign({
      campaignId: req.params.campaignId,
      clientId: req.user._id,
      scheduledBy: req.user._id,
      ...req.body
    });
    return res.status(201).json({
      success: true,
      message: "Campaign scheduled successfully.",
      data: campaign
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// PUT /api/v2/campaign-schedule/:campaignId
// Same body shape as schedule — replaces the existing schedule.
exports.updateSchedule = async (req, res) => {
  try {
    const campaign = await scheduleService.updateSchedule({
      campaignId: req.params.campaignId,
      clientId: req.user._id,
      ...req.body
    });
    return res.status(200).json({
      success: true,
      message: "Schedule updated successfully.",
      data: campaign
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// POST /api/v2/campaign-schedule/:campaignId/cancel
exports.cancelSchedule = async (req, res) => {
  try {
    const campaign = await scheduleService.cancelSchedule({
      campaignId: req.params.campaignId,
      clientId: req.user._id
    });
    return res.status(200).json({
      success: true,
      message: "Schedule cancelled.",
      data: campaign
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/v2/campaign-schedule/:campaignId
exports.getSchedule = async (req, res) => {
  try {
    const campaign = await scheduleService.getSchedule({
      campaignId: req.params.campaignId,
      clientId: req.user._id
    });
    return res.status(200).json({
      success: true,
      data: { campaignId: campaign._id, campaignName: campaign.campaigndesignerName, schedule: campaign.schedule }
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// GET /api/v2/campaign-schedule?status=scheduled&page=1&limit=20
exports.listScheduled = async (req, res) => {
  try {
    const result = await scheduleService.listScheduled({
      clientId: req.user._id,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
};
