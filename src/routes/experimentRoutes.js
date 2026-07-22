const express = require("express");
const auth = require("../middlewares/authMiddleware");

const router = express.Router();

const {
    createExperiment,
    getExperiments,
    updateExperiment,
    deleteExperiment,
    getExperimentAnalytics,
    getAiInsight
} = require("../controllers/experimentControllers");

router.get("/", auth, getExperiments);
router.post("/create", auth, createExperiment);
router.get("/:id/analytics", auth, getExperimentAnalytics);
router.post("/:id/ai-insight", auth, getAiInsight);
router.put("/:id", auth, updateExperiment);
router.delete("/:id", auth, deleteExperiment);

module.exports = router;
