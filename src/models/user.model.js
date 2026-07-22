const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    websites: [
      {
        website: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
        isActive: { type: Boolean, default: true },

        // ✅ Push Notification Settings
        pushEnabled: { type: Boolean, default: false },
        pushMessage: {
          type: String,
          default: "Subscribe for latest updates"
        }
      }
    ],

    email: { type: String, required: true, unique: true },
    mobileNumber: { type: String },

    // ✅ Password is optional now
    password: {
      type: String,
      required: function () {
        return this.authProvider === "form";
      }
    },

    // ✅ New field
    authProvider: { type: String, enum: ['form', 'google', 'form+google', 'microsoft', 'form+microsoft', 'google+microsoft'], default: 'form' },
    googleId: { type: String },
    microsoftId: { type: String },



    address1: { type: String },
    address2: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    pinCode: { type: Number },

    role: {
      type: String,
      default: "user",
      required: true,
      enum: ["user", "admin", "template_manager"]
    },

    passwordChangeAt: { type: Date },
    passwordResetToken: { type: String },
    passwordResetTokenExpires: { type: Date },
    isDeleted: { type: Boolean, default: false },
    showCookiePopup: { type: Boolean, default: false },
    cookieContent: { type: String, default: null },
    autoDeletedAt: { type: Date, default: null },
    autoDeletedDays: { type: Number, default: 30 },
    logoutTime: {
      type: Number,
      default: 15,
      min: [1, "Logout time must be at least 1 minute"]
    },
    onboardingCompleted: { type: Boolean, default: false },

    // WhatsApp Business API Configuration (Meta Cloud API)
    whatsapp: {
      phoneNumberId: { type: String, default: null },      // WhatsApp Business Phone Number ID
      accessToken: { type: String, default: null },        // Permanent Access Token
      businessAccountId: { type: String, default: null },  // WhatsApp Business Account ID (WABA)
      isConfigured: { type: Boolean, default: false },     // Quick check if WhatsApp is set up

      // WhatsApp Details
      displayNumber: { type: String, default: null },      // Display Phone Number
      verifiedName: { type: String, default: null },       // Verified Business Name
      businessName: { type: String, default: null },       // Business Name
      qualityRating: { type: String, default: null },     // Quality Rating (GREEN, YELLOW, RED)
      status: { type: String, default: null },            // Connection Status

      // Templates
      defaultTemplates: [{                                  // Default templates (hello_world, etc.)
        name: { type: String },
        category: { type: String },
        sub_category: { type: String },
        language: { type: String },
        status: { type: String },
        components: [{ type: mongoose.Schema.Types.Mixed }]
      }],
      approvedTemplates: [{                                 // User's approved custom templates
        name: { type: String },
        category: { type: String },
        sub_category: { type: String },
        language: { type: String },
        status: { type: String },
        components: [{ type: mongoose.Schema.Types.Mixed }]
      }],

      // Test Phone Numbers
      testPhoneNumbers: [{                                  // Test phone numbers for testing
        phone_number: { type: String },
        name: { type: String },
        is_test: { type: Boolean, default: true }
      }],

      // Metadata
      lastUpdated: { type: Date, default: Date.now },      // Last time WhatsApp data was updated
      setupDate: { type: Date, default: null }             // When WhatsApp was first configured
    },

    // Multi-Tenant WhatsApp Configuration (SaaS)
    multiTenantWhatsApp: {
      isConfigured: { type: Boolean, default: false },     // Quick check if multi-tenant WhatsApp is set up
      phoneNumberId: { type: String, default: null },      // Phone Number ID in our WABA
      wabaId: { type: String, default: null },            // WhatsApp Business Account ID
      systemUserAccessToken: { type: String, default: null }, // System User Access Token from code exchange
      displayNumber: { type: String, default: null },      // Display Phone Number
      verifiedName: { type: String, default: null },       // Verified Business Name
      qualityRating: { type: String, default: null },      // Quality Rating (GREEN, YELLOW, RED)
      codeVerificationStatus: { type: String, default: null }, // Code verification status
      status: { type: String, default: null },            // Connection Status
      setupDate: { type: Date, default: null },           // When multi-tenant WhatsApp was configured
      lastUpdated: { type: Date, default: Date.now }      // Last time multi-tenant data was updated
    },

    // WATI WhatsApp Configuration
    watiWhatsApp: {
      isConfigured: { type: Boolean, default: false },     // Quick check if WATI WhatsApp is set up
      apiKey: { type: String, default: null },            // WATI API Key
      instanceId: { type: String, default: null },         // WATI Instance ID
      baseUrl: { type: String, default: "https://live-server-100100.wati.io" }, // WATI Base URL
      configuredAt: { type: Date, default: null },        // When WATI was configured
      lastUpdated: { type: Date, default: Date.now }      // Last time WATI data was updated
    },

    // Twilio WhatsApp Configuration
    twilioWhatsApp: {
      isConfigured: { type: Boolean, default: false },     // Quick check if Twilio WhatsApp is set up
      accountSid: { type: String, default: null },       // Twilio Account SID
      authToken: { type: String, default: null },         // Twilio Auth Token
      fromNumber: { type: String, default: null },        // Twilio From Number
      configuredAt: { type: Date, default: null },       // When Twilio was configured
      lastUpdated: { type: Date, default: Date.now }      // Last time Twilio data was updated
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Hash password only if provider = form and password is modified
userSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

userSchema.methods.createResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetTokenExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

const User = mongoose.model("User", userSchema);
module.exports = User;
