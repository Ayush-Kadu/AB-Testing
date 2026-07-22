const mongoose = require("mongoose");
const Variant = require("../models/variant.model");
const Campaign = require("../models/user.campaign.model");
const Experiment = require("../models/experiment.model");
const VariantEvent = require("../models/variantEvent.model");

const VALID_STATUSES = ["draft", "running", "paused", "completed"];

// Abramowitz-Stegun approximation of the standard normal CDF — used to turn
// a z-score into a p-value/confidence for the two-proportion z-test below.
// No external stats library in this codebase, and this is accurate to
// ~7 decimal places, which is more than enough for a confidence badge.
function normalCdf(z) {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp((-z * z) / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z >= 0 ? 1 - p : p;
}

// Shapes a raw Experiment document into the flat object the frontend expects
// (campaignName + variantsCount are joined in here since the frontend table
// needs them but they aren't stored on the Experiment document itself).
async function formatExperiment(experimentDoc) {
    const experiment = experimentDoc.toObject ? experimentDoc.toObject() : experimentDoc;
    const [campaign, variantsCount] = await Promise.all([
        Campaign.findById(experiment.campaignId).select("campaigndesignerName"),
        Variant.countDocuments({ experimentId: experiment._id })
    ]);

    return {
        id: experiment._id,
        name: experiment.experimentName,
        campaignId: experiment.campaignId,
        campaignName: campaign?.campaigndesignerName || "—",
        trafficSplit: experiment.trafficSplit,
        status: experiment.status,
        variantsCount,
        winnerVariant: experiment.winnerVariant || null,
        createdAt: experiment.createdAt,
        updatedAt: experiment.updatedAt
    };
}

exports.createExperiment = async (req, res) => {
    try {
        const { campaignId, experimentName, trafficSplit, status } = req.body;

        if (!campaignId) {
            return res.status(400).json({
                success: false,
                message: "Campaign ID is required."
            });
        }

        if (!experimentName) {
            return res.status(400).json({
                success: false,
                message: "Experiment Name is required."
            });
        }

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found."
            });
        }

        if (!campaign.websiteId) {
            return res.status(400).json({
                success: false,
                message: "Selected campaign has no associated website."
            });
        }

        const experiment = await Experiment.create({
            campaignId,
            clientId: req.user._id,
            websiteId: campaign.websiteId,
            experimentName,
            trafficSplit: trafficSplit ?? 50,
            status: VALID_STATUSES.includes(status) ? status : "draft"
        });

        return res.status(201).json({
            success: true,
            message: "Experiment Created Successfully",
            data: await formatExperiment(experiment)
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getExperiments = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const search = req.query.search || "";
        const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

        const sortFieldMap = {
            name: "experimentName",
            campaignName: "createdAt", // campaignName isn't stored on Experiment; fall back to createdAt
            trafficSplit: "trafficSplit",
            status: "status",
            variantsCount: "createdAt", // variantsCount is computed, not sortable in Mongo directly
            createdAt: "createdAt"
        };
        const sortField = sortFieldMap[req.query.sortBy] || "createdAt";

        const filter = { clientId: req.user._id };
        if (search) {
            filter.experimentName = { $regex: search, $options: "i" };
        }

        const total = await Experiment.countDocuments(filter);
        const experiments = await Experiment.find(filter)
            .sort({ [sortField]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit);

        const data = await Promise.all(experiments.map(formatExperiment));

        return res.status(200).json({ success: true, data, total, page, limit });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateExperiment = async (req, res) => {
    try {
        const { id } = req.params;
        const { campaignId, experimentName, trafficSplit, status } = req.body;

        const experiment = await Experiment.findOne({ _id: id, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({
                success: false,
                message: "Experiment not found."
            });
        }

        if (campaignId && String(campaignId) !== String(experiment.campaignId)) {
            const campaign = await Campaign.findById(campaignId);
            if (!campaign) {
                return res.status(404).json({
                    success: false,
                    message: "Campaign not found."
                });
            }
            experiment.campaignId = campaignId;
            experiment.websiteId = campaign.websiteId;
        }

        if (experimentName) experiment.experimentName = experimentName;
        if (trafficSplit !== undefined) experiment.trafficSplit = trafficSplit;
        if (status && VALID_STATUSES.includes(status)) experiment.status = status;

        await experiment.save();

        return res.status(200).json({
            success: true,
            message: "Experiment Updated Successfully",
            data: await formatExperiment(experiment)
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.deleteExperiment = async (req, res) => {
    try {
        const { id } = req.params;

        const experiment = await Experiment.findOneAndDelete({ _id: id, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({
                success: false,
                message: "Experiment not found."
            });
        }

        await Variant.deleteMany({ experimentId: id });

        return res.status(200).json({
            success: true,
            message: "Experiment Deleted Successfully"
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
// GET /api/experiment/:id/analytics
// Powers the Analytics Dashboard. Everything here is computed from the real
// Variant counters (impressions/clicks/conversions, updated by
// variant/track and addEmailSubmission) and the VariantEvent log (for the
// trend chart and device segment breakdown) — nothing hardcoded.
//
// Winner: MVP rule per spec — highest conversion rate among variants that
// have at least one impression. Persisted onto Experiment.winnerVariant.
// Confidence/p-value: a real two-proportion z-test between the "A" variant
// (control) and the current winner — not a statistical-significance gate,
// just an honest number to show alongside the winner, only computed when
// there's an actual control + winner pair with impressions on both sides.
// ============================================================================
// Shared by getExperimentAnalytics and getAiInsight so the AI proxy is
// grounded in the exact same numbers the dashboard shows — no separate
// codepath that could drift or fabricate different figures.
async function buildExperimentAnalytics(experiment) {
        const id = experiment._id;
        const variants = await Variant.find({ experimentId: id }).populate("campaignId").sort({ variantName: 1 });

        const variantMetrics = variants.map((v) => {
            const impressions = v.impressions || 0;
            const clicks = v.clicks || 0;
            const conversions = v.conversions || 0;
            const campaign = v.campaignId && typeof v.campaignId === "object" ? v.campaignId : null;
            return {
                variantId: v._id.toString(),
                name: v.variantName,
                campaignId: campaign ? campaign._id.toString() : null,
                isPublished: campaign ? Boolean(campaign.isActive) : false,
                weight: v.weight,
                impressions,
                clicks,
                conversions,
                ctr: impressions ? +((clicks / impressions) * 100).toFixed(2) : 0,
                conversionRate: impressions ? +((conversions / impressions) * 100).toFixed(2) : 0
            };
        });

        // Winner = highest conversion rate among variants that have data.
        const eligible = variantMetrics.filter((v) => v.impressions > 0);
        let winner = null;
        if (eligible.length) {
            winner = eligible.reduce((best, v) => (v.conversionRate > best.conversionRate ? v : best), eligible[0]);
        }

        if (winner && (experiment.status === "running" || experiment.status === "completed")) {
            if (String(experiment.winnerVariant || "") !== winner.variantId) {
                experiment.winnerVariant = winner.variantId;
                await experiment.save();
            }
        }

        // Sample Ratio Mismatch check — the standard chi-square goodness-of-fit
        // test A/B platforms use to flag broken traffic allocation (observed
        // impression split vs. the configured weight split). p < 0.01 is the
        // conventional threshold (Kohavi et al.) to avoid false positives.
        let srmDetected = null;
        const withImpressions = variantMetrics.filter((v) => v.impressions > 0);
        if (withImpressions.length >= 2) {
            const totalImpressions = withImpressions.reduce((s, v) => s + v.impressions, 0);
            const totalWeight = withImpressions.reduce((s, v) => s + (v.weight || 1), 0);
            let chiSquare = 0;
            withImpressions.forEach((v) => {
                const expected = totalImpressions * ((v.weight || 1) / totalWeight);
                if (expected > 0) chiSquare += ((v.impressions - expected) ** 2) / expected;
            });
            const df = withImpressions.length - 1;
            const criticalValues = { 1: 6.635, 2: 9.210, 3: 11.345 };
            const critical = criticalValues[df] || 13.277;
            srmDetected = chiSquare > critical;
        }

        // Control = variant "A" if present, else whichever variant comes first.
        const control = variantMetrics.find((v) => v.name === "A") || variantMetrics[0] || null;

        // Comparison variant — the best-performing *other* variant that
        // actually has traffic, used for the dashboard's second card/chart
        // line/segment breakdown. Deliberately separate from `winner`:
        // early on, before any conversions exist anywhere, `winner` ties
        // back to control by default (see the reduce() above, which keeps
        // eligible[0] on a tie) and there'd be nothing to show as a second
        // variant. This keeps the second variant visible as soon as it has
        // impressions, regardless of whether it's actually ahead yet.
        const others = variantMetrics.filter((v) => !control || v.variantId !== control.variantId);
        const othersWithImpressions = others.filter((v) => v.impressions > 0);
        const comparison = othersWithImpressions.length
            ? othersWithImpressions.reduce((best, v) => (v.conversionRate > best.conversionRate ? v : best), othersWithImpressions[0])
            : null;

        let confidence = null;
        let pValue = null;
        let liftPct = null;
        if (control && comparison && control.impressions > 0 && comparison.impressions > 0) {
            const p1 = control.conversions / control.impressions;
            const p2 = comparison.conversions / comparison.impressions;
            const pooled = (control.conversions + comparison.conversions) / (control.impressions + comparison.impressions);
            const se = Math.sqrt(pooled * (1 - pooled) * (1 / control.impressions + 1 / comparison.impressions));
            if (se > 0) {
                const z = (p2 - p1) / se;
                pValue = +((2 * (1 - normalCdf(Math.abs(z)))).toFixed(4));
                confidence = +(((1 - pValue) * 100).toFixed(1));
                liftPct = p1 > 0 ? +(((p2 - p1) / p1) * 100).toFixed(1) : (p2 > 0 ? 100 : null);
            }
        }

        // ── Trend: last 14 days, daily conversion rate per variant ──
        const DAYS = 14;
        const since = new Date();
        since.setDate(since.getDate() - (DAYS - 1));
        since.setHours(0, 0, 0, 0);

        const trendRaw = await VariantEvent.aggregate([
            { $match: { experimentId: new mongoose.Types.ObjectId(id), createdAt: { $gte: since } } },
            {
                $group: {
                    _id: {
                        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        variantId: "$variantId",
                        type: "$type"
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        const trendMap = {};
        trendRaw.forEach((row) => {
            const day = row._id.day;
            const vId = row._id.variantId.toString();
            trendMap[day] = trendMap[day] || {};
            trendMap[day][vId] = trendMap[day][vId] || { impressions: 0, conversions: 0 };
            if (row._id.type === "impression") trendMap[day][vId].impressions = row.count;
            if (row._id.type === "conversion") trendMap[day][vId].conversions = row.count;
        });

        const trend = [];
        for (let i = 0; i < DAYS; i++) {
            const d = new Date(since);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split("T")[0];
            const point = {
                date: key,
                label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
            };
            variantMetrics.forEach((v) => {
                const dayData = (trendMap[key] || {})[v.variantId];
                const imp = dayData?.impressions || 0;
                const conv = dayData?.conversions || 0;
                point[v.name] = imp ? +((conv / imp) * 100).toFixed(2) : null;
            });
            trend.push(point);
        }

        // ── Segment breakdown: control vs comparison conversion rate by device type ──
        const segments = [];
        if (control && comparison) {
            const segmentAgg = await VariantEvent.aggregate([
                { $match: { experimentId: new mongoose.Types.ObjectId(id) } },
                {
                    $group: {
                        _id: { deviceType: "$deviceType", variantId: "$variantId", type: "$type" },
                        count: { $sum: 1 }
                    }
                }
            ]);

            const deviceMap = {};
            segmentAgg.forEach((row) => {
                const device = row._id.deviceType || "";
                if (!device) return;
                const vId = row._id.variantId.toString();
                deviceMap[device] = deviceMap[device] || {};
                deviceMap[device][vId] = deviceMap[device][vId] || { impressions: 0, conversions: 0 };
                if (row._id.type === "impression") deviceMap[device][vId].impressions = row.count;
                if (row._id.type === "conversion") deviceMap[device][vId].conversions = row.count;
            });

            Object.keys(deviceMap).forEach((device) => {
                const c = deviceMap[device][control.variantId] || { impressions: 0, conversions: 0 };
                const w = deviceMap[device][comparison.variantId] || { impressions: 0, conversions: 0 };
                if (!c.impressions && !w.impressions) return;
                const cCvr = c.impressions ? (c.conversions / c.impressions) * 100 : 0;
                const wCvr = w.impressions ? (w.conversions / w.impressions) * 100 : 0;
                const lift = cCvr > 0 ? +(((wCvr - cCvr) / cCvr) * 100).toFixed(1) : (wCvr > 0 ? 100 : 0);
                segments.push({
                    label: device,
                    key: device.toLowerCase(),
                    controlCvr: +cCvr.toFixed(2),
                    variantCvr: +wCvr.toFixed(2),
                    lift
                });
            });
            segments.sort((a, b) => b.lift - a.lift);
        }

        return {
            experiment: {
                id: experiment._id,
                name: experiment.experimentName,
                status: experiment.status,
                trafficSplit: experiment.trafficSplit,
                createdAt: experiment.createdAt
            },
            variants: variantMetrics,
            controlVariantId: control ? control.variantId : null,
            winnerVariantId: winner ? winner.variantId : null,
            comparisonVariantId: comparison ? comparison.variantId : null,
            confidence,
            pValue,
            liftPct,
            srmDetected,
            trend,
            segments
        };
}

exports.getExperimentAnalytics = async (req, res) => {
    try {
        const { id } = req.params;

        const experiment = await Experiment.findOne({ _id: id, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({ success: false, message: "Experiment not found." });
        }

        const data = await buildExperimentAnalytics(experiment);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ============================================================================
// POST /api/experiment/:id/ai-insight
// Backs the dashboard's "AI optimization assistant" panel. The system
// prompt is built fresh from buildExperimentAnalytics() on every call, so
// the model is always reasoning over the real current numbers — never a
// hardcoded scenario. Uses the existing GROQ_API_KEY (already configured in
// this backend's .env; nothing new to provision) via Groq's OpenAI-
// compatible chat completions endpoint. If the key is missing or the call
// fails, falls back to a deterministic summary built from the same real
// data instead of a network call — the response shape is identical either
// way, so the frontend doesn't need to know which path was taken.
// ============================================================================
exports.getAiInsight = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, history } = req.body;

        const experiment = await Experiment.findOne({ _id: id, clientId: req.user._id });
        if (!experiment) {
            return res.status(404).json({ success: false, message: "Experiment not found." });
        }

        const analytics = await buildExperimentAnalytics(experiment);
        const fallback = buildFallbackInsight(analytics, message);

        if (!process.env.GROQ_API_KEY) {
            return res.status(200).json({ success: true, data: fallback });
        }

        const systemPrompt = buildAiSystemPrompt(analytics);
        const chatHistory = Array.isArray(history)
            ? history.slice(-8).map((m) => ({
                  role: m.role === "user" ? "user" : "assistant",
                  content: String(m.content || "").slice(0, 2000)
              }))
            : [];

        try {
            const axios = require("axios");
            const groqRes = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model: "llama-3.3-70b-versatile",
                    max_tokens: 500,
                    messages: [
                        { role: "system", content: systemPrompt },
                        ...chatHistory,
                        { role: "user", content: String(message || "").slice(0, 2000) }
                    ]
                },
                {
                    headers: {
                        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    timeout: 15000
                }
            );

            const raw = groqRes.data?.choices?.[0]?.message?.content || "";
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch {
                parsed = { text: raw || fallback.text, widget: null, action: null };
            }

            return res.status(200).json({
                success: true,
                data: {
                    text: parsed.text || fallback.text,
                    widget: parsed.widget || null,
                    action: parsed.action || null
                }
            });
        } catch (aiError) {
            console.error("AI insight (Groq) call failed, using fallback:", aiError.message);
            return res.status(200).json({ success: true, data: fallback });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

function buildAiSystemPrompt(analytics) {
    const lines = analytics.variants.map(
        (v) => `- Variant ${v.name}: ${v.impressions} impressions | ${v.conversions} conversions | ${v.conversionRate}% CVR${v.variantId === analytics.winnerVariantId ? " (current leader)" : ""}`
    );
    const seg = analytics.segments
        .map((s) => `- ${s.label}: control ${s.controlCvr}% vs leader ${s.variantCvr}% (${s.lift >= 0 ? "+" : ""}${s.lift}% lift)`)
        .join("\n");

    return `You are an AI analytics assistant for the A/B test "${analytics.experiment.name}" (status: ${analytics.experiment.status}).

Variant data:
${lines.join("\n")}

${analytics.confidence !== null ? `Confidence: ${analytics.confidence}% | p-value: ${analytics.pValue}${analytics.liftPct !== null ? ` | Lift: ${analytics.liftPct}%` : ""}` : "Not enough data yet for a confidence/lift calculation."}

Device segment breakdown (leading variant lift over control):
${seg || "No segment data yet."}

Reply ONLY with a valid JSON object — no markdown, no backticks, no preamble. Exactly this shape:
{"text": "<2-3 sentence insight, plain text, grounded only in the numbers above>", "widget": null, "action": null}

Override widget when the user asks for a comparison/breakdown table:
{"type": "table", "headers": ["Segment","Control CVR","Leader CVR","Lift"], "rows": [["...","...","...","..."]]}
Override action when the user mentions a specific device segment:
{"type": "apply_filter", "segment": "<device key from the list above>", "label": "<human label>"}
Keep text to 2-3 sentences. Never invent numbers not shown above — if asked something the data can't answer, say so.`;
}

function buildFallbackInsight(analytics, message) {
    if (!analytics.variants.length || !analytics.variants.some((v) => v.impressions > 0)) {
        return {
            text: "No traffic has been recorded for this experiment yet. Publish a variant and drive some visitors to it to see real results here.",
            widget: null,
            action: null
        };
    }
    const winner = analytics.variants.find((v) => v.variantId === analytics.winnerVariantId);
    if (!winner) {
        return { text: "Not enough data yet to identify a leading variant.", widget: null, action: null };
    }
    const confidenceText =
        analytics.confidence !== null
            ? ` at ${analytics.confidence}% confidence${analytics.liftPct !== null ? ` (${analytics.liftPct >= 0 ? "+" : ""}${analytics.liftPct}% lift over control)` : ""}`
            : " — confidence isn't calculable yet with the current sample size";
    return {
        text: `Variant ${winner.name} is currently leading with a ${winner.conversionRate}% conversion rate${confidenceText}. Ask me about specific variants or device segments for more detail.`,
        widget: null,
        action: null
    };
}
