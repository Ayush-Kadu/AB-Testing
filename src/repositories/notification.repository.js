const Notification = require("../models/notification.model");

/**
 * Create a notification
 */
async function createNotification(notificationData) {
  return await Notification.create(notificationData);
}

/**
 * Get notifications for a user
 */
async function getUserNotifications(userId, limit = 20) {
  return await Notification.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId) {
  return await Notification.countDocuments({
    userId,
    isRead: false,
  });
}

/**
 * Mark a notification as read
 */
async function markAsRead(notificationId, userId) {
  return await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      userId,
    },
    {
      $set: {
        isRead: true,
      },
    },
    {
      new: true,
    }
  );
}

/**
 * Mark all notifications as read
 */
async function markAllAsRead(userId) {
  return await Notification.updateMany(
    {
      userId,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
      },
    }
  );
}

/**
 * Find unsent browser push notifications
 */
async function getPendingBrowserPushNotifications() {
  return await Notification.find({
    pushSent: false,
    "channels.browser": true,
  }).lean();
}

/**
 * Mark browser push as sent
 */
async function markPushSent(notificationId) {
  return await Notification.findByIdAndUpdate(
    notificationId,
    {
      $set: {
        pushSent: true,
      },
    },
    {
      new: true,
    }
  );
}

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getPendingBrowserPushNotifications,
  markPushSent,
};
