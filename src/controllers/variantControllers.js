const mongoose = require("mongoose");
const Variant = require("../models/variant.model");
const Experiment = require("../models/experiment.model");
const Campaign = require("../models/user.campaign.model");
const VariantEvent = require("../models/variantEvent.model");
const { createCampaignScript } = require("../utils/createScript");

const VALID_VARIANT_NAMES = ["A", "B", "C", "D"];
const VALID_EVENT_TYPES = ["impression", "click", "conversion"];

// Shapes a Variant document (optionally with campaignId populated) into the
// flat object the frontend expects. When the linked campaign clone exists,
// its live content/publish state wins over the variant's own snapshot
// fields, since the campaign is the actual source of truth once a user has
// opened it in the Campaign Builder and edited it there.
function formatVariant(variantDoc) {
    const v = variantDoc.toObject ? variantDoc.toObject() : variantDoc;
    const campaign = v.campaignId && typeof v.campaignId === "object" ? v.campaignId : null;

    const impressions = v.impressions || 0;
    const clicks = v.clicks || 0;
    const conversions = v.conversions || 0;

    return {
        id: v._id,
        experimentId: v.experimentId,
        campaignId: campaign ? campaign._id : v.campaignId || null,
        name: v.variantName,
        heading: campaign ? campaign.heading || "" : v.heading || "",
        popupContent: campaign ? campaign.popupContent || "" : v.popupContent || "",
        imageUrl: campaign ? campaign.imageURL || "" : v.imageURL || "",
        isPublished: campaign ? Boolean(campaign.isActive) : false,
        weight: v.weight,
        impressions,
        clicks,
        conversions,
        ctr: impressions ? +((clicks / impressions) * 100).toFixed(2) : 0,
        conversionRate: clicks ? +((conversions / clicks) * 100).toFixed(2) : 0,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt
    };
}

exports.createVariant = async (req, res) => {
    try {
        const {
            experimentId,
            variantName,
            popupContent,
            heading,
            imageURL,
            weight
        } = req.body;

        //1. validation
        if (!experimentId) {
            return res.status(400).json({
                success: false,
                message: "Experiment ID is required."
            });
        }

        if (!variantName) {
            return res.status(400).json({
                success: false,
                message: "Variant Name is required."
            });
        }

        if (!VALID_VARIANT_NAMES.includes(variantName)) {
            return res.status(400).json({
                success: false,
                message: `Variant Name must be one of: ${VALID_VARIANT_NAMES.join(", ")}.`
            });
        }

        //2. check if experiment exists (and belongs to this client)
        const experiment = await Experiment.findOne({ _id: experimentId, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({
                success: false,
                message: "Experiment not found."
            });
        }

        //3. clone the experiment's parent campaign so this variant gets its
        // own fully independent, fully editable copy — same builder, same
        // template/onsite-action options as any regular campaign, but
        // published on its own.
        const parentCampaign = await Campaign.findById(experiment.campaignId);
        if (!parentCampaign) {
            return res.status(404).json({
                success: false,
                message: "The experiment's campaign no longer exists."
            });
        }

        const clonedFields = parentCampaign.toObject();
        delete clonedFields._id;
        delete clonedFields.createdAt;
        delete clonedFields.updatedAt;
        delete clonedFields.__v;

        const clonedCampaign = await Campaign.create({
            ...clonedFields,
            clientId: req.user._id,
            campaigndesignerName: `${parentCampaign.campaigndesignerName || "Campaign"} — Variant ${variantName}`,
            heading: heading !== undefined && heading !== "" ? heading : clonedFields.heading,
            popupContent: popupContent !== undefined && popupContent !== "" ? popupContent : clonedFields.popupContent,
            imageURL: imageURL !== undefined && imageURL !== "" ? imageURL : clonedFields.imageURL,
            isABTesting: true,
            experimentId: experiment._id,
            isActive: false, // variants start as drafts until explicitly published
            clicks: 0
        });

        const variant = await Variant.create({
            experimentId,
            variantName,
            campaignId: clonedCampaign._id,
            heading: clonedCampaign.heading,
            popupContent: clonedCampaign.popupContent,
            imageURL: clonedCampaign.imageURL,
            weight
        });

        const populatedVariant = await Variant.findById(variant._id).populate("campaignId");

        return res.status(200).json({
            success: true,
            message: "Variant Created Successfully",
            data: formatVariant(populatedVariant)
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getVariantsByExperiment = async (req, res) => {
    try {
        const { experimentId } = req.query;

        if (!experimentId) {
            return res.status(400).json({
                success: false,
                message: "Experiment ID is required."
            });
        }

        const experiment = await Experiment.findOne({ _id: experimentId, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({
                success: false,
                message: "Experiment not found."
            });
        }

        const variants = await Variant.find({ experimentId })
            .sort({ variantName: 1 })
            .populate("campaignId");

        return res.status(200).json({
            success: true,
            data: variants.map(formatVariant)
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { variantName, popupContent, heading, imageURL, weight } = req.body;

        const variant = await Variant.findById(id).populate("campaignId");
        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found."
            });
        }

        // Ownership check via the parent experiment's clientId.
        const experiment = await Experiment.findOne({ _id: variant.experimentId, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({
                success: false,
                message: "Variant not found."
            });
        }

        if (variantName) {
            if (!VALID_VARIANT_NAMES.includes(variantName)) {
                return res.status(400).json({
                    success: false,
                    message: `Variant Name must be one of: ${VALID_VARIANT_NAMES.join(", ")}.`
                });
            }
            variant.variantName = variantName;
        }
        if (weight !== undefined) variant.weight = weight;

        // Content edits (heading/popupContent/imageURL) go to the linked
        // campaign clone — that's the source of truth once campaignId
        // exists, since that's also what the Campaign Builder edits.
        if (variant.campaignId) {
            const campaignUpdates = {};
            if (heading !== undefined) campaignUpdates.heading = heading;
            if (popupContent !== undefined) campaignUpdates.popupContent = popupContent;
            if (imageURL !== undefined) campaignUpdates.imageURL = imageURL;
            if (Object.keys(campaignUpdates).length > 0) {
                await Campaign.findByIdAndUpdate(variant.campaignId._id || variant.campaignId, campaignUpdates);
            }

            // Mirrors campaignControllers.js#updateCampaign: whenever
            // popupContent changes, the actual served script has to be
            // regenerated too, or the campaign document says one thing and
            // the file visitors get served (or don't get served at all,
            // if none was ever created) says another. This is the only
            // place in the variant lifecycle that calls createCampaignScript
            // — createVariant leaves new variants as unscripted drafts on
            // purpose, and publishVariant only flips isActive/status.
            if (popupContent !== undefined) {
                const campaignId = (variant.campaignId._id || variant.campaignId).toString();
                let content = popupContent.replace(/\{\{CAMPAIGN_ID\}\}/g, campaignId);
                content = content.replace(/\{\{USER_ID\}\}/g, req.user._id.toString());
                const showTeaser = req.body.showTeaser !== undefined ? req.body.showTeaser : true;
                content = content.replace(/\{\{SHOW_TEASER\}\}/g, showTeaser.toString());

                const existingCampaign = await Campaign.findById(campaignId);
                await createCampaignScript(content, req.user._id, campaignId, existingCampaign?.isActive ?? false);
            }
        } else {
            if (heading !== undefined) variant.heading = heading;
            if (popupContent !== undefined) variant.popupContent = popupContent;
            if (imageURL !== undefined) variant.imageURL = imageURL;
        }

        await variant.save();

        const populatedVariant = await Variant.findById(variant._id).populate("campaignId");

        return res.status(200).json({
            success: true,
            message: "Variant Updated Successfully",
            data: formatVariant(populatedVariant)
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.publishVariant = async (req, res) => {
    try {
        const { id } = req.params;
        const { isPublished } = req.body;

        const variant = await Variant.findById(id).populate("campaignId");
        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found."
            });
        }

        const experiment = await Experiment.findOne({ _id: variant.experimentId, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({
                success: false,
                message: "Variant not found."
            });
        }

        if (!variant.campaignId) {
            return res.status(400).json({
                success: false,
                message: "This variant has no linked campaign design to publish."
            });
        }

        // Mirror the same two-field convention campaignControllers.js uses
        // everywhere else (updateCampaign/scriptUpdate): isActive AND status
        // move together. getScripts' serving query requires BOTH
        // (isActive:true, status:'published') to actually deliver the
        // script to visitors, so setting isActive alone would silently
        // leave a "published" variant undeliverable.
        await Campaign.findByIdAndUpdate(variant.campaignId._id || variant.campaignId, {
            isActive: Boolean(isPublished),
            status: isPublished ? "published" : "draft"
        });

        const populatedVariant = await Variant.findById(id).populate("campaignId");

        return res.status(200).json({
            success: true,
            message: isPublished ? "Variant Published Successfully" : "Variant Unpublished Successfully",
            data: formatVariant(populatedVariant)
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ============================================================================
// PUBLIC — POST /api/variant/track
// Called from the tracking loader running on the CLIENT'S website (see
// getScripts in scriptControllers.js), so this deliberately has no `auth`
// middleware — the visitor's browser has no session with URLPT. It's the
// only write path into VariantEvent / the Variant counters.
//
// impressions/clicks are counted every time they fire (raw pageview/click
// counts, matching how `clicks` already worked elsewhere in this app).
// conversions are de-duplicated per (variantId, visitorId) so a visitor who
// re-triggers the same conversion doesn't inflate the CVR.
// ============================================================================
exports.trackEvent = async (req, res) => {
    try {
        const { campaignId, type, visitorId, visitId, deviceType, browser, country } = req.body;

        if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
            return res.status(400).json({ success: false, message: "A valid campaignId is required." });
        }
        if (!VALID_EVENT_TYPES.includes(type)) {
            return res.status(400).json({ success: false, message: `type must be one of: ${VALID_EVENT_TYPES.join(", ")}.` });
        }

        const variant = await Variant.findOne({ campaignId });
        if (!variant) {
            // Not every campaign belongs to a variant — fail quietly so the
            // beacon never surfaces an error in a visitor's console.
            return res.status(200).json({ success: true, message: "Ignored (not a variant campaign)." });
        }

        if (type === "conversion" && visitorId) {
            const alreadyConverted = await VariantEvent.findOne({
                variantId: variant._id,
                visitorId,
                type: "conversion"
            });
            if (alreadyConverted) {
                return res.status(200).json({ success: true, message: "Conversion already recorded for this visitor." });
            }
        }

        const counterField = type === "impression" ? "impressions" : type === "click" ? "clicks" : "conversions";
        await Variant.findByIdAndUpdate(variant._id, { $inc: { [counterField]: 1 } });

        await VariantEvent.create({
            variantId: variant._id,
            experimentId: variant.experimentId,
            campaignId,
            clientId: req.body.clientId || undefined,
            type,
            visitorId: visitorId || "",
            visitId: visitId ? String(visitId) : "",
            deviceType: deviceType || "",
            browser: browser || "",
            country: country || ""
        });

        return res.status(200).json({ success: true, message: "Event recorded." });
    } catch (error) {
        console.error("trackEvent error:", error);
        // Never fail loudly toward the visitor's browser.
        return res.status(200).json({ success: false, message: "Ignored." });
    }
};

exports.deleteVariant = async (req, res) => {
    try {
        const { id } = req.params;

        const variant = await Variant.findById(id);
        if (!variant) {
            return res.status(404).json({
                success: false,
                message: "Variant not found."
            });
        }

        const experiment = await Experiment.findOne({ _id: variant.experimentId, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({
                success: false,
                message: "Variant not found."
            });
        }

        if (variant.campaignId) {
            await Campaign.findByIdAndDelete(variant.campaignId);
        }
        await Variant.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Variant Deleted Successfully"
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
