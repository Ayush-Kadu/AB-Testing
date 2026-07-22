// ============================================================================
// A/B Testing — visitor allocation loader.
//
// This builds the client-side JavaScript that getScripts (scriptControllers.js)
// ships down to whatever website a visitor is on. It is NOT executed inside
// this codebase — it's assembled here as a plain string, embedded into the
// response, and only ever runs inside an arbitrary third-party browser. That's
// why it can't be a normal imported module on the client side, and why it's
// written in plain vanilla JS (no build step, no dependencies, has to run
// as-is in any browser that loads the customer's site).
//
// Pulled into its own file purely for readability — this is the one place
// that answers "how does a visitor get assigned to a variant."
//
// ── What it does, end to end ──────────────────────────────────────────────
// 1. Loads the "always on" scripts for this domain: the main tracking script
//    plus any published campaigns that are NOT part of a running experiment
//    (those are computed server-side in getScripts and passed in as
//    `allowedScripts` — this file doesn't decide that part).
// 2. For each running experiment (`abConfig`, also computed server-side —
//    see getScripts for how a campaign only ends up in here once it has a
//    *running* experiment with at least one *published* variant):
//      a. Check for an existing `ab_exp_<experimentId>` cookie. If its value
//         still matches one of the experiment's current variant campaign
//         IDs, reuse it — this is what makes assignment sticky for
//         returning visitors.
//      b. Otherwise, run a weighted-random ("roulette wheel") pick: sum all
//         variant weights, draw a random number in [0, total), walk the
//         variant list subtracting each weight until the running total
//         drops to zero or below — that's the pick. Write it to the cookie
//         (90-day expiry).
//      c. Queue that variant's own script file, fire an "impression"
//         tracking beacon (POST /api/variant/track), and start a best-effort
//         click observer scoped to that variant.
// 3. Injects every queued script (static + AB-chosen) as real <script> tags.
// ============================================================================

/**
 * @param {Object} params
 * @param {string[]} params.matchedCampaignIds - all campaign IDs matched to this domain (diagnostic only, mirrors prior inline behavior)
 * @param {string[]} params.activeSiteIds - active website IDs matched to this domain (diagnostic only, mirrors prior inline behavior)
 * @param {string[]} params.allowedScripts - script filenames to always load (main script + non-AB campaigns)
 * @param {string} params.scriptsBaseUrl - e.g. "https://host/scripts"
 * @param {string} params.apiBaseUrl - e.g. "https://host/api"
 * @param {string} params.clientId - the account's user id, used to build "<clientId>-<campaignId>.js" filenames
 * @param {Array<{experimentId: string, variants: Array<{campaignId: string, weight: number}>}>} params.abConfig
 * @returns {string} a self-invoking JS snippet, ready to embed in the HTTP response
 */
function buildAbLoaderScript({
    matchedCampaignIds,
    activeSiteIds,
    allowedScripts,
    scriptsBaseUrl,
    apiBaseUrl,
    clientId,
    abConfig
}) {
    return `
      (function loadScripts() {
      const matchedCampaigns = ${JSON.stringify(matchedCampaignIds)};
      const activeSitesForDomain = ${JSON.stringify(activeSiteIds)};
        const files = ${JSON.stringify(allowedScripts)};
        const base = '${scriptsBaseUrl}/';
        const apiBase = '${apiBaseUrl}';
        const clientIdForAb = '${clientId}';
        const abTests = ${JSON.stringify(abConfig)};

        function abGetCookie(name) {
          const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
          return m ? decodeURIComponent(m[1]) : null;
        }
        function abSetCookie(name, value, days) {
          const d = new Date();
          d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
          document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
        }
        // Weighted-random ("roulette wheel") selection: each variant occupies
        // a slice of [0, totalWeight) proportional to its weight; a single
        // random draw decides which slice it lands in.
        function abPickWeighted(variants) {
          let total = 0;
          for (let i = 0; i < variants.length; i++) total += (variants[i].weight || 1);
          let r = Math.random() * total;
          for (let j = 0; j < variants.length; j++) {
            r -= (variants[j].weight || 1);
            if (r <= 0) return variants[j];
          }
          return variants[variants.length - 1];
        }
        function abTrack(type, campaignId) {
          try {
            const visitorId = abGetCookie('visitorId') || '';
            const visitId = abGetCookie('visitId') || '';
            const ua = navigator.userAgent || '';
            fetch(apiBase + '/variant/track', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                campaignId: campaignId,
                type: type,
                visitorId: visitorId,
                visitId: visitId,
                deviceType: /Mobi|Android/i.test(ua) ? 'Mobile' : (/Tablet|iPad/i.test(ua) ? 'Tablet' : 'Desktop'),
                browser: (ua.match(/Edg|OPR|Chrome|Firefox|Safari/i) || ['Unknown'])[0],
                country: ''
              }),
              keepalive: true
            }).catch(function () {});
          } catch (e) {}
        }
        // Best-effort click attribution: campaign popups/overlays are
        // almost always injected as new top-level body children, so watch
        // for that and count the first click inside each newly-added node.
        // Known non-campaign banners (cookie consent, push opt-in) are
        // excluded explicitly so they're never misattributed as clicks.
        function abWatchForClicks(campaignId) {
          function start() {
            try {
              const observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (m) {
                  (m.addedNodes || []).forEach(function (node) {
                    if (node.nodeType !== 1) return;
                    if (node.id === 'push-optin-banner') return;
                    if (node.getAttribute && node.getAttribute('role') === 'alert') return;
                    node.addEventListener('click', function () {
                      abTrack('click', campaignId);
                    }, { once: true, capture: true });
                  });
                });
              });
              observer.observe(document.body, { childList: true });
              setTimeout(function () { observer.disconnect(); }, 60000);
            } catch (e) {}
          }
          if (document.body) start();
          else document.addEventListener('DOMContentLoaded', start);
        }

        const abFiles = [];
        abTests.forEach(function (exp) {
          const cookieName = 'ab_exp_' + exp.experimentId;
          const validIds = exp.variants.map(function (v) { return v.campaignId; });
          let chosenCampaignId = abGetCookie(cookieName);
          if (!chosenCampaignId || validIds.indexOf(chosenCampaignId) === -1) {
            chosenCampaignId = abPickWeighted(exp.variants).campaignId;
            abSetCookie(cookieName, chosenCampaignId, 90);
          }
          abFiles.push(clientIdForAb + '-' + chosenCampaignId + '.js');
          abTrack('impression', chosenCampaignId);
          abWatchForClicks(chosenCampaignId);
        });

        files.concat(abFiles).forEach(file => {
          const s = document.createElement('script');
          s.src = base + file;
          s.async = true;
          document.head.appendChild(s);
        });
      })();
    `;
}

module.exports = { buildAbLoaderScript };
