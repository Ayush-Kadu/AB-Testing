const fs = require('fs').promises;
const path = require('path');
const terser = require('terser');
const scriptModel = require('../models/scriptModel');

// const getMinifiedCode = async (script) => {
//     const minified = await terser.minify(script, {
//         ecma: 2020,
//         module: false,
//         toplevel: false,
//         compress: {
//             drop_console: false,
//             drop_debugger: true
//         },
//         mangle: {
//             toplevel: false
//         }
//     });
//     if (minified.error) {
//         console.error("Minification error:", minified.error);
//         return script; // Return original script if minification fails
//     }
//     return minified.code;
// }

const getMinifiedCode = async (script) => {
    const minified = await terser.minify(script, {
        ecma: 2020,
        compress: {
            drop_console: false,  // keep all console logs
            drop_debugger: true,
            dead_code: false,     // keep code that may seem unused
            unused: false         // keep variables/functions that are referenced dynamically
        },
        mangle: false,          // do NOT rename variables or functions
        format: {
            comments: false,      // remove comments
            beautify: false       // compact code without losing readability
        }
    });

    if (minified.error) {
        console.error("Minification error:", minified.error);
        return script;
    }
    return minified.code;
};



const getMainScript = async (user) => {
    if (!user && !user._id) {
        return
    }

    const script = `
        var userId = "${user._id}";
        // Check for delete_cookies parameter and handle cookie deletion
        (function() {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('delete_cookies') === 'true') {
                // Show confirmation dialog
                const confirmed = confirm('🧹 Delete All Cookies?\\n\\nThis will delete:\\n• All cookies\\n• localStorage data\\n• sessionStorage data\\n• IndexedDB data\\n\\nThe page will refresh after deletion.\\n\\nClick OK to proceed or Cancel to abort.');
                
                if (confirmed) {
                    console.log('🔍 Starting cookie deletion process...');
                    
                    // Function to clear all cookies
                    function clearAllCookies() {
                        const cookies = document.cookie.split(';');
                        let deletedCount = 0;
                        
                        for (let i = 0; i < cookies.length; i++) {
                            const cookie = cookies[i];
                            const eqPos = cookie.indexOf('=');
                            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                            
                            if (name) {
                                // Delete cookie from current domain
                                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                                
                                // Delete cookie from root domain
                                const domainParts = window.location.hostname.split('.');
                                if (domainParts.length > 1) {
                                    const rootDomain = '.' + domainParts.slice(-2).join('.');
                                    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + rootDomain + ';';
                                }
                                
                                deletedCount++;
                            }
                        }
                        
                        return deletedCount;
                    }
                    
                    // Function to clear all storage
                    function clearAllStorage() {
                        let clearedItems = 0;
                        
                        // Clear localStorage
                        try {
                            const localStorageCount = localStorage.length;
                            localStorage.clear();
                            clearedItems += localStorageCount;
                        } catch (e) {
                            console.warn('Could not clear localStorage:', e);
                        }
                        
                        // Clear sessionStorage
                        try {
                            const sessionStorageCount = sessionStorage.length;
                            sessionStorage.clear();
                            clearedItems += sessionStorageCount;
                        } catch (e) {
                            console.warn('Could not clear sessionStorage:', e);
                        }
                        
                        // Clear IndexedDB
                        if ('indexedDB' in window) {
                            try {
                                indexedDB.databases().then(databases => {
                                    databases.forEach(db => {
                                        if (db.name) {
                                            indexedDB.deleteDatabase(db.name);
                                            clearedItems++;
                                        }
                                    });
                                });
                            } catch (e) {
                                console.warn('Could not clear IndexedDB:', e);
                            }
                        }
                        
                        return clearedItems;
                    }
                    
                    // Execute the cleanup
                    const deletedCookies = clearAllCookies();
                    const clearedStorage = clearAllStorage();
                    
                    // Show success message
                    const message = \`✅ Cookie deletion completed!\\n\\nDeleted \${deletedCookies} cookies\\nCleared \${clearedStorage} storage items\\n\\nPage will refresh in 3 seconds...\`;
                    
                    // Create a nice notification
                    const notification = document.createElement('div');
                    notification.style.cssText = \`
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: #10b981;
                        color: white;
                        padding: 16px 20px;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 999999;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        font-size: 14px;
                        line-height: 1.4;
                        max-width: 300px;
                        white-space: pre-line;
                    \`;
                    notification.textContent = message;
                    document.body.appendChild(notification);
                    
                    // Remove notification after 3 seconds and refresh
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                        // Remove the delete_cookies parameter and refresh
                        const newUrl = new URL(window.location.href);
                        newUrl.searchParams.delete('delete_cookies');
                        window.location.href = newUrl.toString();
                    }, 3000);
                    
                    console.log(\`🎉 Cookie deletion completed: \${deletedCookies} cookies, \${clearedStorage} storage items\`);
                } else {
                    console.log('❌ Cookie deletion cancelled by user');
                    // Remove the parameter even if cancelled
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.delete('delete_cookies');
                    window.location.href = newUrl.toString();
                }
            }
        })();
        
        // Function to get user IP address.
        // Bounded with a timeout: this is a third-party call (blocked by some
        // ad/privacy blockers, or just slow/unreachable) and initializeTracking()
        // awaits it before writing the 'userCookie' cookie that campaign filters
        // read — if this hangs, it delays that cookie and can cause a campaign's
        // audience filters to run against no visitor data yet. Fail fast instead.
        const getUserIp = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            try {
                const ipData = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
                if (ipData.ok) {
                    const data = await ipData.json();
                    return data?.ip;
                }
                throw new Error('Failed to fetch IP');
            } catch (error) {
                console.error('Error fetching IP:', error);
                return null;
            } finally {
                clearTimeout(timeoutId);
            }
        };



        // Function to set a cookie with secure options
        function setCookie(name, value, daysToExpire) {
            const date = new Date();
            date.setTime(date.getTime() + daysToExpire * 24 * 60 * 60 * 1000);
            const expires = 'expires=' + date.toUTCString();
            const secure = location.protocol === 'https:' ? '; secure' : '';
            const sameSite = '; SameSite=Lax';
            
            // Clear any existing cookies with the same name from different domains first
            clearCookieFromAllDomains(name);
            
            // Set cookie for current domain only (not domain-wide)
            document.cookie = name + '=' + encodeURIComponent(value) + '; ' + expires + sameSite + secure + '; path=/';
        }
        
        // Function to clear cookies from all possible domain scopes
        function clearCookieFromAllDomains(name) {
            const currentDomain = window.location.hostname;
            const domainParts = currentDomain.split('.');
            
            // Clear from current domain
            document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            
            // Clear from parent domain if it's a subdomain
            if (domainParts.length > 2) {
                const parentDomain = '.' + domainParts.slice(-2).join('.');
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + parentDomain + ';';
            }
            
            // Clear from root domain
            if (domainParts.length > 1) {
                const rootDomain = '.' + domainParts.slice(-1).join('.');
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=' + rootDomain + ';';
            }
        }

        // Function to get a cookie by name
        function getCookie(name) {
            const nameEQ = name + '=';
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1);
                if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
            }
            return null;
        }
        
        // Function to check if a cookie exists and get its domain scope
        function getCookieInfo(name) {
            const nameEQ = name + '=';
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1);
                if (c.indexOf(nameEQ) === 0) {
                    return {
                        value: decodeURIComponent(c.substring(nameEQ.length)),
                        domain: window.location.hostname // Current domain where cookie is accessible
                    };
                }
            }
            return null;
        }

        // Function to parse URL parameters into an object
        function parseUrlParameters(url) {
            const params = {};
            try {
                const paramString = url.split('?')[1];
                if (!paramString) return params;

                const queryString = new URLSearchParams(paramString);
                for (let pair of queryString.entries()) {
                    params[pair[0]] = pair[1];
                }
            } catch (error) {
                console.error('Error parsing URL parameters:', error);
            }
            return params;
        }

        // Generate a more robust unique ID
        function generateRandomUniqueID() {
            return Date.now().toString(36) + Math.random().toString(36).substring(2);
        }

        // Function to generate a unique user ID and store it in a cookie
        function generateUniqueUserID() {
            const cookieName = 'visitorId';
            const existingUserID = getCookie(cookieName);

            if (existingUserID) {
                return existingUserID;
            }

            const newUserID = generateRandomUniqueID();
            
            // For visitorId, we want to set it domain-wide so it persists across subdomains
            const date = new Date();
            date.setTime(date.getTime() + 365 * 24 * 60 * 60 * 1000);
            const expires = 'expires=' + date.toUTCString();
            const secure = location.protocol === 'https:' ? '; secure' : '';
            const sameSite = '; SameSite=Lax';
            
            // Set visitorId for the entire domain (e.g., .technians.com)
            const domainParts = window.location.hostname.split('.');
            const domainScope = domainParts.length > 1 ? '.' + domainParts.slice(-2).join('.') : '';
            const domainParam = domainScope ? '; domain=' + domainScope : '';
            
            document.cookie = cookieName + '=' + encodeURIComponent(newUserID) + '; ' + expires + sameSite + secure + domainParam + '; path=/';
            
            return newUserID;
        }

        // Set landing page cookies
        function getLandingPage() {
            const landingPageCookie = getCookie('urlpt_landing_page');

            if (!landingPageCookie) {
                const currentPageUrl = window.location.href;
                setCookie('urlpt_landing_page', currentPageUrl, 365);
                return currentPageUrl;
            }
            return landingPageCookie;
        }

        // Get google client ID
        function getGaClientId() {
            try {
                const gaCookie = document.cookie.split(';').find((cookie) => cookie.trim().startsWith('_ga='));
                if (gaCookie) {
                    return gaCookie.split('.').slice(-2).join('.');
                }
            } catch (error) {
                console.error('Error getting GA client ID:', error);
            }
            return null;
        }

        // Function to get Facebook click ID and browser ID
        function getFacebookIds() {
            const fbcCookie = getCookie('_fbc');
            const fbpCookie = getCookie('_fbp');

            return {
                fbc: fbcCookie,
                fbp: fbpCookie
            };
        }

        // Function to get user device information
        function getUserDeviceInfo() {
            const userAgent = navigator.userAgent;
            const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
            const isTablet = /Tablet|iPad/i.test(userAgent);
            const isTV = /TV/i.test(userAgent);
            const isMac = /Macintosh|MacIntel|MacPPC|Mac68K/i.test(userAgent);
            const isWindows = /Win32|Win64|Windows|WinCE/i.test(userAgent);
            const isLinux = /Linux/i.test(userAgent) && !isMobile;
        
            let deviceType = 'Desktop';
            let os = 'Unknown';
            let deviceModel = 'Unknown';
        
            if (isMobile) {
                deviceType = 'Mobile';
                if (/Android/i.test(userAgent)) {
                    os = 'Android';
                    const androidMatch = userAgent.match(/Android.*?;\s([^;)]*)/i);
                    if (androidMatch && androidMatch[1]) {
                        deviceModel = androidMatch[1].trim();
                    }
                } else if (/iPhone|iPod/i.test(userAgent)) {
                    os = 'iOS';
                    deviceModel = /iPhone/i.test(userAgent) ? 'iPhone' : 'iPod';
                } else if (/Windows Phone/i.test(userAgent)) {
                    os = 'Windows Phone';
                }
            } else if (isTablet) {
                deviceType = 'Tablet';
                if (/iPad/i.test(userAgent)) {
                    os = 'iOS';
                    deviceModel = 'iPad';
                } else if (/Android/i.test(userAgent)) {
                    os = 'Android';
                    deviceModel = 'Android Tablet';
                }
            } else if (isTV) {
                deviceType = 'TV';
            } else {
                if (isMac) os = 'MacOS';
                else if (isWindows) os = 'Windows';
                else if (isLinux) os = 'Linux';
            }
        
            let browser = 'Unknown';
            if (/Edge/i.test(userAgent)) browser = 'Edge';
            else if (/OPR|Opera/i.test(userAgent)) browser = 'Opera';
            else if (/Chrome/i.test(userAgent) && !/Chromium|Edge|OPR|Opera/i.test(userAgent)) browser = 'Chrome';
            else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
            else if (/Safari/i.test(userAgent) && !/Chrome|Chromium|Edge|OPR|Opera/i.test(userAgent)) browser = 'Safari';
            else if (/MSIE|Trident/i.test(userAgent)) browser = 'Internet Explorer';
        
            return {
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                deviceType,
                deviceModel,
                os,
                browser,
                language: navigator.language || navigator.userLanguage,
                colorDepth: window.screen.colorDepth,
                pixelRatio: window.devicePixelRatio || 1,
                touchScreen: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
                userAgent
            };
        }

        function extractUrlInfo() {
            const url = document.referrer
            try {
                if (!url) return { base: null, domain: null };

                const urlObj = new URL(url);
                return {
                    refUrl: url,
                    base: urlObj.origin,
                    domain: urlObj.hostname
                };
            } catch (error) {
                console.error('Error extracting URL info:', error);
                return { base: null, domain: null };
            }
        }

        // Function to get all UTM parameters
        function getAllUtmParameters() {
            const urlParams = new URLSearchParams(window.location.search);
            const utmParams = {};

            // Standard UTM parameters
            const utmFields = [
                'utm_source', 'utm_medium', 'utm_campaign',
                'utm_term', 'utm_content', 'utm_device',
                'utm_devicemodel'
            ];

            utmFields.forEach(param => {
                const value = urlParams.get(param);
                if (value) {
                    utmParams[param] = value;
                }
            });

            // Additional tracking parameters
            const additionalParams = ['fbclid', 'msclkid', 'gclid'];

            additionalParams.forEach(param => {
                const value = urlParams.get(param);
                if (value) {
                    utmParams[param] = value;
                }
            });

            return utmParams;
        }

        // Function to store first touch UTM parameters
        function storeFirstTouchUtm() {
            const currentUtmParams = getAllUtmParameters();
            const firstTouchPrefix = 'first_';
            Object.entries(currentUtmParams).forEach(([key, value]) => {
                if (key.startsWith('utm_')) {
                    const firstTouchKey = firstTouchPrefix + key;
                    if (!getCookie(firstTouchKey) && value) {
                        setCookie(firstTouchKey, value, 365);
                    }
                }
            });

            // Store tracking IDs if present
            ['fbclid', 'msclkid', 'gclid'].forEach(param => {
                if (currentUtmParams[param] && !getCookie('first_' + param)) {
                    setCookie('first_' + param, currentUtmParams[param], 365);
                }
            });
        }

        // Function to get first touch UTM parameters
        function getFirstTouchUtm() {
            const firstTouchParams = {};
            const firstTouchPrefix = 'first_';

            // Standard UTM parameters with first_ prefix
            const utmFields = [
                'utm_source', 'utm_medium', 'utm_campaign',
                'utm_term', 'utm_content', 'fbclid',
                'msclkid', 'gclid'
            ];

            utmFields.forEach(param => {
                const firstTouchKey = firstTouchPrefix + param;
                const value = getCookie(firstTouchKey);
                if (value) {
                    firstTouchParams[firstTouchKey] = value;
                }
            });

            return firstTouchParams;
        }




        // Function to collect user-provided data (email, name, phone)
        function collectUserProvidedData() {
            return {
                email: getCookie('email') || null,
                fname: getCookie('fname') || null,
                phone: getCookie('phone') || null
            };
        }

        // Function to handle additional data fields
        function storeUserProvidedData(email, fname, phone) {
            if (email) {
                setCookie('email', email, 365);
                console.log('📧 Email stored in cookie:', email.substring(0, 3) + '***' + email.substring(email.indexOf('@')));
            }
            if (fname) {
                setCookie('fname', fname, 365);
                console.log('👤 Name stored in cookie:', fname);
            }
            if (phone) {
                setCookie('phone', phone, 365);
                console.log('📱 Phone number stored in cookie:', phone.substring(0, 4) + '***' + phone.substring(-4));
                console.log('🍪 Phone cookie set for SMS campaigns');
            }
        }

        // Function to track user session time
        function getSessionDuration() {
            const sessionStart = getCookie('sessionStart');
            if (!sessionStart) {
                setCookie('sessionStart', new Date().getTime(), 1);
                return 0;
            }

            return Math.floor((new Date().getTime() - parseInt(sessionStart)) / 1000);
        }

        // Function to track page engagement
        function trackPageEngagement() {
            let scrollDepth = 0;
            let maxScrollDepth = 0;
            let timeOnPage = 0;
            let startTime = new Date();

            // Track scroll depth
            window.addEventListener('scroll', () => {
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;
                const scrollPosition = window.scrollY;

                scrollDepth = Math.floor((scrollPosition + windowHeight) / documentHeight * 100);
                maxScrollDepth = Math.max(maxScrollDepth, scrollDepth);
            });

            // Track clicks
            document.addEventListener('click', (event) => {
                const target = event.target;
                const linkClicked = target.tagName === 'A' || target.closest('a');
                const buttonClicked = target.tagName === 'BUTTON' || target.closest('button');

                const interactionData = {
                    element: linkClicked ? 'link' : buttonClicked ? 'button' : target.tagName.toLowerCase(),
                    text: target.textContent?.trim().substring(0, 50) || null,
                    timestamp: new Date().toISOString(),
                    position: {
                        x: event.pageX,
                        y: event.pageY
                    }
                };

                updateInteractions('click', interactionData);
            });

            // Track form submissions
            document.addEventListener('submit', (event) => {
                const form = event.target;

                // Look for common personal data fields in the form
                let email = null;
                let fname = null;
                let phone = null;

                for (let i = 0; i < form.elements.length; i++) {
                    const element = form.elements[i];
                    if (!element.name || !element.value) continue;

                    // Check email fields
                    if (element.name.toLowerCase().includes('email') ||
                        element.type === 'email') {
                        email = element.value;
                    }

                    // Check name fields
                    if (element.name.toLowerCase().includes('name') ||
                        element.name.toLowerCase().includes('fname') ||
                        element.name.toLowerCase().includes('firstname')) {
                        fname = element.value;
                    }

                    // Check phone fields
                    if (element.name.toLowerCase().includes('phone') ||
                        element.name.toLowerCase().includes('tel') ||
                        element.type === 'tel') {
                        phone = element.value;
                    }
                }

                // Store the collected user data
                if (email || fname || phone) {
                    storeUserProvidedData(email, fname, phone);
                }

                const interactionData = {
                    formId: form.id || null,
                    formClass: form.className || null,
                    formElements: form.elements.length,
                    hasPersonalData: !!(email || fname || phone),
                    timestamp: new Date().toISOString()
                };

                updateInteractions('form_submit', interactionData);
            });

            // Update data before page unload
            window.addEventListener('beforeunload', () => {
                timeOnPage = Math.floor((new Date() - startTime) / 1000);

                const engagementData = {
                    timeOnPage: timeOnPage,
                    maxScrollDepth: maxScrollDepth,
                    timestamp: new Date().toISOString()
                };

                updateInteractions('page_exit', engagementData);
                updateUserCookieWithInteractions(getInteractions());
            });

            // Update every 60 seconds for long sessions
            setInterval(() => {
                timeOnPage = Math.floor((new Date() - startTime) / 1000);

                const engagementData = {
                    timeOnPage: timeOnPage,
                    maxScrollDepth: maxScrollDepth,
                    timestamp: new Date().toISOString()
                };

                updateInteractions('periodic_update', engagementData);
                updateUserCookieWithInteractions(getInteractions());
            }, 60000);
        }

        // Store interactions
        let interactionsArray = [];

        // Function to add interactions
        function updateInteractions(type, data) {
            interactionsArray.push({
                type: type,
                data: data,
                url: window.location.href,
                timestamp: new Date().toISOString()
            });

            // Limit array size to prevent memory issues
            if (interactionsArray.length > 50) {
                interactionsArray = interactionsArray.slice(-50);
            }
        }

        // Function to get current interactions
        function getInteractions() {
            return interactionsArray;
        }

        // Function to update the user's cookie with the latest interactions
        function updateUserCookieWithInteractions(interactions) {
            const userCookie = getCookie('userCookie');

            if (userCookie) {
                try {
                    const userCookieData = JSON.parse(userCookie);

                    // Update data
                    userCookieData.lastSeen = new Date().toISOString();
                    userCookieData.urlpt_url = window.location.href;
                    userCookieData.sessionDuration = getSessionDuration();
                    userCookieData.interactions = interactions;

                    // Update user provided data if available
                    const userData = collectUserProvidedData();
                    if (userData.email) userCookieData.email = userData.email;
                    if (userData.fname) userCookieData.fname = userData.fname;
                    if (userData.phone) userCookieData.phone = userData.phone;

                    setCookie('userCookie', JSON.stringify(userCookieData), 365);
                    return userCookieData

                    // Send the user cookie data to the server
                    // postUserDataToServer(userCookieData);
                } catch (error) {
                    console.error('Error updating user cookie:', error);
                }
            }
        }

        // Function to send user cookie data to the server with retry capability
        async function postUserDataToServer(userData) {
            console.log('newClientId: ', userId);
            const userCookieData = updateUserCookieWithInteractions(getInteractions())
            userData = { ...userData, ...userCookieData, clientId: typeof userId !== "undefined" ? userId : null, new: true }
            console.log('userData: ', userData);
            const firebaseUrl = '${process.env.BACKEND_URL}/api/visitors/add-visitors';

            try {
                const response = await fetch(firebaseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'include', // Include cookies if needed
                    body: JSON.stringify(userData),
                });

                if (!response.ok) {
                    throw new Error(\`Server responded with status \${response.status}: \${response.statusText}\`);
                }

                const data = await response.json();
                console.log('Data posted successfully:', data);
                return data;
            } catch (error) {
               console.error(\`Error posting data to server\`, error);
               
               // Log more detailed error information for debugging
               if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                   console.error('CORS or network error detected. Check if the API endpoint is accessible.');
               }
            }
        }

        //Function for the getting original ref
        function getOriginalRef() {
            const originalRef = getCookie('urlpt_original_ref');
            if (!originalRef && document.referrer) {
                setCookie('urlpt_original_ref', document.referrer, 365);
                return document.referrer
            }

            return originalRef

        }

        // Function for the getting hostname from the url
        function get_url_domain(url) {
            let a      = document.createElement('a');
            a.href = url;
            return a.hostname;
        }



        function getUrlVars() {
            var vars = {};
            window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
                vars[key] = decodeURIComponent(value);
            });
            return vars;
        }

        // Getting traffic details
        function getTrafficDetails(){
            var qvars = getUrlVars()
            let source = "Other";
            const originalRef = document.referrer == '' ? '' : this.get_url_domain(document.referrer)
            let this_domain = document.location.host

            if (originalRef == '') {
                source = "Direct";
            }else if ( originalRef.match(/google/i) !== null ){
                source = "Google";
            }else if ( originalRef.match(/yahoo/i) !== null ){
                source = "Yahoo";
            }else if ( originalRef.match(/bing/i) !== null ){
                source = "Bing";
            }else if ( originalRef.match(/instagram/i) !== null ){
                source = "Instagram";
            }else if ( originalRef.match(/facebook/i) !== null || originalRef.match(/fb\.com$/i) !== null ){
                source = "Facebook";
            }else if ( originalRef.match(/twitter/i) !== null || originalRef.match(/t\.co$/i) !== null ){
                source = "Twitter";
            }else if ( originalRef.match(/snapchat/i) !== null ){
                source = "Snapchat";
            }else if ( originalRef.match(/youtube/i) !== null ){
                source = "YouTube";
            }else if ( originalRef.match(/pinterest/i) !== null ){
                source = "Pinterest";
            }else if ( originalRef.match(/linkedin/i) !== null ){
                source = "LinkedIn";
            }else if ( originalRef.match(/tumblr/i) !== null ){
                source = "Tumblr";
            }else if ( originalRef.match(/duckduckgo/i) !== null ){
                source = "Duckduckgo";
            }else if (this_domain == originalRef){
                source = "Internal";
            }

            let trafficSource = 'Other'
            if (
                Object.keys(qvars).indexOf('gclid') != -1 ||
                Object.keys(qvars).indexOf('msclkid') != -1 ||
                (getCookie('fbclid') != undefined && getCookie('_fbc') != undefined) ||
                (Object.keys(qvars).indexOf('fbclid') != -1 && getCookie('_fbc') != undefined)
            ){
                trafficSource = 'Paid'
            }else if ( ['Google','Bing','Yahoo','Duckduckgo'].indexOf(source) > -1 ){
                trafficSource = 'Organic'
            }else if ( ['Facebook','Twitter','Instagram','Snapchat','YouTube','Pinterest','LinkedIn','Tumblr'].indexOf(source) > -1 ){
                trafficSource = 'Social'
            }else if ( ['Internal','Direct'].indexOf(source) > -1 ){
                trafficSource = 'Direct'
            }else if ( source && ['Internal'].indexOf(source) == -1 ){
                trafficSource = 'Referral'
            }

            // Setting up first traffic source
            let firstTrafficSource = getCookie('first_traffic_source')
            if(!firstTrafficSource){
                setCookie('first_traffic_source', trafficSource, 365)
                firstTrafficSource = trafficSource
            }
            

            const trafficData =  {
                trafficSource, firstTrafficSource
            }

            if(trafficSource === 'Organic'){
                trafficData['organicSourceStr'] = source
                trafficData['organicSource'] = document.referrer
            }else{
                trafficData['organicSourceStr'] = null
                trafficData['organicSource'] = null
            }

            return trafficData
            
        }


        // Initialize tracking system
        async function initializeTracking() {
            try {
                storeFirstTouchUtm();
                const userIp = await getUserIp();
                const deviceInfo = getUserDeviceInfo();

                const urlInfo = extractUrlInfo(window.location.href);

                // Create or update user cookie
                const userCookie = getCookie('userCookie');

                const visitId = new Date().getTime()
                setCookie('visitId', visitId, 365)

                const currentUtm = getAllUtmParameters();
                const firstTouchUtm = getFirstTouchUtm();
                const fbIds = getFacebookIds();
                const userData = collectUserProvidedData();

                const trafficDetails = getTrafficDetails()


                const trackingData = {
                    // Identifiers
                    urlpt_ip: userIp,
                    visitorId: generateUniqueUserID(),
                    visitId: visitId,
                    gaclientid: getGaClientId(),

                    // Current UTM parameters
                    utm_source: currentUtm.utm_source || null,
                    utm_medium: currentUtm.utm_medium || null,
                    utm_campaign: currentUtm.utm_campaign || null,
                    utm_term: currentUtm.utm_term || null,
                    utm_content: currentUtm.utm_content || null,

                    // First touch UTM parameters
                    first_utm_source: firstTouchUtm.first_utm_source || null,
                    first_utm_medium: firstTouchUtm.first_utm_medium || null,
                    first_utm_campaign: firstTouchUtm.first_utm_campaign || null,
                    first_utm_term: firstTouchUtm.first_utm_term || null,
                    first_utm_content: firstTouchUtm.first_utm_content || null,

                    fbclid: currentUtm.fbclid || null,
                    msclkid: currentUtm.msclkid || null,
                    gclid: currentUtm.gclid || null,

                    // Landing page info
                    urlpt_original_ref: getOriginalRef(),
                    urlpt_landing_page: getLandingPage(),
                    urlpt_landing_page_base: new URL(getLandingPage()).origin,


                    // Referrer info
                    urlpt_ref: document.referrer,
                    urlpt_ref_domain: document.referrer == '' ? '' : this.get_url_domain(document.referrer),


                    // Current page info
                    urlpt_url: document.location.href,
                    urlpt_url_base: document.location.hostname + document.location.pathname,
                    domain: document.location.hostname,

                    // Traffic sources
                    traffic_source: trafficDetails.trafficSource,
                    first_traffic_source: trafficDetails.firstTrafficSource,
                    organic_source: trafficDetails.organicSource,
                    organic_source_str: trafficDetails.organicSourceStr,

                    // User data if available
                    email: userData.email,
                    fname: userData.fname,
                    phone: userData.phone,

                    // Device and technical info  
                    user_agent: deviceInfo.userAgent,
                    deviceInfo: deviceInfo,
                    utm_device: deviceInfo.deviceType,
                    utm_devicemodel: deviceInfo.deviceModel,


                    // Facebook tracking
                    _fbc: fbIds.fbc,
                    _fbp: fbIds.fbp,

                    // Timestamps
                    firstSeen: userCookie ? JSON.parse(userCookie).firstSeen : new Date().toISOString(),
                    lastSeen: new Date().toISOString(),

                    // Session info
                    sessionDuration: getSessionDuration(),
                    sessionCount: parseInt(getCookie('sessionCount') || '0') + 1,

                    // Interactions array
                    interactions: []
                };


                // Save user data
                setCookie('userCookie', JSON.stringify(trackingData), 365);
                setCookie('sessionCount', trackingData.sessionCount.toString(), 365);
                postUserDataToServer(trackingData);
                trackPageEngagement();

                console.log('Tracking initialized successfully');

            } catch (error) {
                console.error('Error initializing tracking:', error);
            }
        }
   initializeTracking();
`
    const minifiedCode = await getMinifiedCode(script)
    return minifiedCode
}



// Your function that generates the script
const createMainScript = async (user) => {
    const script = await getMainScript(user); // JS code as a string
    const fileName = `${user._id}-main.js`;
    const filePath = path.join(__dirname, '..', 'scripts', fileName);


    try {
        await fs.writeFile(filePath, script, 'utf8');
        const isExists = await scriptModel.findOne({ name: fileName })

        if (!isExists) {
            await scriptModel.create({ name: fileName, userId: user._id, isActive: true })
        }
    } catch (error) {
        console.error('Error writing file:', error);
    }
};

module.exports = {
    createMainScript,
    getMinifiedCode
}
