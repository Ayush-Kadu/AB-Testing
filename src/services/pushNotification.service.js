const webPush = require("web-push");

const notificationRepository = require("../repositories/notification.repository");
const subscriptionRepository = require("../repositories/userPushSubscription.repository");

// VAPID details are passed per-call to sendNotification() below instead of
// via the module-level webPush.setVapidDetails() — that call sets shared,
// process-wide state in the web-push package itself, and authController.js
// (the separate visitor-broadcast push feature) also calls it with a
// different key pair. Whichever call happens to run last at require-time
// wins for the entire process, silently breaking whichever feature didn't
// "win" (signing pushes with the wrong private key produces a 403 from the
// push service). Passing vapidDetails explicitly here keeps this feature's
// keys scoped to its own calls, regardless of what authController.js does.
const vapidDetails = {
  subject: process.env.VAPID_SUBJECT,
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

/**
 * Send browser push notification to every active browser
 * belonging to the user.
 */
async function sendBrowserPush(notification) {

  console.log("========== PUSH ==========");
  console.log("Notification user:", notification.userId);

  const subscriptions =
    await subscriptionRepository.getUserSubscriptions(
      notification.userId
    );

  console.log("Subscriptions found:", subscriptions.length);

  if (!subscriptions.length) {
    return;
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.message,

    campaignId: notification.campaignId,

    type: notification.type,

    createdAt: notification.createdAt,
  });

  for (const subscription of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        payload,
        { vapidDetails }
      );

      await subscriptionRepository.updateLastUsed(
        subscription.endpoint
      );
    } catch (error) {
      console.error(
        "Push notification failed:",
        error.statusCode,
        error.message
      );

      /**
       * Browser subscription expired
       */

      if (
        error.statusCode === 404 ||
        error.statusCode === 410
      ) {
        await subscriptionRepository.deactivateSubscription(
          subscription.endpoint
        );
      }
    }
  }

  await notificationRepository.markPushSent(
    notification._id
  );
}

/**
 * Send all pending browser push notifications.
 *
 * This is useful when the scheduler creates multiple
 * notifications in one tick.
 */
async function processPendingBrowserPushNotifications() {
  const pending =
    await notificationRepository.getPendingBrowserPushNotifications();

  for (const notification of pending) {
  try {
    await sendBrowserPush(notification);
  } catch (error) {
    console.error(
      "Failed to process browser push notification:",
      notification._id,
      error
    );
  }
}
}

module.exports = {
  sendBrowserPush,
  processPendingBrowserPushNotifications,
};