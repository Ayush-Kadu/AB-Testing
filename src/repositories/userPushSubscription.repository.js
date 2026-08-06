const UserPushSubscription = require("../models/userPushSubscription.model");

/**
 * Create or update a user's browser subscription.
 * A user can have multiple subscriptions (Chrome, Edge, Firefox, etc.).
 */
async function saveSubscription({
  userId,
  endpoint,
  keys,
  device,
}) {
  return await UserPushSubscription.findOneAndUpdate(
    {
      endpoint,
    },
    {
      userId,
      endpoint,
      keys,
      device,
      isActive: true,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
}

/**
 * Get all active browser subscriptions for a user.
 */
async function getUserSubscriptions(userId) {
  return await UserPushSubscription.find({
    userId,
    isActive: true,
  }).lean();
}

/**
 * Deactivate a subscription.
 * Used if browser unsubscribes or push fails permanently.
 */
async function deactivateSubscription(endpoint) {
  return await UserPushSubscription.findOneAndUpdate(
    {
      endpoint,
    },
    {
      $set: {
        isActive: false,
      },
    },
    {
      new: true,
    }
  );
}

/**
 * Update the timestamp after a successful push.
 */
async function updateLastUsed(endpoint) {
  return await UserPushSubscription.findOneAndUpdate(
    {
      endpoint,
    },
    {
      $set: {
        lastUsedAt: new Date(),
      },
    },
    {
      new: true,
    }
  );
}

/**
 * Delete a subscription completely.
 * Rarely used, but useful for cleanup.
 */
async function deleteSubscription(endpoint) {
  return await UserPushSubscription.findOneAndDelete({
    endpoint,
  });
}

module.exports = {
  saveSubscription,
  getUserSubscriptions,
  deactivateSubscription,
  updateLastUsed,
  deleteSubscription,
};
