const mongoose = require("mongoose");

const userPushSubscriptionSchema = new mongoose.Schema(
  {
    /**
     * Logged-in dashboard user
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * Browser Push endpoint
     */
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },

    /**
     * Browser encryption keys
     */
    keys: {
      p256dh: {
        type: String,
        required: true,
      },
      auth: {
        type: String,
        required: true,
      },
    },

    /**
     * Device information
     */
    device: {
      browser: {
        type: String,
        default: "",
      },
      os: {
        type: String,
        default: "",
      },
      platform: {
        type: String,
        default: "",
      },
    },

    /**
     * Whether this browser is still subscribed
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Last successful notification sent
     */
    lastUsedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "UserPushSubscription",
  userPushSubscriptionSchema
);