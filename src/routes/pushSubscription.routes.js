const express = require("express");
const auth = require("../middlewares/authMiddleware");

const router = express.Router();

const {
  subscribe,
  unsubscribe,
} = require("../controllers/pushSubscription.controller");

/**
 * Register the current browser
 */
router.post("/subscribe", auth, subscribe);

/**
 * Remove browser subscription
 */
router.post("/unsubscribe", auth, unsubscribe);

module.exports = router;