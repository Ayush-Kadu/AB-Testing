const notificationRepository = require("../repositories/notification.repository");

/**
 * Create a campaign reminder notification.
 *
 * Called by the scheduler 5 minutes before
 * a campaign is scheduled to go live.
 */
function formatTimeRemaining(startAt) {
  const now = new Date();
  const diffMs = new Date(startAt) - now;

  if (diffMs <= 0) {
    return "less than a minute";
  }

  const totalMinutes = Math.ceil(diffMs / (1000 * 60));

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

async function sendCampaignReminder(campaign) {
    
    const timeRemaining = formatTimeRemaining(campaign.schedule.startAt);
    const scheduledTime = new Date(
        campaign.schedule.startAt
    ).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
  const notification = await notificationRepository.createNotification({
    userId: campaign.clientId,
    campaignId: campaign._id,

    title: "Campaign Starting Soon",

    message: `"${campaign.campaigndesignerName}"  starts in ${timeRemaining}.\nScheduled: ${scheduledTime}`,

    type: "campaign_reminder",

    channels: {
      browser: true,
      inApp: true,
    },

    metadata: {
      campaignName: campaign.campaigndesignerName,
      scheduledStart: campaign.schedule?.startAt,
    },
  });

  return notification;
}

/**
 * Get all notifications for a user.
 */
async function getNotifications(userId) {
  return await notificationRepository.getUserNotifications(userId);
}

/**
 * Get unread notification count.
 */
async function getUnreadCount(userId) {
  return await notificationRepository.getUnreadCount(userId);
}

/**
 * Mark one notification as read.
 */
async function markAsRead(notificationId, userId) {
  return await notificationRepository.markAsRead(
    notificationId,
    userId
  );
}

/**
 * Mark all notifications as read.
 */
async function markAllAsRead(userId) {
  return await notificationRepository.markAllAsRead(userId);
}

module.exports = {
  sendCampaignReminder,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};