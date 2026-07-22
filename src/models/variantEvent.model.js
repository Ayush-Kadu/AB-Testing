const mongoose = require("mongoose");

// ============================================================================
// A/B Testing — event log.
// One row per impression/click/conversion recorded against a Variant's
// cloned campaign. This is additive/new (nothing like this existed for
// campaigns before — impressions in particular had no tracking pipeline at
// all anywhere in the codebase). It exists purely to power the Analytics
// Dashboard's trend chart and segment breakdown, which need timestamped,
// dimensioned events — the running totals on Variant (impressions/clicks/
// conversions) stay as the fast-path counters for table/summary views.
// ============================================================================
const variantEventSchema = new mongoose.Schema(
    {
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Variant",
            required: true,
        },
        experimentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Experiment",
            required: true,
        },
        campaignId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "usercampaign",
            required: true,
        },
        // Not required: the public /variant/track beacon (called from an
        // anonymous visitor's browser) resolves the variant from campaignId
        // alone and doesn't do an extra lookup for clientId on this hot
        // path. Analytics queries scope by experimentId/variantId instead.
        clientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        type: {
            type: String,
            enum: ["impression", "click", "conversion"],
            required: true,
        },
        visitorId: { type: String, default: "" },
        visitId: { type: String, default: "" },
        deviceType: { type: String, default: "" },
        browser: { type: String, default: "" },
        country: { type: String, default: "" },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

variantEventSchema.index({ experimentId: 1, type: 1, createdAt: 1 });
variantEventSchema.index({ variantId: 1, type: 1 });

module.exports = mongoose.model("VariantEvent", variantEventSchema);
