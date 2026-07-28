const express = require("express");
const auth = require("../middlewares/authMiddleware");

const router = express.Router();

const {
  scheduleCampaign,
  updateSchedule,
  cancelSchedule,
  getSchedule,
  listScheduled
} = require("../controllers/campaignSchedule.controller");

// List first so "/" doesn't get swallowed by "/:campaignId".
router.get("/", auth, listScheduled);
router.post("/:campaignId", auth, scheduleCampaign);
router.put("/:campaignId", auth, updateSchedule);
router.post("/:campaignId/cancel", auth, cancelSchedule);
router.get("/:campaignId", auth, getSchedule);

module.exports = router;
