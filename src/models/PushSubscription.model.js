const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  websiteId: { type: mongoose.Schema.Types.ObjectId, ref: "User.websites", required: true },
  visitorId: { type: String, required: true }, // visitorId from cookie
  domain: { type: String, required: true },    // store domain for multi-website support
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update `updatedAt` on every save
pushSubscriptionSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
