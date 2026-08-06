const notificationService = require("../services/notification.service");

/**
 * Get all notifications for the logged-in user
 */
async function list(req, res) {
  try {
    const userId = req.user._id;

    const notifications = await notificationService.getNotifications(userId);

    return res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch notifications.",
    });
  }
}

/**
 * Get unread notification count for the logged-in user
 */
async function unreadCount(req, res) {
  try {
    const userId = req.user._id;

    const count = await notificationService.getUnreadCount(userId);

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch unread count.",
    });
  }
}

/**
 * Mark one notification as read
 */
async function markAsRead(req, res) {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await notificationService.markAsRead(notificationId, userId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to mark notification as read.",
    });
  }
}

/**
 * Mark all notifications as read for the logged-in user
 */
async function markAllAsRead(req, res) {
  try {
    const userId = req.user._id;

    await notificationService.markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to mark notifications as read.",
    });
  }
}

module.exports = {
  list,
  unreadCount,
  markAsRead,
  markAllAsRead,
};
