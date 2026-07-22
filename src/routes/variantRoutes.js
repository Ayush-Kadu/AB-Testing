const express = require("express");
const auth = require("../middlewares/authMiddleware");
const router = express.Router();

const {
    createVariant,
    getVariantsByExperiment,
    updateVariant,
    publishVariant,
    deleteVariant,
    trackEvent
} = require("../controllers/variantControllers");

// PUBLIC — called from anonymous visitors' browsers via the tracking loader
// (see getScripts in scriptControllers.js). Must stay unauthenticated and
// must be declared before any `/:id`-shaped route so it isn't shadowed.
router.post("/track", trackEvent);

router.get("/", auth, getVariantsByExperiment);
router.post("/create", auth, createVariant);
router.put("/:id/publish", auth, publishVariant);
router.put("/:id", auth, updateVariant);
router.delete("/:id", auth, deleteVariant);

module.exports = router;
