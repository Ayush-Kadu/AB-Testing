const mongoose = require("mongoose");

const emailCredentialSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    platform: {
      type: String,
      enum: ["sendGrid", "custom"],
      required: true,
    },
    credentials: {
      type: Object,
      required: true,
    },
    active: {
      type: Boolean,
      default: true, // active by default
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("userMailCredentials", emailCredentialSchema);
