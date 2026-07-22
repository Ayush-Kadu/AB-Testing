const cron = require("node-cron");
const moment = require("moment");
const User = require("../models/user.model"); // <-- register User
const Usersubscription = require("../models/user.subscription.model"); // mongoose model
const { sendEmail } = require("../utils/mailer"); // your email helper
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'hey@mimz.com',
        pass: 'paez tfsp rjvv dfib',
    },
    tls: {
        rejectUnauthorized: false,
    },
});

// keep your existing getSubject and escapeHtml helpers (unchanged)
function getSubject({ planType, daysLeft, state }) {
    if (state === "reminder") {
        if (daysLeft === 0) return `Your ${planType} plan expires today — renew to keep access`;
        if (daysLeft === 1) return `1 day left on your ${planType} plan`;
        if (daysLeft <= 3) return `${daysLeft} days left — renew your ${planType} plan`;
        return `Your ${planType} plan expires in ${daysLeft} days`;
    }
    if (state === "expired") {
        return `Your ${planType} plan expired — you're in the grace period`;
    }
    if (state === "suspended") {
        return `Your ${planType} subscription has been suspended`;
    }
    return `Update about your ${planType} subscription`;
}

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// brand config
const COMPANY_NAME = "URLPT";
const COMPANY_URL = "https://app.mimz.com";
const SUPPORT_EMAIL = "support@mimz.com"; // change if needed
const LOGO_URL = "https://technians.com/wp-content/uploads/2021/09/main-logo.webp"; // optional logo URL; keep empty to use text logo

// new base HTML with gradient, roomy layout, strong CTA, and responsive-safe inline styles
function baseHtml({ preheader = "", userName, heading, message, ctaText, ctaUrl, small }) {
    // preheader is invisible snippet that many email clients show next to subject
    return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading || `${COMPANY_NAME} update`)}</title>
    <style>
      /* Basic mobile-friendly resets */
      body { margin:0; padding:0; -webkit-text-size-adjust:none; -ms-text-size-adjust:none; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; background-color: #f4f6f9; color: #0f1724; }
      a { color: inherit; text-decoration: none; }
      .container { width:100%; max-width:680px; margin:0 auto; }
      .card { border-radius:12px; overflow:hidden; background: #ffffff; box-shadow: 0 6px 30px rgba(15,23,36,0.06); }
      .header { padding:24px; display:flex; align-items:center; gap:16px; }
      .brand { display:flex; align-items:center; gap:12px; }
      .logo { width:48px; height:48px; border-radius:10px; display:inline-block; background: linear-gradient(135deg,#6F5AFE,#0f62fe); color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; font-size:18px; }
      .brand-title { font-size:18px; font-weight:700; color:#fff; }
      .hero { padding:28px; background: linear-gradient(90deg,#0f62fe 0%, #6F5AFE 100%); color:#fff; }
      .hero h1 { margin:0; font-size:20px; letter-spacing: -0.2px; }
      .content { padding:26px; }
      .greeting { font-size:15px; margin:0 0 8px 0; color:#0f1724; }
      .subject { margin:0 0 14px 0; font-size:18px; font-weight:700; color:#0f1724; }
      .message { margin:0 0 20px 0; font-size:15px; line-height:1.6; color:#334155; }
      .cta { display:inline-block; padding:12px 18px; border-radius:10px; background: linear-gradient(90deg,#ff7a59,#ff4f8b); color:#fff; font-weight:700; font-size:15px; box-shadow: 0 8px 20px rgba(255,79,139,0.12); }
      .muted { font-size:13px; color:#64748b; margin-top:18px; }
      .meta { display:flex; gap:12px; flex-wrap:wrap; margin-top:18px; }
      .meta .chip { background:#f1f5f9; padding:8px 10px; border-radius:8px; font-size:13px; color:#0f1724; }
      .footer { padding:18px 26px; background: #ffffff; border-top:1px solid #eef2f7; font-size:13px; color:#64748b; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
      .social a { margin-left:8px; color:#64748b; text-decoration:none; }
      @media (max-width:520px) {
        .hero { padding:18px; }
        .content { padding:18px; }
        .header, .footer { padding-left:14px; padding-right:14px; }
      }
      /* hide preheader visually but keep it accessible for email clients */
      .preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; }
    </style>
  </head>
  <body>
    <!-- preheader -->
    <div class="preheader">${escapeHtml(preheader)}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" class="container card" cellpadding="0" cellspacing="0" style="width:100%; max-width:680px;">
            <!-- header (gradient bar + brand) -->
            <tr>
              <td style="padding:0;">
                <div class="hero" style="padding:22px 28px; background: linear-gradient(90deg,#0f62fe 0%, #6F5AFE 100%);">
                  <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
                    <div style="display:flex; align-items:center; gap:12px;">
                      ${LOGO_URL ? `<img src="${LOGO_URL}" alt="${escapeHtml(COMPANY_NAME)}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;">`
            : `<div class="logo" style="width:48px;height:48px;border-radius:10px; font-weight:700;">${escapeHtml(COMPANY_NAME.slice(0, 2)).toUpperCase()}</div>`}
                      <div style="color:#fff;">
                        <div style="font-weight:700;font-size:16px;">${escapeHtml(COMPANY_NAME)}</div>
                        <div style="font-size:12px;opacity:0.92;">Intelligent URL tracking & analytics</div>
                      </div>
                    </div>
                    <div style="font-size:14px;color:rgba(255,255,255,0.95);">
                      <a href="${COMPANY_URL}" style="color:inherit; text-decoration:none; font-weight:600;">Open dashboard →</a>
                    </div>
                  </div>
                </div>
              </td>
            </tr>

            <!-- body content -->
            <tr>
              <td class="content" style="padding:26px;">
                <p class="greeting">Hi ${escapeHtml(userName)},</p>
                <h2 class="subject">${escapeHtml(heading)}</h2>
                <p class="message">${escapeHtml(message)}</p>

                ${ctaText ? `<p><a class="cta" href="${ctaUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(ctaText)}</a></p>` : ""}

                <div class="meta" style="margin-top:18px;">
                  <div class="chip">Subscription: ${escapeHtml(heading.split(" ")[0] || "")}</div>
                  <div class="chip">Company: ${escapeHtml(COMPANY_NAME)}</div>
                  <div class="chip">Support: <a href="mailto:${SUPPORT_EMAIL}" style="color:inherit;text-decoration:underline;">${SUPPORT_EMAIL}</a></div>
                </div>

                ${small ? `<p class="muted">${escapeHtml(small)}</p>` : ""}
              </td>
            </tr>

            <!-- footer -->
            <tr>
              <td class="footer" style="padding:18px 26px;">
                <div style="display:flex; gap:12px; align-items:center; font-size:13px;">
                  <div>Need help? <a href="mailto:${SUPPORT_EMAIL}" style="color:#0f62fe;text-decoration:none;">${SUPPORT_EMAIL}</a></div>
                  <div style="opacity:0.7;">|</div>
                  <div><a href="${COMPANY_URL}" style="color:#0f62fe;text-decoration:none;">${COMPANY_URL.replace(/^https?:\/\//, "")}</a></div>
                </div>

                <div style="font-size:12px;color:#94a3b8;">
                  &copy; ${new Date().getFullYear()} ${escapeHtml(COMPANY_NAME)} — All rights reserved
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}


// Updated specific templates (use the new baseHtml for nicer copy)
function reminderHtml({ userName, planType, daysLeft, endDate, renewUrl }) {
    const heading = daysLeft === 0
        ? `${planType} plan expires today`
        : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left on your ${planType} plan`;

    const message = daysLeft === 0
        ? `Your ${planType} plan expires today (${new Date(endDate).toLocaleDateString()}). Renew now to avoid suspension and keep access to your analytics.`
        : `Your ${planType} plan will expire on ${new Date(endDate).toLocaleDateString()}. You have ${daysLeft} day${daysLeft > 1 ? 's' : ''} left. Renew now to keep uninterrupted access to URLPT.`

    return baseHtml({
        preheader: `Reminder: ${planType} plan expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
        userName,
        heading,
        message,
        ctaText: "Renew now",
        ctaUrl: renewUrl,
        small: "You’ll keep access during the grace period (if applicable). If you need help, reply to this email."
    });
}

function expiredHtml({ userName, planType, endDate, renewUrl, graceDays }) {
    const heading = `${planType} plan expired — grace period started`;
    const message = `Your ${planType} plan expired on ${new Date(endDate).toLocaleDateString()}. You're now in a ${graceDays}-day grace period — renew to restore access immediately and keep your data flowing.`;

    return baseHtml({
        preheader: `${planType} expired — ${graceDays}-day grace started`,
        userName,
        heading,
        message,
        ctaText: "Renew now",
        ctaUrl: renewUrl,
        small: "If you don't renew within the grace period your subscription will be suspended. Contact support if you need assistance."
    });
}

function dueHtml({ userName, planType, reactivateUrl }) {
    const heading = `Your ${planType} subscription payment is due`;
    const message = `Your ${planType} subscription has entered the payment due stage. Please renew within the next few days to avoid suspension of your account.`;

    return baseHtml({
        preheader: `${planType} payment due — renew now to avoid suspension`,
        userName,
        heading,
        message,
        ctaText: "Renew now",
        ctaUrl: reactivateUrl,
        small: "If you believe this is a mistake or need help, contact support and we'll assist you."
    });
}


function suspendedHtml({ userName, planType, reactivateUrl }) {
    const heading = `${planType} subscription suspended`;
    const message = `Your ${planType} subscription was suspended after the grace period. Renew to reactivate your account and restore access to your URLPT dashboard.`;

    return baseHtml({
        preheader: `${planType} suspended — reactivate to restore access`,
        userName,
        heading,
        message,
        ctaText: "Reactivate now",
        ctaUrl: reactivateUrl,
        small: "If you believe this is a mistake or need help, contact support and we'll assist you."
    });
}


// ✅ CRON Job
cron.schedule("0 0 * * *", async () => {
    console.log("Running subscription cron job...");
    const today = moment().startOf("day");
    try {

        let orders = await Usersubscription.aggregate([
            {
                $match: {
                    status: { $in: ["active", "deactive", "due"] }
                }
            },
            {
                $addFields: {
                    // pick whichever date is later
                    effectiveDate: {
                        $cond: {
                            if: { $gt: ["$updatedAt", "$endDate"] },
                            then: "$updatedAt",
                            else: "$endDate"
                        }
                    },
                    // label which one was used
                    effectiveSource: {
                        $cond: {
                            if: { $gt: ["$updatedAt", "$endDate"] },
                            then: "updatedAt",
                            else: "endDate"
                        }
                    }
                }
            },
            {
                $sort: { effectiveDate: -1 }
            },
            {
                $group: {
                    _id: "$userId",
                    lastOrder: { $first: "$$ROOT" }
                }
            },
            {
                $replaceRoot: { newRoot: "$lastOrder" }
            }
        ]);

        // populate user details
        orders = await Usersubscription.populate(orders, { path: "userId" });

   //     console.log("Total unique users with subscriptions:", orders);
        for (const order of orders) {
            const endDate = moment(new Date(order.endDate)).startOf("day");
            const daysLeft = endDate.diff(today, "days");
            const daysPast = today.diff(endDate, "days");

            //   console.log("Checking:", order);

            const frontendBaseUrl = process.env.FRONTEND_URL || "https://apps.technians.com";
            const renewUrl = `${frontendBaseUrl}/pricing`;
            const reactivateUrl = renewUrl;

            const userEmail = order?.userId?.email;
            const userName = order.userId
                ? `${order.userId.firstName} ${order.userId.lastName}`
                : "there";

            // skip if no email
            if (!userEmail) {
                console.warn("⚠️ Skipping order, no email found:", order._id);
                continue;
            }

            // helper to send
            const sendNow = async (subject, html) => {
                const mailOptions = {
                    from: 'hey@mimz.com',
                    to: userEmail,
                    subject,
                    html,
                };
                console.log(`📧 Sending email → ${userEmail} | ${subject}`);
                await transporter.sendMail(mailOptions);
            };

            // 1️⃣ Reminder emails
            if (daysLeft >= 0 && daysLeft <= 10) {
                const subject = getSubject({
                    planType: order.subCriptionType,
                    daysLeft,
                    state: "reminder"
                });

                const html = reminderHtml({
                    userName,
                    planType: order.subCriptionType,
                    daysLeft,
                    endDate: order.endDate,
                    renewUrl
                });

                await sendNow(subject, html);
            }

            // 2️⃣ On expiry day
            if (daysPast === 0) {
                const subject = getSubject({
                    planType: order.subCriptionType,
                    state: "expired"
                });

                const html = expiredHtml({
                    userName,
                    planType: order.subCriptionType,
                    endDate: order.endDate,
                    renewUrl,
                    graceDays: order.subCriptionType === "monthly" ? 7 : 21
                });

                await sendNow(subject, html);
            }

            // 3️⃣ After grace period → deactivate + suspension email
            if (order.subCriptionType === "monthly" && daysPast > 7) {
                order.status = "due";
                await order.save();

                const subject = getSubject({
                    planType: order.subCriptionType,
                    state: "due"
                });

                const html = suspendedHtml({
                    userName,
                    planType: order.subCriptionType,
                    reactivateUrl
                });

                await sendNow(subject, html);
            }

            if (order.subCriptionType === "yearly" && daysPast > 21) {
                order.status = "deactive";
                await order.save();

                const subject = getSubject({
                    planType: order.subCriptionType,
                    state: "suspended"
                });

                const html = suspendedHtml({
                    userName,
                    planType: order.subCriptionType,
                    reactivateUrl
                });

                await sendNow(subject, html);
            }
        }


    } catch (err) {
        console.error("❌ Subscription cron job failed:", err);
    }

});

// using this function for testing by enable route in index.js and all after running the server
// async function subscriptionJob() {

//     const today = moment().startOf("day");
//     try {

//         let orders = await Usersubscription.aggregate([
//             {
//                 $match: {
//                     status: { $in: ["active", "deactive", "due"] }
//                 }
//             },
//             {
//                 $addFields: {
//                     // pick whichever date is later
//                     effectiveDate: {
//                         $cond: {
//                             if: { $gt: ["$updatedAt", "$endDate"] },
//                             then: "$updatedAt",
//                             else: "$endDate"
//                         }
//                     },
//                     // label which one was used
//                     effectiveSource: {
//                         $cond: {
//                             if: { $gt: ["$updatedAt", "$endDate"] },
//                             then: "updatedAt",
//                             else: "endDate"
//                         }
//                     }
//                 }
//             },
//             {
//                 $sort: { effectiveDate: -1 }
//             },
//             {
//                 $group: {
//                     _id: "$userId",
//                     lastOrder: { $first: "$$ROOT" }
//                 }
//             },
//             {
//                 $replaceRoot: { newRoot: "$lastOrder" }
//             }
//         ]);

//         // populate user details
//         orders = await Usersubscription.populate(orders, { path: "userId" });

//           console.log("Total unique users with subscriptions:", orders);
//         for (const order of orders) {
//             const endDate = moment(new Date(order.endDate)).startOf("day");
//             const daysLeft = endDate.diff(today, "days");
//             const daysPast = today.diff(endDate, "days");

//             //   console.log("Checking:", order);

//             const frontendBaseUrl = process.env.FRONTEND_URL || "https://apps.technians.com";
//             const renewUrl = `${frontendBaseUrl}/pricing`;
//             const reactivateUrl = renewUrl;

//             const userEmail = order?.userId?.email;
//             const userName = order.userId
//                 ? `${order.userId.firstName} ${order.userId.lastName}`
//                 : "there";

//             // skip if no email
//             if (!userEmail) {
//                 console.warn("⚠️ Skipping order, no email found:", order._id);
//                 continue;
//             }

//             // helper to send
//             const sendNow = async (subject, html) => {
//                 const mailOptions = {
//                     from: 'support@syncspace.com',
//                     to: userEmail,
//                     subject,
//                     html,
//                 };
//                 console.log(`📧 Sending email → ${userEmail} | ${subject}`);
//                 await transporter.sendMail(mailOptions);
//             };

//             // 1️⃣ Reminder emails
//             if (daysLeft >= 0 && daysLeft <= 10) {
//                 const subject = getSubject({
//                     planType: order.subCriptionType,
//                     daysLeft,
//                     state: "reminder"
//                 });

//                 const html = reminderHtml({
//                     userName,
//                     planType: order.subCriptionType,
//                     daysLeft,
//                     endDate: order.endDate,
//                     renewUrl
//                 });

//                 await sendNow(subject, html);
//             }

//             // 2️⃣ On expiry day
//             if (daysPast === 0) {
//                 const subject = getSubject({
//                     planType: order.subCriptionType,
//                     state: "expired"
//                 });

//                 const html = expiredHtml({
//                     userName,
//                     planType: order.subCriptionType,
//                     endDate: order.endDate,
//                     renewUrl,
//                     graceDays: order.subCriptionType === "monthly" ? 7 : 21
//                 });

//                 await sendNow(subject, html);
//             }

//             // 3️⃣ After grace period → deactivate + suspension email
//             if (order.subCriptionType === "monthly" && daysPast > 7) {
//                 order.status = "due";
//                 await order.save();

//                 const subject = getSubject({
//                     planType: order.subCriptionType,
//                     state: "suspended"
//                 });

//                 const html = suspendedHtml({
//                     userName,
//                     planType: order.subCriptionType,
//                     reactivateUrl
//                 });

//                 await sendNow(subject, html);
//             }

//             if (order.subCriptionType === "yearly" && daysPast > 21) {
//                 order.status = "deactive";
//                 await order.save();

//                 const subject = getSubject({
//                     planType: order.subCriptionType,
//                     state: "suspended"
//                 });

//                 const html = suspendedHtml({
//                     userName,
//                     planType: order.subCriptionType,
//                     reactivateUrl
//                 });

//                 await sendNow(subject, html);
//             }
//         }


//     } catch (err) {
//         console.error("❌ Subscription cron job failed:", err);
//     }



// }
// module.exports = subscriptionJob;
