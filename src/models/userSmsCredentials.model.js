const mongoose = require("mongoose");

const smsCredentialSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    platform: {
      type: String,
      enum: ["twilio", "msg91", "custom"], // supported SMS platforms
      required: true,
    },
    credentials: {
      type: Object,
      required: true, // dynamic object containing API key, SID, tokens, etc.
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

module.exports = mongoose.model("userSmsCredentials", smsCredentialSchema);
