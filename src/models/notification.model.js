const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    /**
     * Owner of the notification
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /**
     * Related campaign (optional)
     */
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Usercampaign",
      default: null,
    },

    /**
     * Notification Title
     * Example:
     * "Campaign Reminder"
     */
    title: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Notification Body
     * Example:
     * "Summer Sale starts in 5 minutes."
     */
    message: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * Notification Type
     */
    type: {
      type: String,
      enum: [
        "campaign_reminder",
        "campaign_started",
        "campaign_completed",
        "campaign_failed",
        "system",
      ],
      default: "campaign_reminder",
    },

    /**
     * Browser Push sent?
     */
    pushSent: {
      type: Boolean,
      default: false,
    },

    /**
     * In-App notification read?
     */
    isRead: {
      type: Boolean,
      default: false,
    },

    /**
     * Delivery Channels
     */
    channels: {
      browser: {
        type: Boolean,
        default: true,
      },

      inApp: {
        type: Boolean,
        default: true,
      },
    },

    /**
     * Extra metadata
     */
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);