const mongoose = require('mongoose');

const VisitorDataSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    data: {
      type: mongoose.Schema.Types.Mixed, // Corrected Mixed type
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: false, // Allows any additional fields dynamically
  }
);

module.exports = mongoose.model("visitors-data", VisitorDataSchema);
