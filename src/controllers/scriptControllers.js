const { default: mongoose } = require("mongoose")
const ErrorHandler = require("../utils/errorHandler")
const User = require("../models/user.model")
const Campaign = require('../models/user.campaign.model')
const EmailActivity = require('../models/emailActivity.model');
const SMSActivity = require('../models/SMSActivity.model');
const Usersubscription = require('../models/user.subscription.model');
const packageModel = require("./../models/packageModel");
const Usercampaign = require("../models/user.campaign.model");
const { sendWhatsApp } = require('../utils/whatsappHelper');
const whatsappLogger = require('../utils/whatsappLogger');
const campaignLogger = require('../utils/campaignLogger');

const userMailCredentials = require('../models/userMailCredentials.model');
const nodemailer = require("nodemailer");
const Experiment = require('../models/experiment.model');
const Variant = require('../models/variant.model');
const { buildAbLoaderScript } = require('../utils/abLoaderScript');
const sendSendGridMailforuser = require('../utils/sendGridMailerforUser'); // your mailer

exports.getScripts = async (req, res, next) => {
    try {
        const userId = req.query.clientId;
        if (!userId) return next(new ErrorHandler('Please provide a client Id'));

        // Special case: standalone form tracking script
        if (userId === 'htmlFormTrackingScript') {
            const fs = require('fs');
            const path = require('path');
            const scriptPath = path.join(__dirname, '../scripts/scripts-htmlFormTrackingScript.js');

            try {
                const scriptContent = fs.readFileSync(scriptPath, 'utf8');
                return res.type('application/javascript').send(scriptContent);
            } catch (error) {
                console.error('Error reading form tracking script:', error);
                return next(new ErrorHandler('Error fetching form tracking script'));
            }
        }

        // Fetch user and active scripts
        const aggregateQuery = [
            { $match: { _id: new mongoose.Types.ObjectId(userId) } },
            {
                $lookup: {
                    from: 'scripts',
                    let: { userId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$userId', '$$userId'] },
                                        { $eq: ['$isDelete', false] },
                                        { $eq: ['$isActive', true] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'scripts'
                }
            }
        ];

        const [user] = await User.aggregate(aggregateQuery);
        if (!user) return next(new ErrorHandler('No data found.'));
        if (user.isDeleted) return next(new ErrorHandler('User Deactivated.'));

        const normalize = (url) => {
            if (!url) return "";
            try {
                let urlWithProtocol = url;
                if (!/^https?:\/\//i.test(url)) {
                    urlWithProtocol = 'http://' + url;
                }
                const u = new URL(urlWithProtocol);
                const host = u.port ? `${u.hostname}:${u.port}` : u.hostname;
                return (host + u.pathname).replace(/\/$/, "");
            } catch {
                return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
            }
        };


        // Current referrer
        const referrer = req.headers.referer || req.headers.referrer || '';

        let domain = 'localhost';
        let pathName = '/';
        if (referrer) {
            try {
                const url = new URL(referrer);
                domain = url.port ? `${url.hostname}:${url.port}` : url.hostname;       // dev.technians.com
                pathName = url.pathname;     // /newuser/ddsfs
            } catch { }
        }
        const fullDomain = normalize(domain + pathName); // dev.technians.com/newuser/ddsfs

        // Check if any active website matches or is a parent
        const isDomainAllowed = user.websites?.some(site => {
            const siteUrl = normalize(site.website); // e.g. dev.technians.com/newuser
            return site?.isActive && (
                fullDomain === siteUrl ||          // exact match
                siteUrl.startsWith(fullDomain + "/") || // site is under current domain
                fullDomain.startsWith(siteUrl + "/")    // current domain is under site
            );
        }) || false;




        // Check if current domain is allowed
        //  const isDomainAllowed = user.websites?.some(site => site?.isActive && normalize(site.website) === domain) || false;
        if (!isDomainAllowed) {
            return res.type("application/javascript").send(`
        console.log("Not allowed on this site.");
        console.log("Referrer fullDomain:", ${JSON.stringify(fullDomain)});
        console.log("Allowed websites:", ${JSON.stringify(user.websites.map(s => normalize(s.website)))});
    `);
        }

        // Fetch active, published campaigns. A/B test variant clones
        // (isABTesting:true) are excluded here — they're never served
        // unconditionally; they only get served through the weighted
        // traffic-allocation step below, so a running experiment can't
        // ever show every variant to every visitor at once.
        const campaigns = await Usercampaign.find({ clientId: userId, isActive: true, status: 'published', isABTesting: { $ne: true } });

        // Filter campaigns matching any active website
        // Step 1: Find active websites matching current domain
        const activeSitesForDomain = user.websites.filter(site => {
            const siteUrl = normalize(site.website);
            return site.isActive && (fullDomain === siteUrl ||          // exact match
                siteUrl.startsWith(fullDomain + "/") || // site is under current domain
                fullDomain.startsWith(siteUrl + "/")
            );
        });

        // Step 2: Filter campaigns that belong to these active websites
        const matchedCampaigns = campaigns.filter(campaign =>
            activeSitesForDomain.some(site =>
                site._id?.toString() === campaign.websiteId?.toString()
            )
        );

        /* ===========================
           A/B Testing — traffic allocation
           For every matched campaign that is the parent of a *running*
           experiment with at least one published variant, pull that
           campaign out of the normal "always load" list. The actual
           variant-vs-control choice is made client-side (see the loader
           below) so each visitor is weighted-randomly assigned once and
           stays on that assignment via a cookie. If an experiment has no
           published variants yet, its parent campaign is left in the
           normal list and just serves as-is.
        =========================== */
        let abConfig = [];
        const abExcludedCampaignIds = new Set();

        if (matchedCampaigns.length) {
            const matchedCampaignIds = matchedCampaigns.map(c => c._id);
            console.log('🧪 [AB DEBUG] matchedCampaigns for this domain:', matchedCampaigns.map(c => ({ id: c._id.toString(), name: c.name || c.campaigndesignerName })));

            const runningExperiments = await Experiment.find({
                campaignId: { $in: matchedCampaignIds },
                status: 'running'
            });
            console.log('🧪 [AB DEBUG] running experiments whose campaignId is in matchedCampaigns:', runningExperiments.map(e => ({ id: e._id.toString(), campaignId: e.campaignId?.toString(), status: e.status })));

            // Also log ALL experiments tied to these campaigns regardless of
            // status, so a status/campaignId mismatch is obvious in the logs
            // even when the runningExperiments query above comes back empty.
            const allExpForMatched = await Experiment.find({ campaignId: { $in: matchedCampaignIds } });
            console.log('🧪 [AB DEBUG] ALL experiments (any status) tied to matchedCampaigns:', allExpForMatched.map(e => ({ id: e._id.toString(), campaignId: e.campaignId?.toString(), status: e.status })));

            for (const exp of runningExperiments) {
                const variants = await Variant.find({ experimentId: exp._id, campaignId: { $ne: null } }).populate('campaignId');
                console.log(`🧪 [AB DEBUG] experiment ${exp._id} has ${variants.length} variant(s) with a linked campaign:`, variants.map(v => ({
                    variantId: v._id.toString(),
                    name: v.name,
                    isPublished: v.isPublished,
                    linkedCampaignId: v.campaignId?._id?.toString(),
                    linkedCampaignIsActive: v.campaignId?.isActive,
                    linkedCampaignStatus: v.campaignId?.status
                })));

                const publishedVariants = variants.filter(v => v.campaignId && v.campaignId.isActive && v.campaignId.status === 'published');
                if (!publishedVariants.length) {
                    console.log(`🧪 [AB DEBUG] experiment ${exp._id} has NO published variants — skipping AB allocation, parent campaign will serve normally.`);
                    continue;
                }

                abExcludedCampaignIds.add(exp.campaignId.toString());
                variants.forEach(v => { if (v.campaignId) abExcludedCampaignIds.add(v.campaignId._id.toString()); });

                abConfig.push({
                    experimentId: exp._id.toString(),
                    variants: publishedVariants.map(v => ({
                        campaignId: v.campaignId._id.toString(),
                        weight: v.weight || 1
                    }))
                });
            }
        }

        console.log('🧪 [AB DEBUG] final abConfig sent to browser:', JSON.stringify(abConfig));

        const nonAbMatchedCampaigns = matchedCampaigns.filter(c => !abExcludedCampaignIds.has(c._id.toString()));

        const mainScript = `${user._id}-main.js`;
        const scriptFileNames = (user.scripts || []).map(s => s.name).filter(Boolean);
        const allowedScripts = [mainScript, ...nonAbMatchedCampaigns.map(c => `${c.clientId}-${c._id}.js`)];

        // Ensure mainScript exists
        if (!scriptFileNames.includes(mainScript)) {
            const fs = require('fs');
            const path = require('path');
            const scriptsDir = path.join(__dirname, '..', 'scripts');
            const filePath = path.join(scriptsDir, mainScript);

            if (fs.existsSync(filePath)) {
                console.log(`Main script file found on disk but missing in DB. Registering in DB for user ${user._id}`);
                const scriptModel = require("../models/scriptModel");
                await scriptModel.create({
                    name: mainScript,
                    userId: user._id,
                    isActive: true
                });
                scriptFileNames.push(mainScript);
            } else {
                console.log(`Main script file not found on disk or DB for user ${user._id}. Regenerating it...`);
                const { createMainScript } = require("../utils/scriptUtils");
                try {
                    await createMainScript(user);
                    scriptFileNames.push(mainScript);
                } catch (err) {
                    console.error('Error generating main script on the fly:', err);
                }
            }
        }

        // Loader for main + campaign scripts
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}/scripts`;
        const apiBase = `${protocol}://${host}/api`;
        const loader = buildAbLoaderScript({
            matchedCampaignIds: matchedCampaigns.map(c => c._id),
            activeSiteIds: activeSitesForDomain.map(s => s._id),
            allowedScripts,
            scriptsBaseUrl: baseUrl,
            apiBaseUrl: apiBase,
            clientId: user._id,
            abConfig
        });

        // Find push-enabled website for this domain
        const pushWebsite = user.websites.find(site =>
            site.isActive &&
            site.pushEnabled &&
            (fullDomain === normalize(site.website) ||
                site.website.includes(domain) ||
                domain.includes(normalize(site.website)))
        );

        let pushScript = '';
        if (pushWebsite) {
            const pushMessage = pushWebsite.pushMessage || "Enable notifications for updates?";
            const websiteId = pushWebsite._id.toString();
            const userIdStr = user._id.toString();

            pushScript = `(function() {
  if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) return;

  const VAPID_PUBLIC_KEY = 'BJ0wd3yMehxh_RjMa0UJ1HHGS4_bsViADz5ryOb9R7GKQ95970GuI_pcVy8oXAkrR3J7PnTDR8_R7ww99ON4lCc';
  const STORAGE_KEY = 'push_banner_shown_${websiteId}';
  const BANNER_HIDE_DAYS = 7;

  function urlB64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
  }

  // Check if banner was shown in last 7 days
  const lastShown = localStorage.getItem(STORAGE_KEY);
  if (lastShown && (Date.now() - parseInt(lastShown)) < BANNER_HIDE_DAYS * 24 * 60 * 60 * 1000) {
    return;
  }

  function renderBanner() {
    const banner = document.createElement('div');
    banner.id = 'push-optin-banner';
    banner.style.cssText = \`
      position: fixed;
      bottom: 24px;
      right: 24px;
      max-width: 360px;
      background: linear-gradient(135deg, #4caf50, #388e3c);
      color: #fff;
      font-family: 'Arial', sans-serif;
      font-size: 14px;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(0,0,0,0.35);
      display: flex;
      flex-direction: column;
      gap: 12px;
      z-index: 2147483647;
      animation: slideIn 0.5s ease forwards;
    \`;

    banner.innerHTML = \`<div style="font-weight:600; margin-bottom:8px;">${pushMessage}</div>\`;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.justifyContent = 'flex-end';

    const allow = document.createElement('button');
    const decline = document.createElement('button');
    allow.textContent = 'Allow';
    decline.textContent = 'No thanks';
    allow.style.cssText = 'background:#fff;color:#4caf50;border:none;padding:8px 14px;font-weight:600;border-radius:6px;cursor:pointer;';
    decline.style.cssText = 'background:transparent;border:1px solid #fff;color:#fff;padding:8px 14px;font-weight:600;border-radius:6px;cursor:pointer;';

    actions.appendChild(decline);
    actions.appendChild(allow);
    banner.appendChild(actions);
    document.body.appendChild(banner);

    const style = document.createElement('style');
    style.innerHTML = \`
      @keyframes slideIn { 0% { transform: translateX(400px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
    \`;
    document.head.appendChild(style);

    function hideBanner() {
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
      banner.remove();
    }

    allow.addEventListener('click', () => {
      Notification.requestPermission().then(res => {
        if (res === 'granted') {
          subscribeUser().then(subscription => {
            const visitorId = document.cookie.replace(/(?:(?:^|.*;\\s*)visitorId\\s*\\=\\s*([^;]*).*$)|^.*$/, "$1");
            const domain = window.location.hostname;
            return fetch('http://localhost:5008/api/auth/websites/push/save-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: '${userIdStr}',
                websiteId: '${websiteId}',
                visitorId,
                domain,
                subscription,
                subscribedAt: new Date().toISOString()
              })
            });
          }).then(hideBanner).catch(console.warn);
        } else {
          hideBanner();
        }
      });
    });

    decline.addEventListener('click', hideBanner);
  }

  function subscribeUser() {
    return navigator.serviceWorker.register('/sw.js')
      .then(reg => reg.pushManager.getSubscription()
        .then(sub => sub || reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
        }))
      );
  }

  function init() {
    renderBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();
})();`;


            // pushScript = `(function() {
            //   if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) return;

            //   const VAPID_PUBLIC_KEY = 'BJ0wd3yMehxh_RjMa0UJ1HHGS4_bsViADz5ryOb9R7GKQ95970GuI_pcVy8oXAkrR3J7PnTDR8_R7ww99ON4lCc';

            //   function urlB64ToUint8Array(base64String) {
            //     const padding = '='.repeat((4 - base64String.length % 4) % 4);
            //     const base64 = (base64String + padding)
            //       .replace(/-/g, '+')
            //       .replace(/_/g, '/');
            //     const rawData = atob(base64);
            //     return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
            //   }

            //   // Get visitorId from cookie
            //   function getVisitorId() {
            //     const match = document.cookie.match(new RegExp('(^| )visitorId=([^;]+)'));
            //     return match ? match[2] : null;
            //   }
            //   const visitorId = getVisitorId();

            //   function renderBanner(onAllow, onDeny) {
            //     const banner = document.createElement('div');
            //     banner.id = 'push-optin-banner';
            //     banner.style.cssText = \`
            //       position: fixed;
            //       bottom: 24px;
            //       right: 24px;
            //       max-width: 360px;
            //       background: linear-gradient(135deg, #4caf50, #388e3c);
            //       color: #fff;
            //       font-family: 'Arial', sans-serif;
            //       font-size: 14px;
            //       padding: 20px;
            //       border-radius: 12px;
            //       box-shadow: 0 12px 28px rgba(0,0,0,0.35);
            //       display: flex;
            //       flex-direction: column;
            //       gap: 12px;
            //       z-index: 2147483647;
            //       animation: slideIn 0.5s ease forwards;
            //     \`;

            //     banner.innerHTML = \`<div style="font-weight:600; margin-bottom:8px;">${pushMessage}</div>\`;

            //     const actions = document.createElement('div');
            //     actions.style.display = 'flex';
            //     actions.style.gap = '8px';
            //     actions.style.justifyContent = 'flex-end';

            //     const allow = document.createElement('button');
            //     const decline = document.createElement('button');

            //     allow.textContent = 'Allow';
            //     decline.textContent = 'No thanks';

            //     allow.style.cssText = 'background:#fff;color:#4caf50;border:none;padding:8px 14px;font-weight:600;border-radius:6px;cursor:pointer;transition: all 0.2s;';
            //     decline.style.cssText = 'background:transparent;border:1px solid #fff;color:#fff;padding:8px 14px;font-weight:600;border-radius:6px;cursor:pointer;transition: all 0.2s;';

            //     allow.addEventListener('mouseenter', ()=> allow.style.background='#f1f1f1');
            //     allow.addEventListener('mouseleave', ()=> allow.style.background='#fff');
            //     decline.addEventListener('mouseenter', ()=> decline.style.background='rgba(255,255,255,0.2)');
            //     decline.addEventListener('mouseleave', ()=> decline.style.background='transparent');

            //     actions.appendChild(decline);
            //     actions.appendChild(allow);
            //     banner.appendChild(actions);
            //     document.body.appendChild(banner);

            //     const style = document.createElement('style');
            //     style.innerHTML = \`
            //       @keyframes slideIn {
            //         0% { transform: translateX(400px); opacity: 0; }
            //         100% { transform: translateX(0); opacity: 1; }
            //       }
            //     \`;
            //     document.head.appendChild(style);

            //     allow.addEventListener('click', () => {
            //       Notification.requestPermission().then(res => {
            //         if (res === 'granted') {
            //           subscribeUser()
            //             .then(subscription => {
            //               return fetch('http://localhost:5008/api/auth/websites/push/save-subscription', {
            //                 method: 'POST',
            //                 headers: { 'Content-Type': 'application/json' },
            //                 body: JSON.stringify({
            //                   userId: '${userIdStr}',
            //                   websiteId: '${websiteId}',
            //                   visitorId: visitorId,  // <-- include visitorId here
            //                       domain: window.location.hostname,
            //                   subscription: subscription,
            //                   subscribedAt: new Date().toISOString()
            //                 })
            //               });
            //             })
            //             .then(() => banner.remove())
            //             .catch(console.warn);
            //         } else {
            //           banner.remove();
            //         }
            //       });
            //     });

            //     decline.addEventListener('click', () => {
            //       onDeny();
            //       banner.remove();
            //     });
            //   }

            //   function subscribeUser() {
            //     return navigator.serviceWorker.register('/sw.js')
            //       .then(reg => {
            //         if (reg.installing) {
            //           return new Promise(resolve => {
            //             reg.installing.addEventListener('statechange', () => {
            //               if (reg.active) resolve(reg);
            //             });
            //           });
            //         } else if (reg.waiting) {
            //           return new Promise(resolve => {
            //             reg.waiting.addEventListener('statechange', () => {
            //               if (reg.active) resolve(reg);
            //             });
            //           });
            //         } else {
            //           return reg;
            //         }
            //       })
            //       .then(reg => reg.pushManager.getSubscription()
            //         .then(sub => sub || reg.pushManager.subscribe({
            //           userVisibleOnly: true,
            //           applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
            //         }))
            //       );
            //   }

            //   function init() {
            //     renderBanner(() => {}, () => {}); // always show
            //   }

            //   if (document.readyState === 'loading') {
            //     document.addEventListener('DOMContentLoaded', init);
            //   } else init();
            // })();`;



        }



        // Cookie consent
        const cookieContent = user.cookieContent || 'This website uses cookies to enhance your browsing experience.';
        const loader2 = `
${loader}
(function showCookieConsent() {
  const COOKIE_NAME = "cookie_consent";
  function setConsentCookie(value) { document.cookie = COOKIE_NAME + "=" + value + "; path=/; max-age=31536000; SameSite=Lax"; }
  function hasConsent() { return document.cookie.split('; ').some(row => row.startsWith(COOKIE_NAME + '=accepted')); }
  function addBanner() {
    if (hasConsent()) return;
    const banner = document.createElement('div');
    banner.setAttribute('role','alert');
    banner.style.position="fixed"; banner.style.bottom="0"; banner.style.left="0";
    banner.style.width="100%"; banner.style.background="linear-gradient(90deg,#f7f7f7 0%,#d1d5db 100%)";
    banner.style.color="#111"; banner.style.textAlign="center"; banner.style.fontSize="14px";
    banner.style.fontWeight="600"; banner.style.letterSpacing="0.03em"; banner.style.padding="12px 20px";
    banner.style.boxShadow="0 -2px 10px rgba(0,0,0,0.1)"; banner.style.zIndex="9999"; banner.style.display="flex";
    banner.style.justifyContent="center"; banner.style.alignItems="center"; banner.style.gap="10px";
    banner.style.flexWrap="wrap"; banner.style.opacity="0"; banner.style.transition="opacity 0.5s ease";

    banner.innerHTML = '<span>${cookieContent}</span><div style="display:flex;gap:8px;">' +
      '<button style="background-color:#3b82f6;color:white;border:none;padding:8px 14px;font-weight:600;border-radius:4px;cursor:pointer;">Accept</button></div>';

    const acceptBtn = banner.querySelector('button');
    acceptBtn.addEventListener('mouseenter',()=>acceptBtn.style.backgroundColor='#2563eb');
    acceptBtn.addEventListener('mouseleave',()=>acceptBtn.style.backgroundColor='#3b82f6');
    acceptBtn.addEventListener('click',()=>{setConsentCookie("accepted"); banner.style.opacity='0'; setTimeout(()=>banner.remove(),400);});

    document.body.appendChild(banner);
    requestAnimationFrame(()=>{banner.style.opacity="1";});
  }
  if(document.body) addBanner(); else window.addEventListener('load', addBanner);
})();
`;
        const finalScript = user.showCookiePopup ? loader2 + pushScript : loader + pushScript;
        res.type("application/javascript").send(finalScript);

        // res.type("application/javascript").send(user.showCookiePopup ? loader2 : loader);

    } catch (error) {
        return next(error);
    }
};


const fs = require('fs').promises;
const path = require('path');
const { createMainScript } = require("../utils/scriptUtils");
const scriptModel = require("../models/scriptModel");
const { getTemplate } = require("../template/editorTemplate");
const sendEmail = require("../utils/mailer");
const sendSendGridMail = require("../utils/sendGridMailer"); //we are not using this
const { sendSMS } = require("../utils/smsHelper");
const { sendEmailCampaign } = require("../utils/emailHelper");
const { extractPlainText } = require("../utils/helper");


exports.createMainScript = async (req, res, next) => {
    try {
        const users = await User.find();

        if (users && users.length) {
            for (let i = 0; i < users.length; i++) {
                const user = users[i];
                const fileName = `${user._id}-main.js`;

                const scriptsDir = path.join(__dirname, '..', 'scripts');
                const filePath = path.join(scriptsDir, fileName);

                if (fs.existsSync(filePath)) {
                    console.log(`File exists: ${fileName}`);
                    const scriptData = await scriptModel.findOne({ name: fileName })
                    if (!scriptData) {
                        const sPayload = {
                            name: fileName,
                            isActive: true,
                            userId: user._id
                        }
                        await scriptModel.create(sPayload)
                    }
                } else {
                    await createMainScript(user)
                }
            }
        }

        res.status(200).json({ message: 'File check complete' });

    } catch (error) {
        next(error);
    }
};

// Force-regenerate a single user's main.js from the current getMainScript
// template, unconditionally — unlike getScripts's own on-the-fly regeneration
// (which only kicks in when the Script DB record is missing) and unlike
// createMainScript above (which skips any user whose file already exists on
// disk), this always overwrites. Use this after changing the getMainScript
// template in scriptUtils.js to push that change out to an already-onboarded
// test account without having to touch the database by hand.
exports.regenerateMainScript = async (req, res, next) => {
    try {
        const clientId = req.query.clientId || req.params.clientId;
        if (!clientId) return next(new ErrorHandler('Please provide a client Id'));

        const user = await User.findById(clientId);
        if (!user) return next(new ErrorHandler('No data found.'));

        await createMainScript(user);

        return res.status(200).json({
            success: true,
            message: `Regenerated ${user._id}-main.js from the current template.`
        });
    } catch (error) {
        next(error);
    }
};

// exports.sendMail = async (req, res, next) => {
//     try {
//         const {templateId, email } = req.body
//         const template = await Campaign.findById(templateId)

//         if(template && template.elements && template.elements.length){
//             const mailHtml = getTemplate(template.elements)
//             const data = await sendSendGridMail({email, subject: template.subject, mailHtml})
//         }

//         res.json({
//             success: true,
//             message: "Email Sent successfully."
//         })
//     } catch (error) {
//         next(error);
//     }
// };

exports.sendMail = async (req, res, next) => {
    try {

        const { templateId, email, userId } = req.body;

        const template = await Campaign.findById(templateId);
        if (!template || !template.elements?.length) {
            return res.status(400).json({ success: false, message: "Invalid or empty template." });
        }

        const subscription = await getActiveSubscription(userId);

        let maxMail = subscription?.packageDetails?.emailLimit;
        let subscriptionStartDate = subscription?.createdAt;

        if (!subscription || !maxMail) {
            const fallback = await packageModel.findOne({ isDefault: true });
            if (!fallback || !fallback.emailLimit) {
                return res.status(400).json({ message: "No valid subscription or fallback package found." });
            }
            maxMail = fallback.emailLimit;
            subscriptionStartDate = fallback.createdAt;
        }

        const latestSubscription = await Usersubscription.findOne({ userId: new mongoose.Types.ObjectId(userId), status: "deactive" }).sort({ createdAt: -1 });

        let remainEmails;
        if (latestSubscription && typeof latestSubscription.remainEmail === "number") {
            remainEmails = maxMail - latestSubscription.remainEmail;
        } else {
            remainEmails = maxMail
        }

        const sentEmails = await EmailActivity.countDocuments({
            userId,
            status: "sent",
            createdAt: { $gte: subscriptionStartDate }
        });

        if (sentEmails >= remainEmails) {
            console.log(`⚠️ Email limit reached (${sentEmails}/${remainEmails}), but bypassing to allow unlimited sends.`);
            // return res.status(400).json({
            //     message: `Email limit reached. Maximum allowed: ${remainEmails}`
            // });
        }

        const mailHtml = getTemplate(template.elements);

        let status = "sent";
        let errorMessage = "";

        try {
            const cred = await userMailCredentials.findOne({ userId, active: true });
            if (!cred) {
                throw new Error("No active email credentials configured for this user.");
            }

            if (cred.platform === 'sendGrid') {
                await sendSendGridMailforuser({ email, subject: template.subject, mailHtml });
            } else if (cred.platform === 'custom') {
                const transporter = nodemailer.createTransport({
                    host: cred.credentials.smtpHost,
                    port: cred.credentials.smtpPort,
                    secure: Number(cred.credentials.smtpPort) === 465,
                    auth: {
                        user: cred.credentials.smtpUser,
                        pass: cred.credentials.smtpPassword,
                    },
                    tls: {
                        rejectUnauthorized: false,
                    },
                });

                const mailOptions = {
                    from: cred.credentials.smtpUser,
                    to: email,
                    subject: template.subject || 'Campaign Email',
                    html: mailHtml
                };

                await transporter.sendMail(mailOptions);
                console.log('Custom SMTP Email sent successfully via sendMail');
            } else {
                throw new Error(`Unsupported email platform: ${cred.platform}`);
            }
        } catch (err) {
            status = "failed";
            errorMessage = err.message;
        }

        await EmailActivity.create({
            userId,
            to: email,
            subject: template.subject,
            status,
            sentAt: new Date(),
            campaignId: templateId
        });

        if (status === "sent") {
            const newRemain = Math.max(0, (remainEmails - 1) - sentEmails);
            await Usersubscription.updateOne(
                { userId: new mongoose.Types.ObjectId(userId), status: "active" },
                { $set: { remainEmail: newRemain } }
            );
        }

        return res.json({
            success: status === "sent",
            message: status === "sent" ? "Email sent successfully." : `Email failed: ${errorMessage}`
        });

    } catch (error) {
        next(error);
    }
};

const getActiveSubscription = async (userId) => {
    const objectClientId = new mongoose.Types.ObjectId(userId);

    const [subscription] = await Usersubscription.aggregate([
        { $match: { userId: objectClientId, status: "active" } },
        { $sort: { createdAt: -1 } },
        { $limit: 1 },
        {
            $lookup: {
                from: "packages",
                localField: "subCriptionId",
                foreignField: "_id",
                as: "packageDetails"
            }
        },
        {
            $unwind: {
                path: "$packageDetails",
                preserveNullAndEmptyArrays: true
            }
        }
    ]);

    return subscription || null;
};

// exports.sendSMS = async (req, res, next) => {
//     try {

//         console.log(req.body)

//         const { templateId, contact } = req.body
//         const template = await Campaign.findById(templateId)
//         if (template && template.elements && template.elements.length) {
//             const plainText = extractPlainText(template.elements)
//             const messageObj = {
//                 srcNumber: "+919559333592",
//                 dstNumber: contact,
//                 message: plainText
//             }

//             await sendSMS(messageObj)
//             res.json({
//                 success: true,
//                 message: "SMS send successfully."
//             })
//         }
//         return next(new ErrorHandler('Failed to send SMS'))

//     } catch (error) {
//         next(error);
//     }
// };

exports.sendSMS = async (req, res, next) => {
    try {
        console.log('📱 SMS API Call Received:', {
            timestamp: new Date().toISOString(),
            body: req.body
        });

        const { templateId, contact, userId, visitorId, visitId } = req.body;

        console.log('🔍 SMS Request Details:', {
            templateId,
            contact: contact ? contact.substring(0, 4) + '***' + contact.substring(-4) : null,
            userId,
            hasTemplateId: !!templateId,
            hasContact: !!contact,
            hasUserId: !!userId
        });

        const template = await Campaign.findById(templateId);
        console.log('📋 Template Lookup Result:', {
            found: !!template,
            templateName: template?.name,
            hasElements: template?.elements?.length > 0,
            elementCount: template?.elements?.length || 0
        });

        if (!template || !template.elements?.length) {
            console.log('❌ Template validation failed');
            return res.status(400).json({ success: false, message: "Invalid or empty template." });
        }

        console.log('✅ Template validation passed, checking subscription...');

        const subscription = await getActiveSubscription(userId);
        console.log('💳 Subscription Check:', {
            found: !!subscription,
            maxSMS: subscription?.packageDetails?.SMSLimit,
            subscriptionStartDate: subscription?.createdAt
        });

        let maxSMS = subscription?.packageDetails?.SMSLimit;
        let subscriptionStartDate = subscription?.createdAt;

        if (!subscription || !maxSMS) {
            console.log('⚠️ No subscription found, using fallback package...');
            const fallback = await packageModel.findOne({ isDefault: true });
            console.log('🔄 Fallback Package:', {
                found: !!fallback,
                maxSMS: fallback?.SMSLimit
            });

            if (!fallback || !fallback.SMSLimit) {
                console.log('❌ No valid subscription or fallback package found');
                return res.status(400).json({ message: "No valid subscription or fallback package found." });
            }
            maxSMS = fallback.SMSLimit;
            subscriptionStartDate = fallback.createdAt;
        }

        const latestSubscription = await Usersubscription.findOne({ userId: new mongoose.Types.ObjectId(userId), status: "deactive" }).sort({ createdAt: -1 });

        let remainSMSs;
        if (latestSubscription && typeof latestSubscription.remainSMS === "number") {
            remainSMSs = maxSMS - latestSubscription.remainSMS;
        } else {
            remainSMSs = maxSMS;
        }

        console.log('📊 SMS Limit Check:', {
            maxSMS,
            remainSMSs,
            subscriptionStartDate
        });

        const sentSMS = await SMSActivity.countDocuments({
            userId,
            status: "sent",
            createdAt: { $gte: subscriptionStartDate }
        });

        console.log('📈 SMS Usage:', {
            sentSMS,
            remainSMSs,
            canSend: sentSMS < remainSMSs
        });

        if (sentSMS >= remainSMSs) {
            console.log(`⚠️ SMS limit reached (${sentSMS}/${remainSMSs}), but bypassing to allow unlimited sends.`);
            // return res.status(400).json({
            //     message: `SMS limit reached. Maximum allowed: ${remainSMSs}`
            // });
        }

        console.log('✅ SMS limit check passed, preparing message...');

        const plainText = extractPlainText(template.elements);
        console.log('📝 Message Content:', {
            length: plainText.length,
            preview: plainText.substring(0, 50) + (plainText.length > 50 ? '...' : ''),
            templateName: template.name
        });

        const messageObj = {
            dstNumber: contact,
            message: plainText,
            userId: userId
        };

        console.log('📤 SMS Message Object:', {
            dstNumber: contact.substring(0, 4) + '***' + contact.substring(-4),
            messageLength: plainText.length,
            timestamp: new Date().toISOString()
        });

        let status = "sent";
        let errorMessage = "";

        console.log('🚀 Attempting to send SMS via Twilio...');
        try {
            const result = await sendSMS(messageObj);
            if (!result || !result.success) {
                throw new Error(result?.message || "Failed to send SMS via Twilio");
            }
            console.log('✅ SMS sent successfully via Twilio:', {
                messageSid: result?.sid,
                status: result?.status,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('❌ SMS send failed:', {
                error: err.message,
                timestamp: new Date().toISOString()
            });
            status = "failed";
            errorMessage = err.message;
        }

        console.log('💾 Saving SMS activity to database...');
        await SMSActivity.create({
            userId,
            to: contact,
            message: plainText,
            status,
            sentAt: new Date(),
            visitorId: visitorId || null,
            visitId: visitId || null,
            errorMessage: errorMessage || null,
            messageType: 'sms',
            campaignId: templateId || null // Add campaignId to track which campaign this message belongs to
        });
        console.log('✅ SMS activity saved to database');

        if (status === "sent") {
            const newRemain = Math.max(0, (remainSMSs - 1) - sentSMS);
            console.log('📊 Updating subscription SMS count:', {
                oldRemain: remainSMSs,
                newRemain,
                decrement: 1
            });

            await Usersubscription.updateOne(
                { userId: new mongoose.Types.ObjectId(userId), status: "active" },
                { $set: { remainSMS: newRemain } }
            );
            console.log('✅ Subscription SMS count updated');
        }

        const response = {
            success: status === "sent",
            message: status === "sent" ? "SMS sent successfully." : `SMS failed: ${errorMessage}`
        };

        console.log('📤 Sending response to client:', response);
        console.log('🎉 SMS Campaign Process Complete!');

        return res.json(response);

    } catch (error) {
        next(error);
    }
};

// 📧 Send Email Campaign Function
exports.sendEmailCampaign = async (req, res, next) => {
    try {
        console.log('📧 Email Campaign API Call Received:', {
            timestamp: new Date().toISOString(),
            body: req.body
        });

        const { templateId, email, userId, visitorId, visitId } = req.body;

        console.log('🔍 Email Campaign Request Details:', {
            templateId,
            email: email ? email.substring(0, 3) + '***' + email.substring(email.indexOf('@')) : null,
            userId,
            hasTemplateId: !!templateId,
            hasEmail: !!email,
            hasUserId: !!userId
        });

        const template = await Campaign.findById(templateId);
        console.log('📋 Template Lookup Result:', {
            found: !!template,
            templateName: template?.name,
            hasElements: template?.elements?.length > 0,
            elementCount: template?.elements?.length || 0
        });

        if (!template || !template.elements?.length) {
            console.log('❌ Template validation failed');
            return res.status(400).json({ success: false, message: "Invalid or empty template." });
        }

        console.log('✅ Template validation passed, checking subscription...');

        const subscription = await getActiveSubscription(userId);
        console.log('💳 Subscription Check:', {
            found: !!subscription,
            maxEmail: subscription?.packageDetails?.emailLimit,
            subscriptionStartDate: subscription?.createdAt
        });

        let maxEmail = subscription?.packageDetails?.emailLimit;
        let subscriptionStartDate = subscription?.createdAt;

        if (!subscription || !maxEmail) {
            console.log('⚠️ No subscription found, using fallback package...');
            const fallback = await packageModel.findOne({ isDefault: true });
            console.log('🔄 Fallback Package:', {
                found: !!fallback,
                maxEmail: fallback?.emailLimit
            });

            if (!fallback || !fallback.emailLimit) {
                console.log('❌ No valid subscription or fallback package found');
                return res.status(400).json({ message: "No valid subscription or fallback package found." });
            }
            maxEmail = fallback.emailLimit;
            subscriptionStartDate = fallback.createdAt;
        }

        const latestSubscription = await Usersubscription.findOne({ userId: new mongoose.Types.ObjectId(userId), status: "deactive" }).sort({ createdAt: -1 });

        let remainEmails;
        if (latestSubscription && typeof latestSubscription.remainEmail === "number") {
            remainEmails = maxEmail - latestSubscription.remainEmail;
        } else {
            remainEmails = maxEmail;
        }

        console.log('📊 Email Limit Check:', {
            maxEmail,
            remainEmails,
            subscriptionStartDate
        });

        const sentEmails = await EmailActivity.countDocuments({
            userId,
            status: "sent",
            createdAt: { $gte: subscriptionStartDate }
        });

        console.log('📈 Email Usage:', {
            sentEmails,
            remainEmails,
            canSend: sentEmails < remainEmails
        });

        if (sentEmails >= remainEmails) {
            console.log(`⚠️ Email limit reached (${sentEmails}/${remainEmails}), but bypassing to allow unlimited sends.`);
            // return res.status(400).json({
            //     message: `Email limit reached. Maximum allowed: ${remainEmails}`
            // });
        }

        console.log('✅ Email limit check passed, preparing email...');

        const mailHtml = getTemplate(template.elements);
        console.log('📝 Email Content:', {
            length: mailHtml.length,
            preview: mailHtml.substring(0, 100) + (mailHtml.length > 100 ? '...' : ''),
            templateName: template.name
        });

        const emailObj = {
            to: email,
            subject: template.subject || 'Campaign Email',
            message: mailHtml
        };

        console.log('📤 Email Object:', {
            to: email.substring(0, 3) + '***' + email.substring(email.indexOf('@')),
            subject: emailObj.subject,
            messageLength: mailHtml.length,
            timestamp: new Date().toISOString()
        });

        let status = "sent";
        let errorMessage = "";

        console.log('🚀 Attempting to send email...');
        try {

            const cred = await userMailCredentials.findOne({ userId, active: true });
            if (!cred) {
                console.log('no api found for mail by Website Owner.')
                //        const result = await sendEmailCampaign(emailObj);
            }
            // Send email
            if (cred.platform == 'sendGrid') {
                await sendSendGridMailforuser({
                    email: emailObj.to,
                    subject: emailObj.subject,
                    mailHtml: emailObj.message
                });
            } else if (cred.platform == 'custom') {
                const transporter = nodemailer.createTransport({
                    host: cred.credentials.smtpHost,
                    port: cred.credentials.smtpPort,
                    secure: Number(cred.credentials.smtpPort) === 465,
                    auth: {
                        user: cred.credentials.smtpUser,
                        pass: cred.credentials.smtpPassword,
                    },
                    tls: {
                        rejectUnauthorized: false,
                    },
                });

                const mailOptions = {
                    from: cred.credentials.smtpUser,
                    to: emailObj.to,
                    subject: emailObj.subject,
                    html: emailObj.message
                };

                const result = await transporter.sendMail(mailOptions);


                console.log('✅ Email sent successfully:', {
                    messageId: result?.messageId,
                    accepted: result?.accepted,
                    timestamp: new Date().toISOString()
                });

            }

            // mail by our own mailer
            //        const result = await sendEmailCampaign(emailObj);

            // console.log('✅ Email sent successfully:', {
            //     messageId: result?.messageId,
            //     accepted: result?.accepted,
            //     timestamp: new Date().toISOString()
            // });
        } catch (err) {
            console.error('❌ Email send failed:', {
                error: err.message,
                timestamp: new Date().toISOString()
            });
            status = "failed";
            errorMessage = err.message;
        }

        console.log('💾 Saving email activity to database...');
        await EmailActivity.create({
            userId,
            to: email,
            subject: emailObj.subject,
            message: mailHtml,
            status,
            sentAt: new Date(),
            visitorId: visitorId || null,
            visitId: visitId || null,
            errorMessage: errorMessage || null,
            campaignId: templateId
        });
        console.log('✅ Email activity saved to database');

        if (status === "sent") {
            const newRemain = Math.max(0, (remainEmails - 1) - sentEmails);
            console.log('📊 Updating subscription email count:', {
                oldRemain: remainEmails,
                newRemain,
                decrement: 1
            });

            await Usersubscription.updateOne(
                { userId: new mongoose.Types.ObjectId(userId), status: "active" },
                { $set: { remainEmail: newRemain } }
            );
            console.log('✅ Subscription email count updated');
        }

        const response = {
            success: status === "sent",
            message: status === "sent" ? "Email sent successfully." : `Email failed: ${errorMessage}`
        };

        console.log('📤 Sending response to client:', response);
        console.log('🎉 Email Campaign Process Complete!');

        return res.json(response);

    } catch (error) {
        next(error);
    }
};

// 📱 Send WhatsApp Campaign Function
exports.sendWhatsAppCampaign = async (req, res, next) => {
    try {
        const { templateId, phoneNumber, userId, visitorId, visitId } = req.body;

        campaignLogger.campaignSendStart('WhatsApp', templateId, {
            templateId,
            phoneNumber: phoneNumber ? phoneNumber.substring(0, 4) + '***' + phoneNumber.substring(-4) : null,
            userId,
            visitorId,
            visitId
        });

        whatsappLogger.info('CAMPAIGN_SEND', 'WhatsApp campaign send request received', {
            templateId,
            phoneNumber: phoneNumber ? phoneNumber.substring(0, 4) + '***' + phoneNumber.substring(-4) : null,
            userId,
            visitorId,
            visitId
        });

        // Get user's WhatsApp configuration (check all possible configs)
        const user = await User.findById(userId).select('whatsappConfig whatsapp multiTenantWhatsApp');

        if (!user) {
            whatsappLogger.error('CAMPAIGN_SEND', 'User not found', { userId });
            return res.status(404).json({ success: false, message: "User not found." });
        }

        // Priority: Advanced Meta WhatsApp API Setup (whatsappConfig) > One-Tap WhatsApp Connect (multiTenantWhatsApp) > Old config (whatsapp)
        let whatsappConfig = null;
        let isMultiTenant = false;

        // Log all available configurations for debugging
        whatsappLogger.info('CAMPAIGN_SEND', 'Checking WhatsApp configurations', {
            userId,
            hasWhatsappConfig: !!user.whatsappConfig,
            hasWhatsappConfigAccessToken: !!user.whatsappConfig?.accessToken,
            whatsappConfigPhoneNumberId: user.whatsappConfig?.phoneNumberId,
            whatsappConfigPhoneNumbersCount: user.whatsappConfig?.phoneNumbers?.length || 0,
            hasMultiTenantWhatsApp: !!user.multiTenantWhatsApp,
            multiTenantIsConfigured: !!user.multiTenantWhatsApp?.isConfigured,
            multiTenantPhoneNumberId: user.multiTenantWhatsApp?.phoneNumberId,
            hasLegacyWhatsapp: !!user.whatsapp,
            legacyWhatsappAccessToken: !!user.whatsapp?.accessToken,
            legacyWhatsappPhoneNumberId: user.whatsapp?.phoneNumberId,
            legacyWhatsappIsConfigured: !!user.whatsapp?.isConfigured
        });

        // Priority 1: Check for Advanced Meta WhatsApp API Setup (whatsappConfig)
        // Check if whatsappConfig exists and has either accessToken OR phoneNumbers (indicating it was configured)
        if (user.whatsappConfig && (user.whatsappConfig.accessToken || user.whatsappConfig.phoneNumbers?.length > 0)) {
            // Direct WhatsApp configuration (Advanced Meta WhatsApp API Setup)
            whatsappConfig = { ...user.whatsappConfig }; // Create a copy to avoid mutating the original
            isMultiTenant = false;

            // If whatsappConfig doesn't have accessToken but legacy whatsapp does, use it
            if (!whatsappConfig.accessToken && user.whatsapp?.accessToken) {
                whatsappLogger.warn('CAMPAIGN_SEND', 'whatsappConfig missing accessToken, using legacy whatsapp accessToken', {
                    userId,
                    phoneNumberId: whatsappConfig.phoneNumberId || whatsappConfig.phoneNumbers?.[0]?.id
                });
                whatsappConfig.accessToken = user.whatsapp.accessToken;
            }

            const phoneNumberId = whatsappConfig.phoneNumberId || whatsappConfig.phoneNumbers?.[0]?.id;

            whatsappLogger.info('CAMPAIGN_SEND', '✅ SELECTED: Advanced Meta WhatsApp API Setup configuration', {
                userId,
                phoneNumberId: phoneNumberId,
                phoneNumberIdSource: whatsappConfig.phoneNumberId ? 'direct' : 'phoneNumbers[0]',
                hasAccessToken: !!whatsappConfig.accessToken,
                accessTokenSource: user.whatsappConfig.accessToken ? 'whatsappConfig' : 'legacy_whatsapp',
                phoneNumbersCount: whatsappConfig.phoneNumbers?.length || 0,
                allPhoneNumberIds: whatsappConfig.phoneNumbers?.map(p => p.id) || [],
                configType: 'advanced_meta_api',
                isMultiTenant: false
            });
        } else if (user.whatsapp?.accessToken && user.whatsapp?.phoneNumberId) {
            // Priority 2: Legacy WhatsApp configuration (has accessToken and phoneNumberId)
            // This is the "Advanced Meta WhatsApp API Setup" that was saved in the old format
            whatsappConfig = {
                phoneNumberId: user.whatsapp.phoneNumberId,
                accessToken: user.whatsapp.accessToken,
                businessAccountId: user.whatsapp.businessAccountId,
                isTestingMode: user.whatsapp.isTestingMode || false,
                phoneNumbers: user.whatsapp.phoneNumberId ? [{
                    id: user.whatsapp.phoneNumberId,
                    display_phone_number: user.whatsapp.displayNumber,
                    verified_name: user.whatsapp.verifiedName
                }] : []
            };
            isMultiTenant = false;

            const phoneNumberId = whatsappConfig.phoneNumberId;

            whatsappLogger.info('CAMPAIGN_SEND', '✅ SELECTED: Legacy WhatsApp configuration (Advanced Meta API - old format)', {
                userId,
                phoneNumberId: phoneNumberId,
                hasAccessToken: !!whatsappConfig.accessToken,
                businessAccountId: whatsappConfig.businessAccountId,
                displayNumber: user.whatsapp.displayNumber,
                verifiedName: user.whatsapp.verifiedName,
                configType: 'legacy_advanced_meta_api',
                isMultiTenant: false,
                note: 'Using legacy whatsapp field - this is from Advanced Meta WhatsApp API Setup'
            });
        } else if (user.multiTenantWhatsApp?.isConfigured) {
            // Priority 2: Multi-tenant WhatsApp configuration (One-Tap WhatsApp Connect)
            isMultiTenant = true;
            whatsappConfig = {
                phoneNumberId: user.multiTenantWhatsApp.phoneNumberId,
                accessToken: user.multiTenantWhatsApp.systemUserAccessToken || process.env.META_SYSTEM_USER_TOKEN,
                wabaId: user.multiTenantWhatsApp.wabaId,
                isTestingMode: false // Multi-tenant doesn't use testing mode
            };

            const tokenSource = user.multiTenantWhatsApp?.systemUserAccessToken ? 'user_code_exchange' : 'global_system_token';

            whatsappLogger.info('CAMPAIGN_SEND', '✅ SELECTED: Multi-tenant WhatsApp configuration (One-Tap WhatsApp Connect)', {
                userId,
                phoneNumberId: whatsappConfig.phoneNumberId,
                hasSystemUserToken: !!whatsappConfig.accessToken,
                tokenSource,
                wabaId: whatsappConfig.wabaId,
                hasUserToken: !!user.multiTenantWhatsApp?.systemUserAccessToken,
                configType: 'multi_tenant',
                isMultiTenant: true
            });

            // Warn if using global token instead of user's token (might cause permission issues)
            if (!user.multiTenantWhatsApp?.systemUserAccessToken) {
                whatsappLogger.warn('CAMPAIGN_SEND', 'Using global system token instead of user token - may cause permission issues', {
                    userId,
                    phoneNumberId: whatsappConfig.phoneNumberId,
                    wabaId: whatsappConfig.wabaId,
                    note: 'User should complete embedded signup with code exchange to get their own access token'
                });
            }
        } else {
            // Priority 3: Old WhatsApp configuration format
            whatsappConfig = user.whatsapp;

            if (whatsappConfig?.accessToken) {
                const phoneNumberId = whatsappConfig.phoneNumberId || whatsappConfig.phoneNumbers?.[0]?.id;

                whatsappLogger.info('CAMPAIGN_SEND', '✅ SELECTED: Old WhatsApp configuration format', {
                    userId,
                    phoneNumberId: phoneNumberId,
                    hasAccessToken: !!whatsappConfig.accessToken,
                    configType: 'legacy',
                    isMultiTenant: false
                });
            }
        }

        const isTestingMode = whatsappConfig?.isTestingMode || false;

        if (!whatsappConfig) {
            whatsappLogger.warn('CAMPAIGN_SEND', 'WhatsApp not configured for user', { userId });
            return res.status(400).json({
                success: false,
                message: "WhatsApp is not configured. Please configure WhatsApp in Account Settings."
            });
        }

        if (!whatsappConfig.accessToken) {
            whatsappLogger.error('CAMPAIGN_SEND', 'WhatsApp configuration found but missing access token', {
                userId,
                hasWhatsappConfig: !!user.whatsappConfig,
                whatsappConfigKeys: user.whatsappConfig ? Object.keys(user.whatsappConfig) : [],
                hasMultiTenant: !!user.multiTenantWhatsApp?.isConfigured,
                hasLegacyWhatsapp: !!user.whatsapp?.accessToken,
                configType: isMultiTenant ? 'multi_tenant' : 'direct',
                selectedConfig: isMultiTenant ? 'multiTenantWhatsApp' : (user.whatsappConfig ? 'whatsappConfig' : 'whatsapp')
            });
            return res.status(400).json({
                success: false,
                message: "WhatsApp access token is missing. Please reconfigure WhatsApp in Account Settings."
            });
        }

        whatsappLogger.success('CAMPAIGN_SEND', 'WhatsApp configuration found for user', {
            userId,
            isTestingMode,
            isMultiTenant,
            phoneNumbersCount: whatsappConfig.phoneNumbers?.length || 0,
            phoneNumberId: whatsappConfig.phoneNumberId || whatsappConfig.phoneNumbers?.[0]?.id,
            hasAccessToken: !!whatsappConfig.accessToken,
            configType: isMultiTenant ? 'multi-tenant' : (user.whatsappConfig?.accessToken ? 'advanced_meta_api' : 'legacy'),
            configSource: user.whatsappConfig?.accessToken ? 'whatsappConfig (Advanced Meta API)' :
                (user.multiTenantWhatsApp?.isConfigured ? 'multiTenantWhatsApp (One-Tap Connect)' : 'whatsapp (Legacy)')
        });

        campaignLogger.info('CAMPAIGN_FETCH', 'Fetching campaign from database', { templateId });
        const template = await Campaign.findById(templateId);

        if (!template) {
            campaignLogger.error('CAMPAIGN_FETCH', 'Campaign not found', { templateId });
            whatsappLogger.error('CAMPAIGN_SEND', 'Campaign not found', { templateId });
            return res.status(404).json({ success: false, message: "Campaign not found." });
        }

        campaignLogger.info('CAMPAIGN_FETCH', 'Campaign found', {
            campaignId: template._id,
            campaignName: template.campaigndesignerName || template.name,
            category: template.category,
            subCategory: template.subCategory,
            hasElements: !!template.elements?.length,
            elementCount: template.elements?.length || 0,
            whatsappTemplate: template.whatsappTemplate
        });

        if (!template.elements?.length) {
            campaignLogger.error('CAMPAIGN_VALIDATION', 'Campaign has no elements', { templateId });
            whatsappLogger.error('CAMPAIGN_SEND', 'Invalid or empty template', { templateId });
            return res.status(400).json({ success: false, message: "Invalid or empty template." });
        }

        campaignLogger.success('CAMPAIGN_VALIDATION', 'Template validated successfully', { templateId });
        whatsappLogger.info('CAMPAIGN_SEND', 'Template validated', {
            templateId,
            templateName: template?.campaigndesignerName || template?.name,
            elementCount: template?.elements?.length
        });

        // Extract plain text from template elements
        const plainText = extractPlainText(template.elements);

        whatsappLogger.info('CAMPAIGN_SEND', 'Message content prepared', {
            templateId,
            messageLength: plainText.length,
            preview: plainText.substring(0, 50) + (plainText.length > 50 ? '...' : '')
        });

        // Get template name from campaign data (default to hello_world if not specified)
        const templateName = template.whatsappTemplate || 'hello_world';
        const isDefault = !template.whatsappTemplate;

        // Get template language code - try multiple sources
        let templateLanguage = 'en_US'; // Default language

        if (!isDefault) {
            // Method 1: Check stored approved templates
            if (user.whatsapp?.approvedTemplates?.length > 0) {
                const matchedTemplate = user.whatsapp.approvedTemplates.find(
                    (t) => t.name === templateName
                );
                if (matchedTemplate?.language) {
                    templateLanguage = matchedTemplate.language;
                    campaignLogger.info('TEMPLATE_LANGUAGE', 'Found template language from stored approved templates', {
                        templateName,
                        language: templateLanguage
                    });
                }
            }

            // Method 2: Check stored default templates
            if (templateLanguage === 'en_US' && user.whatsapp?.defaultTemplates?.length > 0) {
                const defaultTemplate = user.whatsapp.defaultTemplates.find(
                    (t) => t.name === templateName
                );
                if (defaultTemplate?.language) {
                    templateLanguage = defaultTemplate.language;
                    campaignLogger.info('TEMPLATE_LANGUAGE', 'Found template language from stored default templates', {
                        templateName,
                        language: templateLanguage
                    });
                }
            }

            // Method 3: Fetch from Meta API if not found in stored templates
            // For multi-tenant, use WABA ID; for direct, use businessAccountId
            if (templateLanguage === 'en_US' && whatsappConfig?.accessToken) {
                try {
                    const axios = require('axios');
                    // Use WABA ID for multi-tenant, businessAccountId for direct
                    const accountId = isMultiTenant ? whatsappConfig.wabaId : whatsappConfig.businessAccountId;

                    if (!accountId) {
                        campaignLogger.warn('TEMPLATE_LANGUAGE', 'No account ID available for template language fetch', {
                            templateName,
                            isMultiTenant
                        });
                    } else {
                        const templatesUrl = `https://graph.facebook.com/v22.0/${accountId}/message_templates`;
                        const templatesResponse = await axios.get(templatesUrl, {
                            headers: {
                                'Authorization': `Bearer ${whatsappConfig.accessToken}`
                            },
                            params: {
                                fields: 'name,language,status'
                            }
                        });

                        const matchedTemplate = templatesResponse.data.data?.find(
                            (t) => t.name === templateName
                        );

                        if (matchedTemplate?.language) {
                            templateLanguage = matchedTemplate.language;
                            campaignLogger.info('TEMPLATE_LANGUAGE', 'Found template language from Meta API', {
                                templateName,
                                language: templateLanguage,
                                accountId,
                                isMultiTenant
                            });
                        } else {
                            campaignLogger.warn('TEMPLATE_LANGUAGE', 'Template not found in Meta API, using default en_US', {
                                templateName,
                                templatesFound: templatesResponse.data.data?.length || 0,
                                accountId,
                                isMultiTenant
                            });
                        }
                    }
                } catch (langError) {
                    campaignLogger.warn('TEMPLATE_LANGUAGE', 'Failed to fetch template language from Meta API, using default en_US', {
                        templateName,
                        error: langError.message,
                        isMultiTenant,
                        accountId: isMultiTenant ? whatsappConfig.wabaId : whatsappConfig.businessAccountId
                    });
                }
            }

            if (templateLanguage === 'en_US') {
                campaignLogger.warn('TEMPLATE_LANGUAGE', 'Using default language en_US (template language not found)', {
                    templateName,
                    hasApprovedTemplates: !!user.whatsapp?.approvedTemplates?.length,
                    hasDefaultTemplates: !!user.whatsapp?.defaultTemplates?.length
                });
            }
        }

        campaignLogger.templateResolution(templateId, templateName, isDefault, {
            whatsappTemplateField: template.whatsappTemplate,
            resolvedTemplateName: templateName,
            templateLanguage: templateLanguage
        });

        if (!template.whatsappTemplate) {
            campaignLogger.warn('TEMPLATE_RESOLUTION', 'Campaign does not have whatsappTemplate field set - using default', {
                templateId,
                warning: 'Template selection was not saved when campaign was created/updated. Check CampaignBuilder.tsx or EmailCampaign.tsx'
            });
        }

        whatsappLogger.info('CAMPAIGN_SEND', 'Using template', {
            templateName,
            campaignId: templateId,
            whatsappTemplateField: template.whatsappTemplate,
            fallbackToDefault: !template.whatsappTemplate
        });

        // Get phone number ID (use first available phone number or direct phoneNumberId)
        let phoneNumberId;
        if (isMultiTenant) {
            // Multi-tenant: use phoneNumberId directly
            phoneNumberId = whatsappConfig.phoneNumberId;
        } else {
            // Direct WhatsApp: use first available phone number or direct phoneNumberId
            phoneNumberId = whatsappConfig.phoneNumbers?.[0]?.id || whatsappConfig.phoneNumberId;
        }

        if (!phoneNumberId) {
            whatsappLogger.error('CAMPAIGN_SEND', 'Phone number ID not found', { userId, isMultiTenant });
            return res.status(400).json({
                success: false,
                message: "Phone number ID not found in WhatsApp configuration."
            });
        }

        // Prepare WhatsApp message object
        const whatsappObj = {
            phoneNumberId: phoneNumberId,
            accessToken: whatsappConfig.accessToken,
            to: phoneNumber.replace(/[^0-9]/g, ''), // Remove any non-numeric characters
            message: plainText,
            templateName: templateName, // Use template from campaign or default to hello_world
            templateLanguage: templateLanguage, // Use template's language code
            isTestingMode: isTestingMode
        };

        whatsappLogger.info('CAMPAIGN_SEND', 'Prepared WhatsApp message object', {
            to: phoneNumber.substring(0, 4) + '***' + phoneNumber.substring(-4),
            templateName: whatsappObj.templateName,
            campaignId: templateId,
            isTestingMode: isTestingMode,
            phoneNumberId: phoneNumberId,
            accessTokenSource: isMultiTenant ? (user.multiTenantWhatsApp?.systemUserAccessToken ? 'user_token' : 'global_token') : 'direct_config',
            configType: isMultiTenant ? 'multi_tenant' : (user.whatsappConfig?.accessToken ? 'advanced_meta_api' : 'legacy'),
            expectedPhoneNumberId: user.whatsappConfig?.phoneNumberId || user.whatsappConfig?.phoneNumbers?.[0]?.id || user.multiTenantWhatsApp?.phoneNumberId || 'none'
        });

        // Validate phone number ownership before sending (skip for testing mode)
        // This helps catch permission issues early, but adds an extra API call
        // Run validation for all config types to catch mismatches
        if (!isTestingMode) {
            try {
                const axios = require('axios');
                whatsappLogger.info('CAMPAIGN_SEND', 'Validating phone number ownership before sending', {
                    phoneNumberId,
                    userId,
                    isMultiTenant,
                    configType: isMultiTenant ? 'multi_tenant' : (user.whatsappConfig?.accessToken ? 'advanced_meta_api' : 'legacy'),
                    accessTokenLength: whatsappObj.accessToken?.length || 0,
                    accessTokenPreview: whatsappObj.accessToken ? whatsappObj.accessToken.substring(0, 20) + '...' : 'none'
                });

                // Quick validation: try to fetch phone number details
                await axios.get(
                    `https://graph.facebook.com/v22.0/${phoneNumberId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${whatsappObj.accessToken}`
                        },
                        params: {
                            fields: 'id'
                        }
                    }
                );

                whatsappLogger.success('CAMPAIGN_SEND', 'Phone number ownership validated', {
                    phoneNumberId,
                    userId
                });
            } catch (validationError) {
                const errorCode = validationError.response?.data?.error?.code;
                const errorSubcode = validationError.response?.data?.error?.error_subcode;

                // If it's a permission/ownership error, fail early with clear message
                if (errorCode === 100 && errorSubcode === 33) {
                    const errorMsg = `Phone number ID "${phoneNumberId}" cannot be accessed with the current access token. This usually means the phone number belongs to a different Meta app. Please ensure you completed the WhatsApp signup process correctly, or contact support if the issue persists.`;

                    whatsappLogger.error('CAMPAIGN_SEND', 'Phone number ownership validation failed', {
                        phoneNumberId,
                        userId,
                        errorCode,
                        errorSubcode,
                        errorMessage: validationError.response?.data?.error?.message
                    });

                    return res.status(400).json({
                        success: false,
                        message: errorMsg,
                        errorCode,
                        errorSubcode,
                        suggestion: 'Please try disconnecting and reconnecting WhatsApp in Account Settings, ensuring you complete the full signup process.'
                    });
                }

                // For other errors, log but continue (might be temporary)
                whatsappLogger.warn('CAMPAIGN_SEND', 'Phone number validation failed, but continuing with send attempt', {
                    phoneNumberId,
                    userId,
                    error: validationError.response?.data?.error?.message || validationError.message
                });
            }
        }

        // Initialize status as 'failed' to ensure we only mark as 'sent' if actually successful
        let status = "failed";
        let errorMessage = "Unknown error";
        let messageId = null;

        campaignLogger.info('META_API_SEND', 'Attempting to send WhatsApp message via Meta API', {
            phoneNumberId: whatsappObj.phoneNumberId,
            to: whatsappObj.to.substring(0, 4) + '***' + whatsappObj.to.substring(-4),
            templateName: whatsappObj.templateName,
            isTestingMode: whatsappObj.isTestingMode,
            messageLength: whatsappObj.message?.length || 0,
            campaignId: templateId
        });

        whatsappLogger.info('CAMPAIGN_SEND', 'Attempting to send WhatsApp message via Meta API', {
            templateName: whatsappObj.templateName,
            to: phoneNumber.substring(0, 4) + '***' + phoneNumber.substring(-4),
            campaignId: templateId
        });

        try {
            campaignLogger.info('META_API_CALL', 'Calling sendWhatsApp helper function', {
                templateName: whatsappObj.templateName,
                campaignId: templateId
            });

            const result = await sendWhatsApp(whatsappObj);

            campaignLogger.apiResponse('Meta WhatsApp API', result, result?.success ? 'success' : 'error', {
                success: result?.success,
                messageId: result?.messageId,
                isTestMessage: result?.isTestMessage,
                templateName: whatsappObj.templateName,
                campaignId: templateId
            });

            // Only mark as 'sent' if we get a successful response with messageId
            if (result?.success && result?.messageId) {
                status = "sent";
                messageId = result.messageId;
                errorMessage = "";

                campaignLogger.success('META_API_SEND', 'WhatsApp message sent successfully', {
                    messageId,
                    templateName: whatsappObj.templateName,
                    status: 'sent',
                    campaignId: templateId
                });

                whatsappLogger.messageSent(userId, phoneNumber, templateId, 'sent');
                whatsappLogger.success('CAMPAIGN_SEND', 'WhatsApp message sent successfully', {
                    messageId,
                    campaignId: templateId,
                    templateName: whatsappObj.templateName
                });
            } else {
                // If result doesn't indicate success, mark as failed
                status = "failed";
                errorMessage = result?.note || result?.error || "Send completed but no messageId returned";

                campaignLogger.error('META_API_SEND', 'WhatsApp send did not return success', {
                    result,
                    errorMessage,
                    templateName: whatsappObj.templateName,
                    status: 'failed',
                    campaignId: templateId
                });

                whatsappLogger.messageSent(userId, phoneNumber, templateId, 'failed');
                whatsappLogger.error('CAMPAIGN_SEND', 'WhatsApp send did not return success', {
                    result,
                    campaignId: templateId,
                    templateName: whatsappObj.templateName
                });
            }
        } catch (err) {
            status = "failed";
            errorMessage = err.message || err.response?.data?.error?.message || "Failed to send WhatsApp message";

            const errorDetails = {
                errorMessage: err.message,
                errorType: err.constructor.name,
                errorCode: err.response?.data?.error?.code,
                errorSubcode: err.response?.data?.error?.error_subcode,
                metaErrorType: err.response?.data?.error?.type,
                metaErrorMessage: err.response?.data?.error?.message,
                metaErrorUserMsg: err.response?.data?.error?.error_user_msg,
                fbtraceId: err.response?.data?.error?.fbtrace_id,
                templateName: whatsappObj.templateName,
                status: 'failed',
                campaignId: templateId
            };

            campaignLogger.error('META_API_ERROR', 'Exception during WhatsApp send', errorDetails);

            if (err.response?.data?.error) {
                const metaError = err.response.data.error;
                campaignLogger.error('META_API_ERROR_DETAILS', 'Meta API Error Details', {
                    code: metaError.code,
                    type: metaError.type,
                    message: metaError.message,
                    error_user_msg: metaError.error_user_msg,
                    error_subcode: metaError.error_subcode,
                    fbtrace_id: metaError.fbtrace_id,
                    campaignId: templateId
                });
            }

            whatsappLogger.messageSent(userId, phoneNumber, templateId, 'failed');
            whatsappLogger.error('CAMPAIGN_SEND', 'WhatsApp send failed with exception', {
                error: err.message,
                errorStack: err.stack,
                errorResponse: err.response?.data,
                campaignId: templateId,
                templateName: whatsappObj.templateName
            });
        }

        // Log WhatsApp activity to database
        campaignLogger.info('DATABASE_SAVE', 'Saving activity to database', {
            userId,
            status,
            campaignId: templateId,
            hasMessageId: !!messageId,
            hasErrorMessage: !!errorMessage
        });

        whatsappLogger.info('CAMPAIGN_SEND', 'Saving activity to database', {
            userId,
            status,
            campaignId: templateId
        });

        const activityRecord = {
            userId,
            to: phoneNumber,
            message: plainText,
            status,
            sentAt: new Date(),
            visitorId: visitorId || null,
            visitId: visitId || null,
            errorMessage: errorMessage || null,
            messageType: 'whatsapp',
            messageId: messageId,
            campaignId: templateId
        };

        campaignLogger.debug('DATABASE_SAVE', 'Activity record details', {
            ...activityRecord,
            to: activityRecord.to.substring(0, 4) + '***' + activityRecord.to.substring(-4),
            message: activityRecord.message.substring(0, 50) + '...'
        });

        await SMSActivity.create(activityRecord);
        campaignLogger.success('DATABASE_SAVE', 'Activity saved to database', { campaignId: templateId, status });

        const response = {
            success: status === "sent",
            message: status === "sent"
                ? (isTestingMode
                    ? "WhatsApp test message simulated successfully (Testing Mode)"
                    : "WhatsApp message sent successfully")
                : `Failed to send WhatsApp: ${errorMessage}`,
            isTestingMode: isTestingMode,
            testNote: isTestingMode ? "This is a test message - no actual WhatsApp message was sent. Add a real phone number for production use." : null,
            templateName: templateName,
            status: status,
            errorMessage: errorMessage || null
        };

        campaignLogger.campaignSendEnd('WhatsApp', templateId, response.success, {
            success: response.success,
            message: response.message,
            status: response.status,
            templateName: response.templateName,
            hasError: !!response.errorMessage
        });

        whatsappLogger.info('CAMPAIGN_SEND', 'Campaign send process complete', {
            success: response.success,
            campaignId: templateId
        });

        return res.json(response);

    } catch (error) {
        whatsappLogger.error('CAMPAIGN_SEND', 'Unexpected error in campaign send', {
            error: error.message,
            stack: error.stack
        });
        next(error);
    }
};

exports.addFormTrackingScript = async (req, res, next) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return next(new ErrorHandler('User ID is required', 400));
        }

        const user = await User.findById(userId);
        if (!user) {
            return next(new ErrorHandler('User not found', 404));
        }

        const dir = `${process.env.SCRIPT_DIRECTORY}/client`;
        const userDir = path.join(dir, userId);
        const scriptsJsonPath = path.join(userDir, `scripts.json`);

        // Ensure user directory exists
        await fs.mkdir(userDir, { recursive: true });

        // Read existing scripts or create new array
        let existingScripts = [];
        try {
            const scriptsData = await fs.readFile(scriptsJsonPath, 'utf8');
            existingScripts = JSON.parse(scriptsData);
        } catch (error) {
            // File doesn't exist, start with empty array
            existingScripts = [];
        }

        // Check if form tracking script already exists
        const hasFormTracking = existingScripts.some(script => script.scriptName === 'htmlFormTrackingScript.js');

        if (hasFormTracking) {
            return res.json({
                success: true,
                message: "Form tracking script already exists for this user"
            });
        }

        // Add form tracking script
        existingScripts.push({
            scriptName: "htmlFormTrackingScript.js",
            isActive: true,
            name: "Form Tracking Script",
            description: "Automatically tracks form submissions and saves contacts/conversions"
        });

        // Save updated scripts.json
        await fs.writeFile(scriptsJsonPath, JSON.stringify(existingScripts, null, 2));

        // Copy form tracking script file
        const formTrackingScriptPath = path.join(__dirname, '../scripts/scripts-htmlFormTrackingScript.js');
        const userFormTrackingPath = path.join(userDir, 'htmlFormTrackingScript.js');

        await fs.copyFile(formTrackingScriptPath, userFormTrackingPath);

        res.json({
            success: true,
            message: "Form tracking script added successfully",
            scripts: existingScripts
        });

    } catch (error) {
        console.error('Error adding form tracking script:', error);
        next(error);
    }
};
