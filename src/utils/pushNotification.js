const webpush = require('web-push');

// VAPID keys – use your own keys
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT, // contact email
  process.env.VAPID_PUBLIC_KEY, // public key
  process.env.VAPID_PRIVATE_KEY // private key
);

// Send notification to a single subscription
async function sendNotification(subscription, payload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (error) {
    console.error('Push notification failed', error);
  }
}

module.exports = {
  sendNotification
};
