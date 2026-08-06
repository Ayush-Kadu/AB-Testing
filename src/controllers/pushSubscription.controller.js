const subscriptionRepository = require("../repositories/userPushSubscription.repository");

/**
 * Register or update a browser push subscription
 *
 * Called after the dashboard user allows
 * browser notifications.
 */
async function subscribe(req, res) {
  try {
    const userId = req.user._id;

    const {
      endpoint,
      keys,
      device,
    } = req.body;

    if (!endpoint || !keys) {
      return res.status(400).json({
        success: false,
        message: "Invalid push subscription.",
      });
    }

    const subscription =
      await subscriptionRepository.saveSubscription({
        userId,
        endpoint,
        keys,
        device,
      });

    return res.status(200).json({
      success: true,
      message: "Browser subscribed successfully.",
      data: subscription,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to save push subscription.",
    });
  }
}

/**
 * Remove browser subscription
 *
 * Called when the browser unsubscribes
 * or the user disables notifications.
 */
async function unsubscribe(req, res) {
  try {

    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: "Endpoint is required.",
      });
    }

    await subscriptionRepository.deactivateSubscription(
      endpoint
    );

    return res.status(200).json({
      success: true,
      message: "Subscription removed.",
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to remove subscription.",
    });
  }
}

module.exports = {
  subscribe,
  unsubscribe,
};