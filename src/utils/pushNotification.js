const webpush = require('web-push');

// VAPID keys – use your own keys
webpush.setVapidDetails(
  'mailto:sanjiv.ranjan@technians.com',
  'BJ0wd3yMehxh_RjMa0UJ1HHGS4_bsViADz5ryOb9R7GKQ95970GuI_pcVy8oXAkrR3J7PnTDR8_R7ww99ON4lCc', // public key
  'N_R45fdgODawxysrRJrAF0dRTI40zEHgJGJC-IAhAss'  // private key
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
