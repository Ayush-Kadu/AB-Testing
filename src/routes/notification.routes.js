const express = require("express");
const auth = require("../middlewares/authMiddleware");

const router = express.Router();

const {
  list,
  unreadCount,
  markAsRead,
  markAllAsRead,
} = require("../controllers/notification.controller");

/**
 * Get all notifications for the logged-in user
 */
router.get("/", auth, list);

/**
 * Get unread notification count
 */
router.get("/unread-count", auth, unreadCount);

/**
 * Mark all notifications as read
 */
router.patch("/read-all", auth, markAllAsRead);

/**
 * Mark one notification as read
 */
router.patch("/:notificationId/read", auth, markAsRead);

module.exports = router;
