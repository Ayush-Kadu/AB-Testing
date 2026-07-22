const campaignActionModel = require("../models/campaignActionModel");
const campaignTriggerModel = require("../models/campaignTriggerModel");
const campaignTypeModel = require("../models/campaignTypeModel");
const filtersModel = require("../models/filtersModel");
const Campaign = require("../models/user.campaign.model");
const mongoose = require('mongoose');
const { createCampaignScript } = require("../utils/createScript");
const ErrorHandler = require("../utils/errorHandler");
const { uploadFileToS3 } = require("../utils/uploadHelper");
const { getMinifiedCode } = require("../utils/scriptUtils");
const CampaignTrack = require('../models/campaignTrackModel')
const AppearLogModel = require('../models/appearLogModel')
const Conversion = require('../models/conversion.model');
const EmailSubmission = require('../models/emailSubmission.model');
const SMSActivity = require('../models/SMSActivity.model');
const EmailActivity = require('../models/emailActivity.model');
const { sendWhatsApp } = require('../utils/whatsappHelper');
const whatsappLogger = require('../utils/whatsappLogger');
const campaignLogger = require('../utils/campaignLogger');

// Filter script generation function
const generateFilterScript = (filters = [], campaignId) => {
    console.log('🔍 Generating filter script with filters:', filters, 'for campaign:', campaignId);

    // Create unique variable names for this campaign
    const filterPassedVar = `campaignFilterPassed_${campaignId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const visitorDataVar = `visitorData_${campaignId.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Create a script that sets up campaign-specific variables
    const campaignSetupScript = `
        // Campaign-specific variable setup for ${campaignId}
        window.${filterPassedVar} = undefined;
    `;

    // Cookie-based filters - these are stored in browser cookies
    const cookieFilter = [
        "visitorId", "visitId", "urlpt_landing_page", "urlpt_landing_page_base",
        "_fbc", "_fbp", "urlpt_original_ref", "urlpt_ref", "urlpt_ref_domain",
        "urlpt_url", "urlpt_url_base", "email", "name", "mobile", "gaclientid"
    ];

    // URL parameter filters - these come from current URL parameters
    const paramsFilter = [
        'utm_source', 'utm_medium', 'utm_campaign',
        'utm_term', 'utm_content', 'utm_device', 'utm_devicemodel'
    ];

    // First touch UTM filters - these are stored in cookies with 'first_' prefix
    const firstTouchUTM = [
        'first_utm_source', 'first_utm_medium', 'first_utm_campaign',
        'first_utm_term', 'first_utm_content', 'first_utm_device',
        'first_utm_devicemodel', 'first_fbclid', 'first_msclkid', 'first_gclid'
    ];

    // Location-based filters - these require API calls
    const locationFilter = [
        'country', 'state', 'city'
    ];

    // Traffic source filters - these are computed from traffic data
    const trafficSourceFilter = [
        'traffic_source', 'first_traffic_source', 'organic_source', 'organic_source_str'
    ];

    // Device info filters - these come from device detection
    const deviceFilter = [
        'utm_device', 'utm_devicemodel', 'user_agent'
    ];

    // IP-based filters - these require API calls
    const ipFilter = [
        'urlpt_ip'
    ];

    // Cookie name mapping for special cases
    const cookieKey = {
        "visitorId": 'visitorId',
        "visitId": 'visitId',
        'gaclientid': '_ga',
        "_fbc": "_fbc",
        "_fbp": "_fbp",
        "email": "email",
        "name": "fname",
        "mobile": "phone",
        "urlpt_ip": "urlpt_ip",
        "traffic_source": "traffic_source",
        "first_traffic_source": "first_traffic_source",
        "organic_source": "organic_source",
        "organic_source_str": "organic_source_str"
    };

    // Device info script for device detection
    const deviceInfoScript = `
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
                    const androidMatch = userAgent.match(/\\(Linux;.*?; ([^;]+)(?:Build|[;)])\/i);
                    if (androidMatch && androidMatch[1]) {
                        deviceModel = androidMatch[1].trim();
                    }
                } else if (/iPhone|iPod/i.test(userAgent)) {
                    os = 'iOS';
                    deviceModel = /iPhone|iPod/i.test(userAgent) ?
                        (userAgent.match(/iPhone\\s*([^;]+)/i) ?
                            userAgent.match(/iPhone\\s*([^;]+)/i)[1] : 'iPhone') : 'iPod';
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
            if (/Chrome/i.test(userAgent) && !/Chromium|Edge|OPR|Opera/i.test(userAgent)) browser = 'Chrome';
            else if (/Firefox/i.test(userAgent)) browser = 'Firefox';
            else if (/Safari/i.test(userAgent) && !/Chrome|Chromium|Edge|OPR|Opera/i.test(userAgent)) browser = 'Safari';
            else if (/Edge/i.test(userAgent)) browser = 'Edge';
            else if (/Opera|OPR/i.test(userAgent)) browser = 'Opera';
            else if (/MSIE|Trident/i.test(userAgent)) browser = 'Internet Explorer';

            return {
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                deviceType: deviceType,
                deviceModel: deviceModel,
                os: os,
                browser: browser,
                language: navigator.language || navigator.userLanguage,
                colorDepth: window.screen.colorDepth,
                pixelRatio: window.devicePixelRatio || 1,
                touchScreen: ('ontouchstart' in window) || (navigator.maxTouchPoints > 0),
                userAgent: userAgent
            };
        }
    `;

    let script = `
        (async function() {
            console.log('🚀 Filter script starting execution for campaign: ${campaignId}');
            console.log('📊 Total filters to evaluate:', ` + (filters ? filters.length : 0) + `);
            console.log('🔧 Filter script variables:');
            console.log('   - Filter Passed Var: ${filterPassedVar}');
            console.log('   - Campaign ID: ${campaignId}');
            
            ${campaignSetupScript}

            // Shared cookie reader. This filter-evaluation script runs in its own
            // <script> tag, in a separate scope from both the main tracking script
            // and from evaluateFilters()'s own copy further below — loadVisitorData()
            // needs its own reference since it runs before evaluateFilters is invoked.
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

            // Load visitor data from cookies and other sources.
            // The main tracking script writes the 'userCookie' cookie asynchronously
            // (after an external IP lookup that can be slow or fail outright if it's
            // blocked by an ad/privacy blocker or the network is unreachable) — so on
            // a fresh pageview it may not exist yet the instant this script runs.
            // Retry briefly (up to ~2s) instead of immediately treating "not written
            // yet" as "no visitor data", so a slow/blocked IP lookup elsewhere on the
            // page can't wrongly fail cookie-based audience filters and hide the
            // campaign entirely.
            window.${visitorDataVar}_retries = 0;
            function loadVisitorData() {
                console.log('📥 Loading visitor data for campaign: ${campaignId}');
                const userCookie = getCookie('userCookie');
                if (userCookie) {
                    try {
                        window.visitorData = JSON.parse(userCookie);
                        console.log('📊 Visitor data loaded from cookie for campaign ${campaignId}:', window.visitorData);
                    } catch (error) {
                        console.error('❌ Error parsing user cookie:', error);
                        window.visitorData = {};
                    }
                    console.log('🔍 Starting filter evaluation for campaign: ${campaignId}');
                    evaluateFilters();
                    return;
                }

                if (window.${visitorDataVar}_retries < 20) {
                    window.${visitorDataVar}_retries++;
                    setTimeout(loadVisitorData, 100);
                    return;
                }

                console.log('⚠️ No user cookie found after waiting - using fallback data sources');
                window.visitorData = {};
                console.log('🔍 Starting filter evaluation for campaign: ${campaignId}');
                evaluateFilters();
            }

            // Load visitor data and start filter evaluation
            loadVisitorData();

            // Filter evaluation function
        async function evaluateFilters() {
            console.log('🔍 Starting filter evaluation...');
            
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

            function getParams(param) {
                const urlParams = new URLSearchParams(window.location.search);
                const value = urlParams.get(param);
                return value ? value : null;
            }
            
            function get_url_domain(url) {
                let a = document.createElement('a');
                a.href = url;
                return a.hostname;
            }
            
            function getUrlVars() {
                var vars = {};
                window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
                    vars[key] = decodeURIComponent(value);
                });
                return vars;
            }

            function setCookie(name, value, daysToExpire) {
                const date = new Date();
                date.setTime(date.getTime() + daysToExpire * 24 * 60 * 60 * 1000);
                const expires = 'expires=' + date.toUTCString();
                const secure = location.protocol === 'https:' ? '; secure' : '';
                const sameSite = '; SameSite=Lax';
                document.cookie = name + '=' + encodeURIComponent(value) + '; ' + expires + sameSite + secure + '; path=/';
            }

            function getTrafficDetails() {
                var qvars = getUrlVars()
                let source = "Other";
                const originalRef = document.referrer == '' ? '' : get_url_domain(document.referrer)
                let this_domain = document.location.host

                if (originalRef == '') {
                    source = "Direct";
                } else if (originalRef.match(/google/i) !== null) {
                    source = "Google";
                } else if (originalRef.match(/yahoo/i) !== null) {
                    source = "Yahoo";
                } else if (originalRef.match(/bing/i) !== null) {
                    source = "Bing";
                } else if (originalRef.match(/instagram/i) !== null) {
                    source = "Instagram";
                } else if (originalRef.match(/facebook/i) !== null || originalRef.match(/fb.com/i) !== null) {
                    source = "Facebook";
                } else if (originalRef.match(/twitter/i) !== null || originalRef.match(/\\.co$/i) !== null) {
                    source = "Twitter";
                } else if (originalRef.match(/snapchat/i) !== null) {
                    source = "Snapchat";
                } else if (originalRef.match(/youtube/i) !== null) {
                    source = "YouTube";
                } else if (originalRef.match(/pinterest/i) !== null) {
                    source = "Pinterest";
                } else if (originalRef.match(/linkedin/i) !== null) {
                    source = "LinkedIn";
                } else if (originalRef.match(/tumblr/i) !== null) {
                    source = "Tumblr";
                } else if (originalRef.match(/duckduckgo/i) !== null) {
                    source = "Duckduckgo";
                } else if (this_domain == originalRef) {
                    source = "Internal";
                }

                let trafficSource = 'Other'
                if (
                    Object.keys(qvars).indexOf('gclid') != -1 ||
                    Object.keys(qvars).indexOf('msclkid') != -1 ||
                    (getCookie('fbclid') != undefined && getCookie('_fbc') != undefined) ||
                    (Object.keys(qvars).indexOf('fbclid') != -1 && getCookie('_fbc') != undefined)
                ) {
                    trafficSource = 'Paid'
                } else if (['Google', 'Bing', 'Yahoo', 'Duckduckgo'].indexOf(source) > -1) {
                    trafficSource = 'Organic'
                } else if (['Facebook', 'Twitter', 'Instagram', 'Snapchat', 'YouTube', 'Pinterest', 'LinkedIn', 'Tumblr'].indexOf(source) > -1) {
                    trafficSource = 'Social'
                } else if (['Internal', 'Direct'].indexOf(source) > -1) {
                    trafficSource = 'Direct'
                } else if (source && ['Internal'].indexOf(source) == -1) {
                    trafficSource = 'Referral'
                }

                let firstTrafficSource = getCookie('first_traffic_source')
                if (!firstTrafficSource) {
                    setCookie('first_traffic_source', trafficSource, 365)
                    firstTrafficSource = trafficSource
                }

                const trafficData = {
                    trafficSource, firstTrafficSource
                }

                if (trafficSource === 'Organic') {
                    trafficData['organicSourceStr'] = source
                    trafficData['organicSource'] = document.referrer
                } else {
                    trafficData['organicSourceStr'] = null
                    trafficData['organicSource'] = null
                }

                return trafficData
            }
            
            const trafficData = getTrafficDetails()

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
            
            ${deviceInfoScript}
            
            const filters = ` + JSON.stringify(filters) + `;
            
            // Initialize filter tracking variables
            let passedFilters = 0;
            let totalFilters = filters ? filters.length : 0;
            
            if(filters && filters.length){
                
                for(let i = 0; i<filters.length; i++){
                    const filter = filters[i]
                    
                    // Add debug logging for filter evaluation
                    console.log('🔍 Evaluating filter ' + (i + 1) + '/' + filters.length + ':', { 
                        field: filter.field, 
                        value: filter.value, 
                        condition: filter.condition || 'contains' 
                    });
                    
                    // Helper function to check filter condition
                    function checkFilterCondition(value, filterValue, condition) {
                        if (!value) return false;
                        const val = value.toString().toLowerCase();
                        const filterVal = filterValue.toString().toLowerCase();
                        
                        console.log('🔍 Checking condition:', { value: val, filterValue: filterVal, condition: condition });
                        
                        switch (condition) {
                            case 'equal':
                                const equalResult = val === filterVal;
                                console.log('✅ Equal condition result:', equalResult);
                                return equalResult;
                                
                            case 'not_equal':
                                const notEqualResult = val !== filterVal;
                                console.log('❌ Not Equal condition result:', notEqualResult);
                                return notEqualResult;
                                
                            case 'contains':
                                const containsResult = val.includes(filterVal);
                                console.log('✅ Contains condition result:', containsResult);
                                return containsResult;
                                
                            case 'not_contains':
                                const notContainsResult = !val.includes(filterVal);
                                console.log('❌ Not Contains condition result:', notContainsResult);
                                return notContainsResult;
                                
                            case 'include':
                                // Handle comma-separated values (multiple options)
                                const includeValues = filterVal.split(',').map(v => v.trim());
                                const includeResult = includeValues.some(value => val.includes(value));
                                console.log('✅ Include condition result:', includeResult, 'for values:', includeValues);
                                return includeResult;
                                
                            case 'exclude':
                                // Handle comma-separated values (multiple options)
                                const excludeValues = filterVal.split(',').map(v => v.trim());
                                const excludeResult = !excludeValues.some(value => val.includes(value));
                                console.log('❌ Exclude condition result:', excludeResult, 'for values:', excludeValues);
                                return excludeResult;
                                
                            case 'starts_with':
                                const startsWithResult = val.startsWith(filterVal);
                                console.log('✅ Starts With condition result:', startsWithResult);
                                return startsWithResult;
                                
                            case 'ends_with':
                                const endsWithResult = val.endsWith(filterVal);
                                console.log('✅ Ends With condition result:', endsWithResult);
                                return endsWithResult;
                                
                            case 'greater_than':
                                const greaterThanResult = Number(val) > Number(filterVal);
                                console.log('✅ Greater Than condition result:', greaterThanResult);
                                return greaterThanResult;
                                
                            case 'less_than':
                                const lessThanResult = Number(val) < Number(filterVal);
                                console.log('✅ Less Than condition result:', lessThanResult);
                                return lessThanResult;
                                
                            default:
                                // Fallback to contains for backward compatibility
                                const defaultResult = val.includes(filterVal);
                                console.log('✅ Default (contains) condition result:', defaultResult);
                                return defaultResult;
                        }
                    }
                    
                    // Cookie-based filters
                    if(` + JSON.stringify(cookieFilter) + `.includes(filter.field)){
                        var fieldValue = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined') {
                            if (filter.field === 'visitorId') {
                                fieldValue = window.visitorData.visitorId;
                            } else if (filter.field === 'visitId') {
                                fieldValue = window.visitorData.visitId;
                            } else if (filter.field === 'email') {
                                fieldValue = window.visitorData.email;
                            } else if (filter.field === 'name') {
                                fieldValue = window.visitorData.fname;
                            } else if (filter.field === 'mobile') {
                                fieldValue = window.visitorData.phone;
                            } else if (filter.field === 'gaclientid') {
                                fieldValue = window.visitorData.gaclientid;
                            } else if (filter.field === '_fbc') {
                                fieldValue = window.visitorData._fbc;
                            } else if (filter.field === '_fbp') {
                                fieldValue = window.visitorData._fbp;
                            } else if (filter.field === 'urlpt_ip') {
                                fieldValue = window.visitorData.urlpt_ip;
                            } else {
                                // For other cookie fields, try direct mapping
                                fieldValue = window.visitorData[filter.field];
                            }
                        }
                        
                        // Fallback to cookie if no visitor data
                        if (fieldValue === null || fieldValue === undefined) {
                            const cookieName = ` + JSON.stringify(cookieKey) + `[filter.field] || filter.field;
                            fieldValue = getCookie(cookieName);
                        }
                        
                        console.log('🍪 Cookie value for ' + filter.field + ':', fieldValue);
                        if (!checkFilterCondition(fieldValue, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: ' + filter.field + ' condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: ' + filter.field);
                        passedFilters++;
                    }
                    // Device info filters (check before URL params to avoid conflicts)
                    else if(` + JSON.stringify(deviceFilter) + `.includes(filter.field)){
                        // Try to get device info from visitor data first, fallback to browser detection
                        var deviceValue = null;
                        
                        // Check if we have visitor data with device info
                        if (typeof window.visitorData !== 'undefined') {
                            console.log('🔍 Checking device filter for:', filter.field);
                            console.log('📱 Visitor data deviceInfo:', window.visitorData.deviceInfo);
                            console.log('📱 Visitor data utm_device:', window.visitorData.utm_device);
                            console.log('📱 Visitor data utm_devicemodel:', window.visitorData.utm_devicemodel);
                            console.log('📱 Visitor data user_agent:', window.visitorData.user_agent);
                            
                            if (filter.field === 'utm_device') {
                                // Try deviceInfo.deviceType first, then direct utm_device
                                deviceValue = window.visitorData.deviceInfo ? window.visitorData.deviceInfo.deviceType : window.visitorData.utm_device;
                            } else if (filter.field === 'utm_devicemodel') {
                                // Try deviceInfo.deviceModel first, then direct utm_devicemodel
                                deviceValue = window.visitorData.deviceInfo ? window.visitorData.deviceInfo.deviceModel : window.visitorData.utm_devicemodel;
                            } else if (filter.field === 'user_agent') {
                                deviceValue = window.visitorData.user_agent;
                            }
                        }
                        
                        // Fallback to browser detection if no visitor data
                        if (!deviceValue) {
                            var deviceInfo = getUserDeviceInfo();
                            deviceValue = deviceInfo[filter.field === 'utm_device' ? 'deviceType' : filter.field === 'utm_devicemodel' ? 'deviceModel' : 'userAgent'];
                        }
                        
                        console.log('📱 Device value for ' + filter.field + ':', deviceValue);
                        if (!checkFilterCondition(deviceValue, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: ' + filter.field + ' condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: ' + filter.field);
                        passedFilters++;
                    }
                    // URL parameter filters
                    else if(` + JSON.stringify(paramsFilter) + `.includes(filter.field)){
                        var fieldValue = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined') {
                            if (filter.field === 'utm_source') {
                                fieldValue = window.visitorData.utm_source;
                            } else if (filter.field === 'utm_medium') {
                                fieldValue = window.visitorData.utm_medium;
                            } else if (filter.field === 'utm_campaign') {
                                fieldValue = window.visitorData.utm_campaign;
                            } else if (filter.field === 'utm_term') {
                                fieldValue = window.visitorData.utm_term;
                            } else if (filter.field === 'utm_content') {
                                fieldValue = window.visitorData.utm_content;
                            } else if (filter.field === 'utm_device') {
                                fieldValue = window.visitorData.utm_device;
                            } else if (filter.field === 'utm_devicemodel') {
                                fieldValue = window.visitorData.utm_devicemodel;
                            } else {
                                // For other UTM fields, try direct mapping
                                fieldValue = window.visitorData[filter.field];
                            }
                        }
                        
                        // Fallback to URL parameters if no visitor data
                        if (fieldValue === null || fieldValue === undefined) {
                            fieldValue = getParams(filter.field);
                        }
                        
                        console.log('🔗 URL param value for ' + filter.field + ':', fieldValue);
                        if (!checkFilterCondition(fieldValue, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: ' + filter.field + ' condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: ' + filter.field);
                        passedFilters++;
                    }
                    // First touch UTM filters
                    else if(` + JSON.stringify(firstTouchUTM) + `.includes(filter.field)){
                        var firstUTMParam = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined') {
                            if (filter.field === 'first_utm_source') {
                                firstUTMParam = window.visitorData.first_utm_source;
                            } else if (filter.field === 'first_utm_medium') {
                                firstUTMParam = window.visitorData.first_utm_medium;
                            } else if (filter.field === 'first_utm_campaign') {
                                firstUTMParam = window.visitorData.first_utm_campaign;
                            } else if (filter.field === 'first_utm_term') {
                                firstUTMParam = window.visitorData.first_utm_term;
                            } else if (filter.field === 'first_utm_content') {
                                firstUTMParam = window.visitorData.first_utm_content;
                            } else if (filter.field === 'first_utm_device') {
                                firstUTMParam = window.visitorData.first_utm_device;
                            } else if (filter.field === 'first_utm_devicemodel') {
                                firstUTMParam = window.visitorData.first_utm_devicemodel;
                            } else if (filter.field === 'first_fbclid') {
                                firstUTMParam = window.visitorData.fbclid;
                            } else if (filter.field === 'first_msclkid') {
                                firstUTMParam = window.visitorData.msclkid;
                            } else if (filter.field === 'first_gclid') {
                                firstUTMParam = window.visitorData.gclid;
                            } else {
                                // For other first touch fields, try direct mapping
                                firstUTMParam = window.visitorData[filter.field];
                            }
                        }
                        
                        // Fallback to cookie/URL parameter logic if no visitor data
                        if (firstUTMParam === null || firstUTMParam === undefined) {
                            function getFirstUTM(param) {
                                const firstTouchKey = param;
                                let value = getCookie(firstTouchKey);

                                if (!value) {
                                    const paramValue = getParams(param.replace('first_', ''));
                                    if (paramValue) {
                                        value = paramValue;
                                        setCookie(firstTouchKey, value, 365);
                                    }
                                }

                                return value || null;
                            }
                            
                            firstUTMParam = getFirstUTM(filter.field);
                        }
                        
                        console.log('🎯 First UTM value for ' + filter.field + ':', firstUTMParam);
                        if (!checkFilterCondition(firstUTMParam, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: ' + filter.field + ' condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: ' + filter.field);
                        passedFilters++;
                    }
                    // IP-based filters
                    else if(` + JSON.stringify(ipFilter) + `.includes(filter.field)){
                        var userIp = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined') {
                            if (filter.field === 'urlpt_ip') {
                                userIp = window.visitorData.urlpt_ip;
                            }
                        }
                        
                        // Fallback to API call if no visitor data
                        if (userIp === null || userIp === undefined) {
                            const getUserIp = async () => {
                                try {
                                    const ipData = await fetch('https://api.ipify.org?format=json');
                                    if (ipData.ok) {
                                        const data = await ipData.json();
                                        return data?.ip;
                                    }
                                    throw new Error('Failed to fetch IP');
                                } catch (error) {
                                    console.error('Error fetching IP:', error);
                                    return null;
                                }
                            };

                            userIp = await getUserIp();
                        }
                        
                        console.log('🌐 IP value:', userIp);
                        if (!checkFilterCondition(userIp, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: IP condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: IP');
                        passedFilters++;
                    }
                    // Location-based filters
                    else if(` + JSON.stringify(locationFilter) + `.includes(filter.field)){
                        var locationValue = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined') {
                            if (filter.field === 'country') {
                                locationValue = window.visitorData.country;
                            } else if (filter.field === 'state') {
                                locationValue = window.visitorData.state;
                            } else if (filter.field === 'city') {
                                locationValue = window.visitorData.city;
                            }
                        }
                        
                        // Fallback to API call if no visitor data
                        if (locationValue === null || locationValue === undefined) {
                            const getUserLocation = async () => {
                                try {
                                    const response = await fetch('https://ipapi.co/json/');
                                    if (response.ok) {
                                        const data = await response.json();
                                        return {
                                            ip: data.ip,
                                            city: data.city,
                                            region: data.region,
                                            country: data.country_name,
                                            postal: data.postal,
                                            timezone: data.timezone,
                                            latitude: data.latitude,
                                            longitude: data.longitude
                                        };
                                    }
                                    throw new Error('Failed to fetch location');
                                } catch (error) {
                                    console.error('Error fetching location:', error);
                                    return null;
                                }
                            };
                            
                            const userLocation = await getUserLocation();
                            console.log('📍 Location data from API:', userLocation);
                            locationValue = userLocation ? userLocation[filter.field] : null;
                        } else {
                            console.log('📍 Location data from visitor data:', locationValue);
                        }
                        
                        if (!checkFilterCondition(locationValue, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: ' + filter.field + ' condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: ' + filter.field);
                        passedFilters++;
                    }
                    // Traffic source filters
                    else if(` + JSON.stringify(trafficSourceFilter) + `.includes(filter.field)){
                        var trafficValue = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined') {
                            console.log('🚦 Checking traffic filter for:', filter.field);
                            console.log('🚦 Visitor data traffic_source:', window.visitorData.traffic_source);
                            console.log('🚦 Visitor data first_traffic_source:', window.visitorData.first_traffic_source);
                            console.log('🚦 Visitor data organic_source:', window.visitorData.organic_source);
                            console.log('🚦 Visitor data organic_source_str:', window.visitorData.organic_source_str);
                            
                            if (filter.field === 'traffic_source') {
                                trafficValue = window.visitorData.traffic_source;
                            } else if (filter.field === 'first_traffic_source') {
                                trafficValue = window.visitorData.first_traffic_source;
                            } else if (filter.field === 'organic_source') {
                                trafficValue = window.visitorData.organic_source;
                            } else if (filter.field === 'organic_source_str') {
                                trafficValue = window.visitorData.organic_source_str;
                            }
                        }
                        
                        // Fallback to computed traffic data if no visitor data
                        if (trafficValue === null || trafficValue === undefined) {
                            trafficValue = trafficData[filter.field === 'organic_source_str' ? 'organicSourceStr' : filter.field];
                        }
                        
                        console.log('🚦 Traffic value for ' + filter.field + ':', trafficValue);
                        if (!checkFilterCondition(trafficValue, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: ' + filter.field + ' condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: ' + filter.field);
                        passedFilters++;
                    }

                    // Special case filters
                    else if(filter.field === 'urlpt_ref'){
                        var referrer = document.referrer;
                        console.log('🔗 Referrer value:', referrer);
                        if (!checkFilterCondition(referrer, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: referrer condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: referrer');
                        passedFilters++;
                    }
                    else if(filter.field === 'urlpt_url'){
                        var fullUrl = window.location.href;
                        console.log('🌐 Full URL:', fullUrl);
                        if (!checkFilterCondition(fullUrl, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: URL condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: URL');
                        passedFilters++;
                    }
                    else if(filter.field === 'urlpt_ref_domain'){
                        var refDomain = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined' && window.visitorData.urlpt_ref_domain) {
                            refDomain = window.visitorData.urlpt_ref_domain;
                        } else {
                            // Fallback to current referrer
                            function getReferringDomain() {
                                const referrer = document.referrer;
                                if (!referrer) return null;
                                try {
                                    const url = new URL(referrer);
                                    return url.hostname;
                                } catch (error) {
                                    return null;
                                }
                            }
                            refDomain = getReferringDomain();
                        }
                        
                        console.log('🏠 Referrer domain:', refDomain);
                        if (!checkFilterCondition(refDomain, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: referrer domain condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: referrer domain');
                        passedFilters++;
                    }
                    else if(filter.field === 'urlpt_url_base'){
                        var urlBase = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined' && window.visitorData.urlpt_url_base) {
                            urlBase = window.visitorData.urlpt_url_base;
                        } else {
                            // Fallback to current URL
                            urlBase = window.location.hostname + window.location.pathname;
                        }
                        
                        console.log('🏠 URL base:', urlBase);
                        if (!checkFilterCondition(urlBase, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: URL base condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: URL base');
                        passedFilters++;
                    }
                    else if(filter.field === 'urlpt_landing_page_base'){
                        var landingPageBase = null;
                        
                        // Try to get from visitor data first
                        if (typeof window.visitorData !== 'undefined' && window.visitorData.urlpt_landing_page_base) {
                            landingPageBase = window.visitorData.urlpt_landing_page_base;
                            console.log('🏠 Landing page base from visitor data:', landingPageBase);
                        } else {
                            // Fallback to cookie
                            landingPageBase = getCookie('urlpt_landing_page');
                            console.log('🏠 Landing page base from cookie:', landingPageBase);
                        }
                        
                        if (landingPageBase) {
                            try {
                                const url = new URL(landingPageBase);
                                var baseUrl = url.hostname + url.pathname;
                                console.log('🏠 Processed landing page base:', baseUrl);
                                if (!checkFilterCondition(baseUrl, filter.value, filter.condition || 'contains')) {
                                    console.log('❌ Filter failed: landing page base condition not met');
                                    continue;
                                }
                                console.log('✅ Filter passed: landing page base');
                                passedFilters++;
                            } catch (error) {
                                console.log('❌ Filter failed: invalid landing page URL');
                                continue;
                            }
                        } else {
                            console.log('❌ Filter failed: no landing page data');
                            continue;
                        }
                    }
                    // Default case - try to get from visitor data first, then cookie
                    else {
                        var fieldValue = null;
                        
                        // Check if we have visitor data
                        if (typeof window.visitorData !== 'undefined') {
                            fieldValue = window.visitorData[filter.field];
                        }
                        
                        // Fallback to cookie if no visitor data or field not found
                        if (fieldValue === null || fieldValue === undefined) {
                            fieldValue = getCookie(filter.field);
                        }
                        
                        console.log('🔍 Field value for ' + filter.field + ':', fieldValue);
                        if (!checkFilterCondition(fieldValue, filter.value, filter.condition || 'contains')) {
                            console.log('❌ Filter failed: ' + filter.field + ' condition not met');
                            continue;
                        }
                        console.log('✅ Filter passed: ' + filter.field);
                        passedFilters++;
                    }
                }
            } else {
                // No filters to evaluate - show campaign by default
                console.log('📊 No filters to evaluate - campaign will be shown by default');
                passedFilters = 1; // Treat as passed
            }
            
            // Check if at least one filter passed (OR logic)
            console.log('📊 Filter results for campaign ${campaignId}: ' + passedFilters + '/' + totalFilters + ' filters passed');
            if (passedFilters > 0) {
                console.log('✅ At least one filter passed - campaign ${campaignId} will be shown');
                window.${filterPassedVar} = true;
                return true;
            } else {
                console.log('❌ No filters passed - campaign ${campaignId} will not be shown');
                window.${filterPassedVar} = false;
                return false;
            }
        }
        
        // Execute the filter evaluation and set the result
        const filterResult = await evaluateFilters();
        if (!filterResult) {
            console.log('❌ Filter evaluation failed - campaign ${campaignId} will not be shown');
            window.${filterPassedVar} = false;
        }
        
        // Note: evaluateFilters() will be called by waitForVisitorData() when visitor data is available
        })();
    `;

    return script;
};


exports.getCampaignAdmin = async (req, res, next) => {
    try {
        const user = req.user;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * pageSize;

        // Exclude A/B test variant clones (isABTesting: true) — those are
        // shown on the A/B Testing page only, not the main Campaigns list.
        let matchCondition = { isABTesting: { $ne: true } };

        if (user.role === 'user') {
            matchCondition = { ...matchCondition, clientId: new mongoose.Types.ObjectId(user._id) };
        }

        const aggregateQuery = [
            { $match: matchCondition },  // ✅ Correct way to apply filters
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: pageSize },
            {
                $lookup: {
                    from: "users",
                    localField: "clientId",
                    foreignField: "_id",
                    as: "client",
                }
            },
            {
                $project: {
                    _id: 1,
                    clientId: 1,
                    heading: 1,
                    imageURL: 1,
                    popupContent: 1,
                    selectedOption: 1,
                    triggerType: 1,
                    onsiteAction: 1,
                    category: 1,
                    subCategory: 1,
                    pageTime: 1,
                    campaigndesignerName: 1,
                    scrollPercentage: 1,
                    hours: 1,
                    minutes: 1,
                    seconds: 1,
                    days: 1,
                    region: 1,
                    trafficSource: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    isActive: 1,
                    clicks: 1,
                    status: 1,
                    client: {
                        $cond: {
                            if: { $gt: [{ $size: "$client" }, 0] },
                            then: {
                                _id: { $arrayElemAt: ["$client._id", 0] },
                                firstName: { $arrayElemAt: ["$client.firstName", 0] },
                                lastName: { $arrayElemAt: ["$client.lastName", 0] }
                            },
                            else: null
                        }
                    }
                }
            }
        ];

        const campaigns = await Campaign.aggregate(aggregateQuery);

        const totalCampaigns = await Campaign.countDocuments(matchCondition);  // ✅ Correct filter for counting
        const totalPages = Math.ceil(totalCampaigns / pageSize);

        const campaignSinceSubscription = await Campaign.countDocuments({

            clientId: new mongoose.Types.ObjectId(user._id),
            createdAt: { $gte: req.query.subscriptionStartDate },
        });

        res.json({
            success: true,
            data: campaigns,
            totalCampaigns,
            totalPages,
            currentPage: page,
            campaignSinceSubscription
        });
    } catch (error) {
        return next(error);
    }
};

exports.getCampaignDropdown = async (req, res, next) => {
    try {
        const campaignTypes = await campaignTypeModel.find({ isDelete: false })
        const formattedData = campaignTypes.map(campaign => ({
            value: campaign.name,  // Assuming `name` is the field storing "Inline Action"
            label: campaign.name,
            _id: campaign._id
        }));
        res.json({
            success: true,
            data: formattedData
        })
    } catch (error) {
        return next(error);
    }
};
exports.getABCampaigns = async (req, res, next) => {
    try {
        const campaigns = await Campaign.find({});
        console.log(campaigns);
        const formatted = campaigns.map(c => ({
            value: c._id,
            label: c.campaignName
        }));

        return res.json({
            success: true,
            data: formatted
        });

    } catch (err) {
        next(err);
    }
};
exports.getCampaignAction = async (req, res, next) => {
    try {
        const aggregateQuery = [
            { $match: { isDelete: false } },
            {
                $lookup: {
                    from: 'campaign-types',
                    localField: 'campaignTypeId',
                    foreignField: '_id',
                    as: 'campaignType'
                }
            },
            {
                $unwind: {
                    path: "$campaignType",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    label: "$actionName",
                    value: "$actionName",
                    campaignTypeId: { $arrayElemAt: ["$campaignTypeId", 0] },
                    campaignTypeName: "$campaignType.name"
                }
            }
        ];

        const campaignAction = await campaignActionModel.aggregate(aggregateQuery);

        res.json({
            success: true,
            data: campaignAction
        });


    } catch (error) {
        return next(error);
    }
};
exports.getCampaignTriggers = async (req, res, next) => {
    try {
        const campaignTriggers = await campaignTriggerModel.find({ isDelete: false })
        const formattedData = campaignTriggers.map(campaign => ({
            value: campaign.triggerName,  // Assuming `name` is the field storing "Inline Action"
            label: campaign.triggerName,
            _id: campaign._id
        }));
        res.json({
            success: true,
            data: formattedData
        })
    } catch (error) {
        return next(error);
    }
};

exports.getFilters = async (req, res, next) => {
    try {
        const filters = await filtersModel.find()
        res.json({
            success: true,
            data: filters
        })
    } catch (error) {
        return next(error)
    }
}


exports.createNewCampaign = async (req, res, next) => {
    try {
        const payload = req.body
        delete payload.popupContent
        if (!payload.segmentId) {
            delete payload.segmentId
        }
        const user = req.user
        payload['clientId'] = new mongoose.Types.ObjectId(user._id)
        payload['campaigndesignerName'] = req.body.campaignName
        
        // Log WhatsApp template if present
        if (payload.whatsappTemplate) {
            console.log('📱 Creating campaign with WhatsApp template:', {
                templateName: payload.whatsappTemplate,
                category: payload.category,
                subCategory: payload.subCategory
            });
        }
        
        const campaign = await Campaign.create(payload)
        
        // Verify whatsappTemplate was saved
        if (payload.whatsappTemplate) {
            console.log('✅ Campaign created with WhatsApp template saved:', {
                campaignId: campaign._id,
                whatsappTemplate: campaign.whatsappTemplate
            });
        }
        
        res.json({
            success: true,
            data: campaign
        })
    } catch (error) {
        return next(error)
    }
}
exports.getCampaignById = async (req, res, next) => {
    try {
        const campaignId = req.params.id
        if (!campaignId) {
            return next(new ErrorHandler('Please provide a campaign ID'))
        }
        const campaign = await Campaign.findOne({ "_id": campaignId }).populate('templateId segmentId')
        if (!campaign) {
            return next(new ErrorHandler('Campaign not found!.'))
        }
        
        // Convert mongoose document to a plain object to avoid CastError/validation errors when modifying fields
        const campaignObj = campaign.toObject();
        
        // For SMS and WhatsApp campaigns, ensure the elements field is properly structured
        if (campaignObj.category === 'Send Action' && (campaignObj.subCategory === 'SMS' || campaignObj.subCategory === 'WhatsApp')) {
            // If elements exist directly on campaign, copy them to templateId for consistency
            if (campaignObj.elements && campaignObj.elements.length > 0) {
                if (!campaignObj.templateId) {
                    campaignObj.templateId = {};
                }
                campaignObj.templateId.elements = campaignObj.elements;
            }
        }
        
        res.json({
            success: true,
            data: campaignObj
        })
    } catch (error) {
        return next(error)
    }
}

// 🚀 Get Active SMS Campaigns for Form Tracking Script
exports.getActiveSMSCampaigns = async (req, res, next) => {
    try {
        console.log('📱 Get Active SMS Campaigns API Called:', {
            timestamp: new Date().toISOString(),
            userId: req.query.userId
        });

        const { userId } = req.query;
        
        if (!userId) {
            console.log('❌ No userId provided');
            return res.status(400).json({ 
                success: false, 
                message: "User ID is required" 
            });
        }

        console.log('🔍 Searching for active SMS campaigns...');
        
        // Find active SMS campaigns for this user (include filters and triggers)
        const activeSMSCampaigns = await Campaign.find({
            clientId: new mongoose.Types.ObjectId(userId),
            category: 'Send Action',
            subCategory: 'SMS',
            isActive: true
         }).select('_id name category subCategory elements filters triggerType timeOnPage scroll startTime endTime noOfTimeToShow');

        console.log('📋 Active SMS Campaigns Found:', {
            count: activeSMSCampaigns.length,
            campaigns: activeSMSCampaigns.map(c => ({
                id: c._id,
                name: c.name,
                category: c.category,
                subCategory: c.subCategory
            }))
        });

        res.json({
            success: true,
            campaigns: activeSMSCampaigns,
            count: activeSMSCampaigns.length
        });

    } catch (error) {
        console.error('❌ Error in getActiveSMSCampaigns:', error);
        return next(error);
    }
};

// 📧 Get Active Email Campaigns for Form Tracking Script
exports.getActiveEmailCampaigns = async (req, res, next) => {
    try {
        console.log('📧 Get Active Email Campaigns API Called:', {
            timestamp: new Date().toISOString(),
            userId: req.query.userId
        });

        const { userId } = req.query;
        
        if (!userId) {
            console.log('❌ No userId provided');
            return res.status(400).json({ 
                success: false, 
                message: "User ID is required" 
            });
        }

        console.log('🔍 Searching for active email campaigns...');
        
        // Find active email campaigns for this user (include filters and triggers)
        const activeEmailCampaigns = await Campaign.find({
            clientId: new mongoose.Types.ObjectId(userId),
            category: 'Send Action',
            subCategory: 'Email',
            isActive: true
        }).select('_id name category subCategory elements filters triggerType timeOnPage scroll startTime endTime noOfTimeToShow');

        console.log('📋 Active Email Campaigns Found:', {
            count: activeEmailCampaigns.length,
            campaigns: activeEmailCampaigns.map(c => ({
                id: c._id,
                name: c.name,
                category: c.category,
                subCategory: c.subCategory
            }))
        });

        res.json({
            success: true,
            campaigns: activeEmailCampaigns,
            count: activeEmailCampaigns.length
        });

    } catch (error) {
        console.error('❌ Error in getActiveEmailCampaigns:', error);
        return next(error);
    }
};

// 📱 Get Active WhatsApp Campaigns for Form Tracking Script
exports.getActiveWhatsAppCampaigns = async (req, res, next) => {
    try {
        console.log('📱 Get Active WhatsApp Campaigns API Called:', {
            timestamp: new Date().toISOString(),
            userId: req.query.userId
        });

        const { userId } = req.query;
        
        if (!userId) {
            console.log('❌ No userId provided');
            return res.status(400).json({ 
                success: false, 
                message: "User ID is required" 
            });
        }

        console.log('🔍 Searching for active WhatsApp campaigns...');
        
        // Find active WhatsApp campaigns for this user (include filters and triggers)
        const activeWhatsAppCampaigns = await Campaign.find({
            clientId: new mongoose.Types.ObjectId(userId),
            category: 'Send Action',
            subCategory: 'WhatsApp',
            isActive: true
        }).select('_id name category subCategory elements whatsappTemplate filters triggerType timeOnPage scroll startTime endTime noOfTimeToShow');

        campaignLogger.info('ACTIVE_CAMPAIGNS', 'Active WhatsApp Campaigns Details', {
            count: activeWhatsAppCampaigns.length,
            campaigns: activeWhatsAppCampaigns.map(c => ({
                id: c._id,
                name: c.name,
                category: c.category,
                subCategory: c.subCategory,
                hasElements: !!c.elements?.length,
                whatsappTemplate: c.whatsappTemplate || 'NOT SET (will use hello_world)'
            }))
        });

        console.log('📋 Active WhatsApp Campaigns Found:', {
            count: activeWhatsAppCampaigns.length,
            campaigns: activeWhatsAppCampaigns.map(c => ({
                id: c._id,
                name: c.name,
                category: c.category,
                subCategory: c.subCategory
            }))
        });

        res.json({
            success: true,
            campaigns: activeWhatsAppCampaigns,
            count: activeWhatsAppCampaigns.length
        });

    } catch (error) {
        console.error('❌ Error in getActiveWhatsAppCampaigns:', error);
        return next(error);
    }
};

exports.updateCampaign = async (req, res, next) => {
    try {
        const campaignId = req.params.id;
        if (!campaignId) {
            return next(new ErrorHandler('Please provide a campaign ID'));
        }
        const user = req.user
        const payload = req.body
        if (!payload.segmentId) {
            delete payload.segmentId
        }
        if (payload.templateId) {
            payload['templateId'] = new mongoose.Types.ObjectId(payload.templateId)
        }
        // Only update isActive if status is explicitly provided
        if (payload.status === 'published') {
            payload['isActive'] = true;
        } else if (payload.status === 'draft') {
            payload['isActive'] = false;
        }
        // If status is not provided, preserve the existing isActive value
        payload['campaigndesignerName'] = req.body.campaignName
        
        // Log WhatsApp template if present
        if (payload.whatsappTemplate) {
            console.log('📱 Updating campaign with WhatsApp template:', {
                campaignId,
                templateName: payload.whatsappTemplate,
                category: payload.category,
                subCategory: payload.subCategory
            });
        }
        
        // createPopScript(payload.popUpContent, user._id, new Date())

        const campaign = await Campaign.findByIdAndUpdate(campaignId, payload, {
            new: true,
        });
        
        // Verify whatsappTemplate was saved
        if (payload.whatsappTemplate) {
            console.log('✅ Campaign updated with WhatsApp template saved:', {
                campaignId: campaign._id,
                whatsappTemplate: campaign.whatsappTemplate
            });
        }

        if (payload.popUpContent) {
            // Replace campaign ID placeholder with actual campaign ID
            let content = payload.popUpContent.replace(/\{\{CAMPAIGN_ID\}\}/g, campaignId);
            // Replace user ID placeholder with actual user ID
            content = content.replace(/\{\{USER_ID\}\}/g, user._id);

            // Replace showTeaser placeholder with actual value
            const showTeaser = payload.showTeaser !== undefined ? payload.showTeaser : true;
            content = content.replace(/\{\{SHOW_TEASER\}\}/g, showTeaser.toString());

            // If isActive is not set, preserve the existing campaign's isActive status
            let isActiveForScript = payload.isActive;
            if (isActiveForScript === undefined) {
                const existingCampaign = await Campaign.findById(campaignId);
                isActiveForScript = existingCampaign?.isActive ?? false;
            }
            await createCampaignScript(content, user._id, campaignId, isActiveForScript)
        }


        if (!campaign) {
            return next(new ErrorHandler('Campaign not found', 404));
        }
        res.json({
            success: true,
            data: campaign
        });
    } catch (error) {
        return next(error);
    }
};

exports.scriptUpdate = async (req, res, next) => {
    try {
        console.log('🔄 Script Update Request - Starting...');
        const user = req.user
        const payload = req.body
        const campaignId = req.params.id;
        const content = payload.popUpContent || '';
        const filters = payload.filters // Get filters from payload
        delete payload.popUpContent
        delete payload.filters // Remove filters from payload to avoid saving to DB

        console.log('🔧 Script Update Details:');
        console.log('   - Campaign ID:', campaignId);
        console.log('   - User ID:', user._id);
        console.log('   - Has Filters:', filters && filters.length > 0);
        console.log('   - Filter Count:', filters ? filters.length : 0);
        console.log('   - Filters Data:', JSON.stringify(filters, null, 2));
        console.log('   - Content Length:', content ? content.length : 0);

        // Only update isActive if status is explicitly provided
        if (payload.status === 'published') {
            payload['isActive'] = true;
            console.log('📊 Campaign Status: Published (Active)');
        } else if (payload.status === 'draft') {
            payload['isActive'] = false;
            console.log('📊 Campaign Status: Draft (Inactive)');
        } else {
            console.log('📊 Campaign Status: Not specified (preserving existing)');
        }

        // If status is not provided, preserve the existing isActive value
        if (!campaignId) {
            console.log('❌ Error: No campaign ID provided');
            return next(new ErrorHandler('Please provide a campaign ID'));
        }

        console.log('💾 Updating campaign in database...');
        await Campaign.findByIdAndUpdate(campaignId, payload, {
            new: true,
        });
        console.log('✅ Campaign updated in database');

        // Generate filter script if filters exist
        let filterScript = '';
        if (filters && filters.length > 0) {
            try {
                console.log('🔍 Generating filter script...');
                console.log('🔍 Filters being processed:', JSON.stringify(filters, null, 2));
                filterScript = generateFilterScript(filters, campaignId);
                console.log('✅ Filter script generated successfully for campaign:', campaignId);
                console.log('📏 Filter script length:', filterScript.length);
            } catch (filterError) {
                console.error('❌ Error generating filter script:', filterError);
                return next(new ErrorHandler('Error generating filter script: ' + filterError.message));
            }
        } else {
            console.log('ℹ️ No filters provided - skipping filter script generation');
            console.log('✅ Campaign will be visible to all visitors (no filters applied)');
        }

        // Combine filter script with campaign content
        let fullContent;
        if (filters && filters.length > 0) {
            // Create unique variable names for this campaign
            const filterPassedVar = `campaignFilterPassed_${campaignId.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const checkCountVar = `checkCount_${campaignId.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const maxChecksVar = `maxChecks_${campaignId.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const checkFilterFunctionVar = `checkFilterAndShowCampaign_${campaignId.replace(/[^a-zA-Z0-9]/g, '_')}`;

            console.log(`🔧 Campaign Script Generation - Campaign: ${campaignId}`);
            console.log(`🔧 Unique Variables Created:`);
            console.log(`   - Filter Passed Var: ${filterPassedVar}`);
            console.log(`   - Check Count Var: ${checkCountVar}`);
            console.log(`   - Max Checks Var: ${maxChecksVar}`);
            console.log(`   - Check Filter Function: ${checkFilterFunctionVar}`);

            // Wrap the campaign content with filter check and display count logic
            fullContent = filterScript + '\n' + `
                // Campaign Script for ${campaignId} - Generated at ${new Date().toISOString()}
                console.log('🚀 Campaign Script Loading - Campaign: ${campaignId}');
                console.log('🔧 Campaign Variables:');
                console.log('   - Filter Passed Var: ${filterPassedVar}');
                console.log('   - Check Count Var: ${checkCountVar}');
                console.log('   - Max Checks Var: ${maxChecksVar}');
                console.log('   - Check Filter Function: ${checkFilterFunctionVar}');
                console.log('   - No. of Time to Show: {{NO_OF_TIME_TO_SHOW}}');
                
                // Function to check display count limit
                async function checkDisplayCountLimit() {
                    try {
                        // The main tracking script writes the 'visitorId' cookie
                        // asynchronously (after an external IP lookup that can be
                        // slow or blocked) — poll briefly instead of reading it
                        // once, so a fresh pageview doesn't send visitorId: null
                        // and get folded into a shared "anonymous" appearance
                        // count that can trip the display limit for everyone.
                        let __visitorId = window.visitorId || getCookie('visitorId');
                        let __vidAttempts = 0;
                        while (!__visitorId && __vidAttempts < 20) {
                            await new Promise(function (r) { setTimeout(r, 100); });
                            __visitorId = window.visitorId || getCookie('visitorId');
                            __vidAttempts++;
                        }
                        const response = await fetch('http://localhost:5008/api/campaign/check-display-limit/${campaignId}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                visitorId: __visitorId,
                                visitId: window.visitId || getCookie('visitId')
                            })
                        });
                        
                        const result = await response.json();
                        console.log('📊 Display count check result:', result);
                        
                        if (result.success) {
                            if (result.canShow) {
                                console.log('✅ Display count limit not reached - showing campaign');
                                return true;
                            } else {
                                console.log('🚫 Display count limit reached - campaign will not show');
                                return false;
                            }
                        } else {
                            console.log('⚠️ Error checking display count - showing campaign as fallback');
                            return true;
                        }
                    } catch (error) {
                        console.log('⚠️ Error checking display count - showing campaign as fallback:', error);
                        return true;
                    }
                }
                
                // Wait for filter evaluation to complete
                let ${checkCountVar} = 0;
                const ${maxChecksVar} = 20; // Maximum 1 second (20 * 50ms)
                
                const ${checkFilterFunctionVar} = async () => {
                    console.log('🔄 ${checkFilterFunctionVar}() called - Campaign: ${campaignId}');
                    ${checkCountVar}++;
                    console.log('📊 Check count: ${checkCountVar}/${maxChecksVar} - Campaign: ${campaignId}');
                    
                    if (typeof window.${filterPassedVar} !== 'undefined') {
                        console.log('✅ Filter result available - Campaign: ${campaignId}');
                        if (window.${filterPassedVar}) {
                            console.log('✅ Filter passed - checking display count limit');
                            
                            // Check display count limit before showing campaign
                            const canShow = await checkDisplayCountLimit();
                            if (canShow) {
                                console.log('✅ Display count check passed - showing campaign ${campaignId}');
                                ${content}
                            } else {
                                console.log('🚫 Campaign ${campaignId} blocked by display count limit');
                            }
                        } else {
                            console.log('🚫 Campaign ${campaignId} blocked by filter');
                        }
                    } else if (${checkCountVar} < ${maxChecksVar}) {
                        console.log('⏳ Filter not ready yet, retrying in 50ms - Campaign: ${campaignId}');
                        // Fallback if filter script hasn't run yet
                        setTimeout(${checkFilterFunctionVar}, 50);
                    } else {
                        console.log('⚠️ Filter timeout - checking display count before showing campaign ${campaignId} as fallback');
                        
                        // Check display count limit before showing campaign as fallback
                        const canShow = await checkDisplayCountLimit();
                        if (canShow) {
                            console.log('✅ Display count check passed - showing campaign ${campaignId} as fallback');
                            ${content}
                        } else {
                            console.log('🚫 Campaign ${campaignId} blocked by display count limit (fallback)');
                        }
                    }
                };
                
                // Start checking for filter result
                console.log('🎯 Starting filter check for campaign: ${campaignId}');
                ${checkFilterFunctionVar}();
            `;
        } else {
            console.log(`🔧 Campaign Script Generation - Campaign: ${campaignId} (No filters)`);
            console.log('✅ Generating campaign script without filter logic - will show immediately');
            fullContent = `
                // Campaign Script for ${campaignId} - No filters - Generated at ${new Date().toISOString()}
                console.log('🚀 Campaign Script Loading - Campaign: ${campaignId} (No filters)');
                console.log('✅ No filters applied - checking display count limit');
                console.log('   - No. of Time to Show: {{NO_OF_TIME_TO_SHOW}}');
                
                // Helper function to get cookie value
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
                
                // Function to check display count limit
                async function checkDisplayCountLimit() {
                    try {
                        // The main tracking script writes the 'visitorId' cookie
                        // asynchronously (after an external IP lookup that can be
                        // slow or blocked) — poll briefly instead of reading it
                        // once, so a fresh pageview doesn't send visitorId: null
                        // and get folded into a shared "anonymous" appearance
                        // count that can trip the display limit for everyone.
                        let __visitorId = window.visitorId || getCookie('visitorId');
                        let __vidAttempts = 0;
                        while (!__visitorId && __vidAttempts < 20) {
                            await new Promise(function (r) { setTimeout(r, 100); });
                            __visitorId = window.visitorId || getCookie('visitorId');
                            __vidAttempts++;
                        }
                        const response = await fetch('http://localhost:5008/api/campaign/check-display-limit/${campaignId}', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                visitorId: __visitorId,
                                visitId: window.visitId || getCookie('visitId')
                            })
                        });
                        
                        const result = await response.json();
                        console.log('📊 Display count check result:', result);
                        
                        if (result.success) {
                            if (result.canShow) {
                                console.log('✅ Display count limit not reached - showing campaign');
                                return true;
                            } else {
                                console.log('🚫 Display count limit reached - campaign will not show');
                                return false;
                            }
                        } else {
                            console.log('⚠️ Error checking display count - showing campaign as fallback');
                            return true;
                        }
                    } catch (error) {
                        console.log('⚠️ Error checking display count - showing campaign as fallback:', error);
                        return true;
                    }
                }
                
                // Check display count limit before showing campaign
                checkDisplayCountLimit().then(canShow => {
                    if (canShow) {
                        console.log('✅ Display count check passed - showing campaign ${campaignId}');
                        ${content}
                    } else {
                        console.log('🚫 Campaign ${campaignId} blocked by display count limit');
                    }
                });
            `;
        }

        // Replace campaign ID placeholder with actual campaign ID
        fullContent = fullContent.replace(/\{\{CAMPAIGN_ID\}\}/g, campaignId);
        // Replace user ID placeholder with actual user ID
        fullContent = fullContent.replace(/\{\{USER_ID\}\}/g, user._id);
        // Replace showTeaser placeholder with actual value
        const showTeaser = payload.showTeaser !== undefined ? payload.showTeaser : true;
        fullContent = fullContent.replace(/\{\{SHOW_TEASER\}\}/g, showTeaser.toString());

        // Replace noOfTimeToShow placeholder with actual value
        const noOfTimeToShow = payload.noOfTimeToShow || 1;
        fullContent = fullContent.replace(/\{\{NO_OF_TIME_TO_SHOW\}\}/g, noOfTimeToShow.toString());

        console.log('📝 Script Generation Complete:');
        console.log('   - Full content length:', fullContent.length);
        console.log('   - Filter script length:', filterScript.length);
        console.log('   - Campaign content length:', content.length);
        console.log('   - Has filters:', filters && filters.length > 0);
        console.log('   - Placeholders replaced: CAMPAIGN_ID, USER_ID, SHOW_TEASER');

        let minifiedCode;
        try {
            console.log('🔧 Starting script minification...');
            minifiedCode = await getMinifiedCode(fullContent);
            if (!minifiedCode) {
                console.error('❌ Minification failed - no code returned');
                return next(new ErrorHandler('Failed to minify campaign script'));
            }
            console.log('✅ Script minified successfully');
            console.log('📏 Minified code length:', minifiedCode.length);
            console.log('📊 Compression ratio:', ((fullContent.length - minifiedCode.length) / fullContent.length * 100).toFixed(2) + '%');
        } catch (minifyError) {
            console.error('❌ Error minifying script:', minifyError);
            require('fs').writeFileSync('e:/URLPT/urlpt-api/failed_script.js', fullContent);
            return next(new ErrorHandler('Error minifying script: ' + minifyError.message));
        }

        try {
            console.log('💾 Creating campaign script file...');
            // If isActive is not set, preserve the existing campaign's isActive status
            let isActiveForScript = payload.isActive;
            if (isActiveForScript === undefined) {
                const existingCampaign = await Campaign.findById(campaignId);
                isActiveForScript = existingCampaign?.isActive ?? false;
                console.log('📊 Using existing campaign active status:', isActiveForScript);
            } else {
                console.log('📊 Using provided active status:', isActiveForScript);
            }

            await createCampaignScript(minifiedCode, user._id, campaignId, isActiveForScript);
            console.log('✅ Campaign script created successfully');
            console.log('🎉 Script update completed for campaign:', campaignId);
        } catch (scriptError) {
            console.error('❌ Error creating campaign script:', scriptError);
            return next(new ErrorHandler('Error creating campaign script: ' + scriptError.message));
        }

        res.json({
            success: true,
            message: "Campaign Saved successfully."
        });
    } catch (error) {
        console.error('❌ Script Update Error:', error);
        return next(error);
    }
};


exports.uploadFiles = async (req, res, next) => {
    try {
        const user = req.user
        const path = `campaign-images/${user._id}`
        const file = req.files.file
        if (!file && file.data) {
            return next(new ErrorHandler('File not found', 500))
        }

        const uploadedData = await uploadFileToS3(file, path)
        if (!uploadedData) {
            return next(new ErrorHandler('Failed to upload file', 500))
        }
        res.json({
            success: true,
            uploadUrl: uploadedData
        })
    } catch (error) {
        return next(error);
    }
};
exports.increaseCounter = async (req, res, next) => {
    try {
        const payload = req.body;

        // Modify buttonValue if it's "Close"
        if (payload.buttonValue === 'Close') {
            payload.buttonValue = '✕';
        }

        const campaignTrack = await CampaignTrack.create(payload);
        if (!campaignTrack) {
            return next(new ErrorHandler('Failed to add track.'));
        }

        res.json({
            success: true,
            message: 'Counter updated successfully.'
        });

    } catch (error) {
        return next(error);
    }
};
exports.increaseAppear = async (req, res, next) => {
    try {
        const payload = req.body


        const appear = await AppearLogModel.create(payload)
        res.json({
            success: true,
            message: 'Record added successfully.'
        })

    } catch (error) {
        return next(error);
    }
};

exports.checkDisplayLimit = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        const { visitorId, visitId } = req.body;

        console.log('🔍 Checking display limit for campaign:', campaignId);
        console.log('🔍 Visitor data:', { visitorId, visitId });

        // Get campaign data to check noOfTimeToShow
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            console.log('❌ Campaign not found:', campaignId);
            return res.json({
                success: false,
                message: 'Campaign not found',
                canShow: false
            });
        }

        const noOfTimeToShow = campaign.noOfTimeToShow || 1;
        console.log('📊 Campaign noOfTimeToShow:', noOfTimeToShow);

        // Check if user has already converted for this campaign
        const existingConversion = await Conversion.findOne({
            campaignId: campaignId,
            visitorId: visitorId
        });

        if (existingConversion) {
            console.log('❌ User has already converted for this campaign - stopping display');
            return res.json({
                success: true,
                canShow: false,
                reason: 'already_converted',
                currentCount: 0,
                maxCount: noOfTimeToShow
            });
        }

        // Check if user has already submitted email for this campaign
        const existingEmailSubmission = await EmailSubmission.findOne({
            campaignId: campaignId,
            visitorId: visitorId
        });

        if (existingEmailSubmission) {
            console.log('❌ User has already submitted email for this campaign - stopping display');
            return res.json({
                success: true,
                canShow: false,
                reason: 'already_submitted_email',
                currentCount: 0,
                maxCount: noOfTimeToShow
            });
        }

        // Count existing appearances for this visitor and campaign
        const appearanceCount = await AppearLogModel.countDocuments({
            campaignId: campaignId,
            visitorId: visitorId
        });

        console.log('📊 Current appearance count for visitor:', appearanceCount);
        console.log('📊 Maximum allowed appearances:', noOfTimeToShow);

        const canShow = appearanceCount < noOfTimeToShow;

        console.log('✅ Display limit check result:', {
            canShow,
            currentCount: appearanceCount,
            maxCount: noOfTimeToShow,
            reason: canShow ? 'within_limit' : 'appearance_limit_reached'
        });

        res.json({
            success: true,
            canShow: canShow,
            reason: canShow ? 'within_limit' : 'appearance_limit_reached',
            currentCount: appearanceCount,
            maxCount: noOfTimeToShow
        });

    } catch (error) {
        console.error('❌ Error checking display limit:', error);
        return next(error);
    }
};

exports.campaignStat = async (req, res, next) => {
    try {
        const campaignId = req.params.id;

        const aggregateQuery = [
            // First match the specific campaign
            {
                $match: {
                    campaignId: new mongoose.Types.ObjectId(campaignId)
                }
            },
            // Lookup to join with usercampaign collection to get campaign data
            {
                $lookup: {
                    from: "usercampaigns",
                    localField: "campaignId",
                    foreignField: "_id",
                    as: "campaignData"
                }
            },
            // Lookup to join with appear-logs collection to count appearances
            {
                $lookup: {
                    from: "appear-logs",
                    localField: "campaignId",
                    foreignField: "campaignId",
                    as: "appearances"
                }
            },
            // Unwind the joined campaign data
            {
                $unwind: "$campaignData"
            },
            // Group by button value and include appearance count
            {
                $group: {
                    _id: "$buttonValue",
                    clickCount: { $sum: 1 },
                    // totalAppearances: { $first: "$campaignData.appearCounter" }, // keep original
                    totalAppearances: { $first: { $size: "$appearances" } }, // new field from appear-logs
                    campaignName: { $first: "$campaignData.campaignName" },
                    uniqueUsers: { $addToSet: "$userId" },
                    firstClick: { $min: "$timestamp" },
                    lastClick: { $max: "$timestamp" }
                }
            },
            // Add calculated fields
            {
                $project: {
                    buttonValue: "$_id",
                    clickCount: 1,
                    totalAppearances: 1,
                    campaignName: 1,
                    // uniqueUserCount: { $size: "$uniqueUsers" },
                    // clickThroughRate: {
                    //     $multiply: [
                    //         { $divide: ["$clickCount", "$totalAppearances"] },
                    //         100
                    //     ]
                    // },
                    // firstClick: 1,
                    // lastClick: 1,
                    // _id: 0
                }
            },
            // Sort by most clicked button first
            {
                $sort: { clickCount: -1 }
            }
        ];

        const result = await CampaignTrack.aggregate(aggregateQuery);
        console.log(result)
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        return next(error);
    }
};


exports.getAppearances = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        let { page, limit } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        const [appearances, total] = await Promise.all([
            AppearLogModel.find({ campaignId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            AppearLogModel.countDocuments({ campaignId })
        ]);

        res.json({
            success: true,
            data: appearances,
            total,
            page,
            pages: Math.ceil(total / limit),
            message: 'Appearances fetched successfully'
        });

    } catch (error) {
        return next(error);
    }
};

exports.getClicks = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        let { page, limit } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        const query = {
            campaignId,
            buttonValue: { $ne: '✕' }
        };

        const [clicks, total] = await Promise.all([
            CampaignTrack.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            CampaignTrack.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: clicks,
            total,
            page,
            pages: Math.ceil(total / limit),
            message: 'Button clicks (excluding closes) fetched successfully'
        });

    } catch (error) {
        return next(error);
    }
};

exports.getCloses = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        let { page, limit } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        const query = {
            campaignId,
            buttonValue: '✕'
        };

        const [closes, total] = await Promise.all([
            CampaignTrack.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            CampaignTrack.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: closes,
            total,
            page,
            pages: Math.ceil(total / limit),
            message: 'Campaign closes fetched successfully'
        });

    } catch (error) {
        return next(error);
    }
};

exports.getConversions = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        let { page, limit } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        const campaign = await Campaign.findById(campaignId).select('clientId');
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        const campaignVisitIds = await AppearLogModel.distinct('visitId', { campaignId });

        // Normalize ids because AppearLog uses String while conversions may store Number/String.
        const normalizedVisitIds = [...new Set(
            campaignVisitIds
                .filter((id) => id !== null && id !== undefined && id !== '')
                .flatMap((id) => {
                    const asString = String(id);
                    const asNumber = Number(asString);
                    return Number.isNaN(asNumber) ? [asString] : [asString, asNumber];
                })
        )];

        if (!normalizedVisitIds.length) {
            return res.json({
                success: true,
                data: [],
                total: 0,
                page,
                pages: 0,
                message: 'Campaign conversions fetched successfully'
            });
        }

        const conversionFilter = {
            userId: campaign.clientId,
            visitId: { $in: normalizedVisitIds }
        };

        console.log('📊 [CAMPAIGN_CONVERSIONS_DEBUG] Request received', {
            campaignId,
            campaignOwnerId: String(campaign.clientId),
            page,
            limit,
            skip,
            campaignVisitIdsCount: campaignVisitIds.length,
            normalizedVisitIdsCount: normalizedVisitIds.length
        });

        const [conversions, totalConversions] = await Promise.all([
            Conversion.find(conversionFilter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Conversion.countDocuments(conversionFilter)
        ]);

        const invalidRows = conversions.filter((row) => {
            const ownerMatches = String(row.userId) === String(campaign.clientId);
            const visitMatches = normalizedVisitIds.some((id) => String(id) === String(row.visitId));
            return !(ownerMatches && visitMatches);
        });

        console.log('📊 [CAMPAIGN_CONVERSIONS_DEBUG] Query result', {
            campaignId,
            campaignOwnerId: String(campaign.clientId),
            totalConversions,
            returnedRows: conversions.length,
            invalidRows: invalidRows.length,
            sampleRows: conversions.slice(0, 5).map((row) => ({
                conversionId: String(row._id),
                userId: String(row.userId),
                visitId: row.visitId,
                product_name: row.product_name,
                createdAt: row.createdAt
            }))
        });

        res.json({
            success: true,
            data: conversions,
            total: totalConversions,
            page,
            pages: Math.ceil(totalConversions / limit),
            message: 'Campaign conversions fetched successfully'
        });

    } catch (error) {
        return next(error);
    }
};

exports.getTotalConversions = async (req, res, next) => {
    try {
        const { campaignId } = req.params;

        console.log('🔍 getTotalConversions - campaignId:', campaignId);

        const campaign = await Campaign.findById(campaignId).select('clientId');
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: 'Campaign not found'
            });
        }

        // Get all visitIds for this campaign from appearances
        const campaignVisitIds = await AppearLogModel.distinct('visitId', { campaignId });
        const normalizedVisitIds = [...new Set(
            campaignVisitIds
                .filter((id) => id !== null && id !== undefined && id !== '')
                .flatMap((id) => {
                    const asString = String(id);
                    const asNumber = Number(asString);
                    return Number.isNaN(asNumber) ? [asString] : [asString, asNumber];
                })
        )];

        // Count total conversions for this campaign and campaign owner only
        const totalConversions = normalizedVisitIds.length
            ? await Conversion.countDocuments({
                userId: campaign.clientId,
                visitId: { $in: normalizedVisitIds }
            })
            : 0;

        console.log('📊 [CAMPAIGN_TOTAL_CONVERSIONS_DEBUG] Total computed', {
            campaignId,
            campaignOwnerId: String(campaign.clientId),
            campaignVisitIdsCount: campaignVisitIds.length,
            normalizedVisitIdsCount: normalizedVisitIds.length,
            totalConversions
        });

        res.json({
            success: true,
            totals: {
                conversions: totalConversions
            },
            message: 'Total conversions fetched successfully'
        });

    } catch (error) {
        console.error('❌ Error in getTotalConversions:', error);
        return next(error);
    }
};

exports.getTotalEmailSubmissions = async (req, res, next) => {
    try {
        const { campaignId } = req.params;

        console.log('🔍 getTotalEmailSubmissions - campaignId:', campaignId);

        const totalEmailSubmissions = await EmailSubmission.countDocuments({ campaignId });

        console.log('🔍 getTotalEmailSubmissions - total found:', totalEmailSubmissions);

        res.json({
            success: true,
            total: totalEmailSubmissions,
            message: 'Total email submissions fetched successfully'
        });

    } catch (error) {
        console.error('❌ Error in getTotalEmailSubmissions:', error);
        return next(error);
    }
};

exports.getEmailSubmissions = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        let { page, limit } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        const [emailSubmissions, total] = await Promise.all([
            EmailSubmission.find({ campaignId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            EmailSubmission.countDocuments({ campaignId })
        ]);

        res.json({
            success: true,
            data: emailSubmissions,
            total,
            page,
            pages: Math.ceil(total / limit),
            message: 'Email submissions fetched successfully'
        });

    } catch (error) {
        console.error('❌ Error in getEmailSubmissions:', error);
        return next(error);
    }
};

exports.regenerateAllActiveCampaigns = async (req, res, next) => {
    try {
        console.log('🔄 Campaign Regeneration - Starting...');
        const user = req.user;

        console.log('👤 User Details:');
        console.log('   - User ID:', user._id);
        console.log('   - User Role:', user.role);

        // Get all active campaigns for this user
        const activeCampaigns = await Campaign.find({
            clientId: user._id,
            isActive: true
        });

        console.log(`📊 Found ${activeCampaigns.length} active campaigns for user ${user._id}`);

        if (activeCampaigns.length === 0) {
            console.log('ℹ️ No active campaigns found - nothing to regenerate');
            return res.json({
                success: true,
                message: "No active campaigns found to regenerate.",
                data: {
                    total: 0,
                    regenerated: 0,
                    errors: 0
                }
            });
        }

        // Log campaign details
        activeCampaigns.forEach((campaign, index) => {
            console.log(`📋 Campaign ${index + 1}:`);
            console.log(`   - ID: ${campaign._id}`);
            console.log(`   - Name: ${campaign.campaigndesignerName || 'Unnamed'}`);
            console.log(`   - Type: ${campaign.selectedOption || 'Unknown'}`);
            console.log(`   - Has Filters: ${campaign.filters && campaign.filters.length > 0}`);
            console.log(`   - Filter Count: ${campaign.filters ? campaign.filters.length : 0}`);
        });

        let regeneratedCount = 0;
        let errorCount = 0;

        for (const campaign of activeCampaigns) {
            try {
                console.log(`\n🔄 Processing Campaign: ${campaign._id}`);
                console.log(`📋 Campaign Name: ${campaign.campaigndesignerName || 'Unnamed'}`);

                // Get the campaign's current filters
                const filters = campaign.filters || [];
                console.log(`🔍 Filters found: ${filters.length}`);

                // Generate filter script if filters exist
                let filterScript = '';
                if (filters && filters.length > 0) {
                    try {
                        console.log(`🔧 Generating filter script for campaign: ${campaign._id}`);
                        console.log(`🔍 Filters:`, JSON.stringify(filters, null, 2));
                        filterScript = generateFilterScript(filters, campaign._id.toString());
                        console.log(`✅ Filter script generated successfully for campaign: ${campaign._id}`);
                        console.log(`📏 Filter script length: ${filterScript.length}`);
                    } catch (filterError) {
                        console.error(`❌ Error generating filter script for campaign ${campaign._id}:`, filterError);
                        errorCount++;
                        continue;
                    }
                } else {
                    console.log(`ℹ️ No filters for campaign ${campaign._id} - skipping filter script`);
                }

                // Get the campaign's current content (you might need to adjust this based on your data structure)
                let content = campaign.popUpContent || '';
                console.log(`📄 Campaign content length: ${content.length}`);

                // Combine filter script with campaign content
                let fullContent;
                if (filters && filters.length > 0) {
                    // Create unique variable names for this campaign
                    const filterPassedVar = `campaignFilterPassed_${campaign._id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const checkCountVar = `checkCount_${campaign._id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const maxChecksVar = `maxChecks_${campaign._id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const checkFilterFunctionVar = `checkFilterAndShowCampaign_${campaign._id.toString().replace(/[^a-zA-Z0-9]/g, '_')}`;

                    console.log(`🔧 Unique variables for campaign ${campaign._id}:`);
                    console.log(`   - Filter Passed Var: ${filterPassedVar}`);
                    console.log(`   - Check Count Var: ${checkCountVar}`);
                    console.log(`   - Max Checks Var: ${maxChecksVar}`);
                    console.log(`   - Check Filter Function: ${checkFilterFunctionVar}`);

                    // Wrap the campaign content with filter check and display count logic
                    fullContent = filterScript + '\n' + `
                        // Campaign Script for ${campaign._id} - Regenerated at ${new Date().toISOString()}
                        console.log('🚀 Campaign Script Loading - Campaign: ${campaign._id} (Regenerated)');
                        console.log('🔧 Campaign Variables:');
                        console.log('   - Filter Passed Var: ${filterPassedVar}');
                        console.log('   - Check Count Var: ${checkCountVar}');
                        console.log('   - Max Checks Var: ${maxChecksVar}');
                        console.log('   - Check Filter Function: ${checkFilterFunctionVar}');
                        console.log('   - No. of Time to Show: {{NO_OF_TIME_TO_SHOW}}');
                        
                        // Function to check display count limit
                        async function checkDisplayCountLimit() {
                            try {
                                // The main tracking script writes the 'visitorId' cookie
                                // asynchronously (after an external IP lookup that can be
                                // slow or blocked) — poll briefly instead of reading it
                                // once, so a fresh pageview doesn't send visitorId: null
                                // and get folded into a shared "anonymous" appearance
                                // count that can trip the display limit for everyone.
                                let __visitorId = window.visitorId || getCookie('visitorId');
                                let __vidAttempts = 0;
                                while (!__visitorId && __vidAttempts < 20) {
                                    await new Promise(function (r) { setTimeout(r, 100); });
                                    __visitorId = window.visitorId || getCookie('visitorId');
                                    __vidAttempts++;
                                }
                                const response = await fetch('http://localhost:5008/api/campaign/check-display-limit/${campaign._id}', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        visitorId: __visitorId,
                                        visitId: window.visitId || getCookie('visitId')
                                    })
                                });
                                
                                const result = await response.json();
                                console.log('📊 Display count check result:', result);
                                
                                if (result.success) {
                                    if (result.canShow) {
                                        console.log('✅ Display count limit not reached - showing campaign');
                                        return true;
                                    } else {
                                        console.log('🚫 Display count limit reached - campaign will not show');
                                        return false;
                                    }
                                } else {
                                    console.log('⚠️ Error checking display count - showing campaign as fallback');
                                    return true;
                                }
                            } catch (error) {
                                console.log('⚠️ Error checking display count - showing campaign as fallback:', error);
                                return true;
                            }
                        }
                        
                        // Wait for filter evaluation to complete
                        let ${checkCountVar} = 0;
                        const ${maxChecksVar} = 20; // Maximum 1 second (20 * 50ms)
                        
                        const ${checkFilterFunctionVar} = async () => {
                            console.log('🔄 ${checkFilterFunctionVar}() called - Campaign: ${campaign._id}');
                            ${checkCountVar}++;
                            console.log('📊 Check count: ${checkCountVar}/${maxChecksVar} - Campaign: ${campaign._id}');
                            
                            if (typeof window.${filterPassedVar} !== 'undefined') {
                                console.log('✅ Filter result available - Campaign: ${campaign._id}');
                                if (window.${filterPassedVar}) {
                                    console.log('✅ Filter passed - checking display count limit');
                                    
                                    // Check display count limit before showing campaign
                                    const canShow = await checkDisplayCountLimit();
                                    if (canShow) {
                                        console.log('✅ Display count check passed - showing campaign ${campaign._id}');
                                        ${content}
                                    } else {
                                        console.log('🚫 Campaign ${campaign._id} blocked by display count limit');
                                    }
                                } else {
                                    console.log('🚫 Campaign ${campaign._id} blocked by filter');
                                }
                            } else if (${checkCountVar} < ${maxChecksVar}) {
                                console.log('⏳ Filter not ready yet, retrying in 50ms - Campaign: ${campaign._id}');
                                // Fallback if filter script hasn't run yet
                                setTimeout(${checkFilterFunctionVar}, 50);
                            } else {
                                console.log('⚠️ Filter timeout - checking display count before showing campaign ${campaign._id} as fallback');
                                
                                // Check display count limit before showing campaign as fallback
                                const canShow = await checkDisplayCountLimit();
                                if (canShow) {
                                    console.log('✅ Display count check passed - showing campaign ${campaign._id} as fallback');
                                    ${content}
                                } else {
                                    console.log('🚫 Campaign ${campaign._id} blocked by display count limit (fallback)');
                                }
                            }
                        };
                        
                        // Start checking for filter result
                        console.log('🎯 Starting filter check for campaign: ${campaign._id}');
                        ${checkFilterFunctionVar}();
                    `;
                } else {
                    console.log(`📝 No filters - generating simple campaign script for ${campaign._id}`);
                    fullContent = `
                        // Campaign Script for ${campaign._id} - No filters - Regenerated at ${new Date().toISOString()}
                        console.log('🚀 Campaign Script Loading - Campaign: ${campaign._id} (No filters - Regenerated)');
                        console.log('✅ No filters applied - checking display count limit');
                        console.log('   - No. of Time to Show: {{NO_OF_TIME_TO_SHOW}}');
                        
                        // Helper function to get cookie value
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
                        
                        // Function to check display count limit
                        async function checkDisplayCountLimit() {
                            try {
                                // The main tracking script writes the 'visitorId' cookie
                                // asynchronously (after an external IP lookup that can be
                                // slow or blocked) — poll briefly instead of reading it
                                // once, so a fresh pageview doesn't send visitorId: null
                                // and get folded into a shared "anonymous" appearance
                                // count that can trip the display limit for everyone.
                                let __visitorId = window.visitorId || getCookie('visitorId');
                                let __vidAttempts = 0;
                                while (!__visitorId && __vidAttempts < 20) {
                                    await new Promise(function (r) { setTimeout(r, 100); });
                                    __visitorId = window.visitorId || getCookie('visitorId');
                                    __vidAttempts++;
                                }
                                const response = await fetch('http://localhost:5008/api/campaign/check-display-limit/${campaign._id}', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        visitorId: __visitorId,
                                        visitId: window.visitId || getCookie('visitId')
                                    })
                                });
                                
                                const result = await response.json();
                                console.log('📊 Display count check result:', result);
                                
                                if (result.success) {
                                    if (result.canShow) {
                                        console.log('✅ Display count limit not reached - showing campaign');
                                        return true;
                                    } else {
                                        console.log('🚫 Display count limit reached - campaign will not show');
                                        return false;
                                    }
                                } else {
                                    console.log('⚠️ Error checking display count - showing campaign as fallback');
                                    return true;
                                }
                            } catch (error) {
                                console.log('⚠️ Error checking display count - showing campaign as fallback:', error);
                                return true;
                            }
                        }
                        
                        // Check display count limit before showing campaign
                        checkDisplayCountLimit().then(canShow => {
                            if (canShow) {
                                console.log('✅ Display count check passed - showing campaign ${campaign._id}');
                                ${content}
                            } else {
                                console.log('🚫 Campaign ${campaign._id} blocked by display count limit');
                            }
                        });
                    `;
                }

                // Replace placeholders
                fullContent = fullContent.replace(/\{\{CAMPAIGN_ID\}\}/g, campaign._id.toString());
                fullContent = fullContent.replace(/\{\{USER_ID\}\}/g, user._id.toString());
                const showTeaser = campaign.showTeaser !== undefined ? campaign.showTeaser : true;
                fullContent = fullContent.replace(/\{\{SHOW_TEASER\}\}/g, showTeaser.toString());

                // Replace noOfTimeToShow placeholder with actual value
                const noOfTimeToShow = campaign.noOfTimeToShow || 1;
                fullContent = fullContent.replace(/\{\{NO_OF_TIME_TO_SHOW\}\}/g, noOfTimeToShow.toString());

                console.log(`📝 Script generation complete for campaign ${campaign._id}:`);
                console.log(`   - Full content length: ${fullContent.length}`);
                console.log(`   - Filter script length: ${filterScript.length}`);
                console.log(`   - Campaign content length: ${content.length}`);

                // Minify and create the script
                let minifiedCode;
                try {
                    console.log(`🔧 Minifying script for campaign ${campaign._id}...`);
                    minifiedCode = await getMinifiedCode(fullContent);
                    if (!minifiedCode) {
                        console.error(`❌ Failed to minify script for campaign ${campaign._id}`);
                        errorCount++;
                        continue;
                    }
                    console.log(`✅ Script minified for campaign ${campaign._id}`);
                    console.log(`📏 Minified length: ${minifiedCode.length}`);
                    console.log(`📊 Compression: ${((fullContent.length - minifiedCode.length) / fullContent.length * 100).toFixed(2)}%`);
                } catch (minifyError) {
                    console.error(`❌ Error minifying script for campaign ${campaign._id}:`, minifyError);
                    errorCount++;
                    continue;
                }

                // Create the campaign script
                console.log(`💾 Creating campaign script file for ${campaign._id}...`);
                await createCampaignScript(minifiedCode, user._id, campaign._id.toString(), true);
                console.log(`✅ Campaign script regenerated successfully: ${campaign._id}`);
                regeneratedCount++;

            } catch (error) {
                console.error(`❌ Error regenerating campaign ${campaign._id}:`, error);
                errorCount++;
            }
        }

        console.log(`\n🎉 Regeneration Summary:`);
        console.log(`   - Total campaigns: ${activeCampaigns.length}`);
        console.log(`   - Successfully regenerated: ${regeneratedCount}`);
        console.log(`   - Errors: ${errorCount}`);

        res.json({
            success: true,
            message: `Regenerated ${regeneratedCount} campaigns successfully. ${errorCount} errors encountered.`,
            data: {
                total: activeCampaigns.length,
                regenerated: regeneratedCount,
                errors: errorCount
            }
        });

    } catch (error) {
        console.error('❌ Error in regenerateAllActiveCampaigns:', error);
        return next(error);
    }
};

// 🚀 Get SMS Activity Stats for Send Action Campaigns
exports.getSMSActivityStats = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        console.log('📱 Get SMS Activity Stats API Called:', {
            timestamp: new Date().toISOString(),
            campaignId
        });

        if (!campaignId) {
            return res.status(400).json({ 
                success: false, 
                message: "Campaign ID is required" 
            });
        }

        // Get campaign details
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ 
                success: false, 
                message: "Campaign not found" 
            });
        }

        console.log('🔍 Campaign Details:', {
            name: campaign.name,
            category: campaign.category,
            subCategory: campaign.subCategory,
            clientId: campaign.clientId,
            clientIdType: typeof campaign.clientId
        });

        // Debug: Check if there are any SMS activities for this user
        const totalSMSActivities = await SMSActivity.countDocuments({ messageType: 'sms' });
        const userSMSActivities = await SMSActivity.countDocuments({ 
            userId: new mongoose.Types.ObjectId(campaign.clientId),
            messageType: 'sms'
        });
        
        // Also check what SMS activities exist for this user
        const sampleSMSActivities = await SMSActivity.find({ 
            userId: new mongoose.Types.ObjectId(campaign.clientId),
            messageType: 'sms'
        }).limit(3);
        
        console.log('🔍 SMS Activities Debug:', {
            totalSMSActivities,
            userSMSActivities,
            userId: campaign.clientId,
            sampleActivities: sampleSMSActivities.map(activity => ({
                id: activity._id,
                to: activity.to,
                status: activity.status,
                sentAt: activity.sentAt
            }))
        });

        const campaignIdObj = new mongoose.Types.ObjectId(campaignId);

        // Get SMS activity data using direct queries (filter by messageType: 'sms' and campaignId)
        const totalSent = await SMSActivity.countDocuments({
            campaignId: campaignIdObj,
            messageType: 'sms'
        });
        
        const successfulSent = await SMSActivity.countDocuments({
            campaignId: campaignIdObj,
            messageType: 'sms',
            status: 'sent'
        });
        
        const failedSent = await SMSActivity.countDocuments({
            campaignId: campaignIdObj,
            messageType: 'sms',
            status: 'failed'
        });
        
        // Get unique recipients (SMS only)
        const uniqueRecipients = await SMSActivity.distinct('to', {
            campaignId: campaignIdObj,
            messageType: 'sms'
        });
        
        const smsStats = [{
            totalSent,
            successfulSent,
            failedSent,
            uniqueRecipients: uniqueRecipients.length,
            successRate: totalSent > 0 ? (successfulSent / totalSent) * 100 : 0
        }];

        // Get recent SMS activities for this campaign (SMS only)
        const recentSMSActivities = await SMSActivity.find({
            campaignId: campaignIdObj,
            messageType: 'sms'
        })
        .sort({ sentAt: -1 })
        .limit(10)
        .select('to status sentAt message visitorId visitId errorMessage');

        console.log('📊 SMS Stats Result:', {
            statsFound: smsStats.length > 0,
            totalSent: smsStats[0]?.totalSent || 0,
            successfulSent: smsStats[0]?.successfulSent || 0,
            failedSent: smsStats[0]?.failedSent || 0,
            uniqueRecipients: smsStats[0]?.uniqueRecipients || 0,
            recentActivities: recentSMSActivities.length
        });

        // Ensure we have valid stats data
        const statsData = smsStats.length > 0 ? smsStats[0] : {
            totalSent: 0,
            successfulSent: 0,
            failedSent: 0,
            uniqueRecipients: 0,
            successRate: 0
        };

        console.log('📊 Final Stats Data:', statsData);

        const result = {
            campaign: {
                id: campaign._id,
                name: campaign.name,
                category: campaign.category,
                subCategory: campaign.subCategory
            },
            stats: statsData,
            recentActivities: recentSMSActivities,
            twilioNumber: '+19203755303' // Add Twilio number for SMS campaigns
        };

        console.log('📤 Final SMS Response being sent:', {
            success: true,
            data: result
        });
        
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Error in getSMSActivityStats:', error);
        return next(error);
    }
};

// 🚀 Get Email Activity Stats for Send Action Campaigns
exports.getEmailActivityStats = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        console.log('📧 Get Email Activity Stats API Called:', {
            timestamp: new Date().toISOString(),
            campaignId
        });

        if (!campaignId) {
            return res.status(400).json({ 
                success: false, 
                message: "Campaign ID is required" 
            });
        }

        // Get campaign details
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ 
                success: false, 
                message: "Campaign not found" 
            });
        }

        console.log('🔍 Campaign Details:', {
            name: campaign.name,
            category: campaign.category,
            subCategory: campaign.subCategory,
            clientId: campaign.clientId
        });

        const campaignIdObj = new mongoose.Types.ObjectId(campaignId);

        // Aggregate Email activity data
        const emailStats = await EmailActivity.aggregate([
            {
                $match: {
                    campaignId: campaignIdObj
                }
            },
            {
                $group: {
                    _id: null,
                    totalSent: { $sum: 1 },
                    successfulSent: { 
                        $sum: { 
                            $cond: [{ $eq: ["$status", "sent"] }, 1, 0] 
                        } 
                    },
                    failedSent: { 
                        $sum: { 
                            $cond: [{ $eq: ["$status", "failed"] }, 1, 0] 
                        } 
                    },
                    uniqueRecipients: { $addToSet: "$to" },
                    firstSent: { $min: "$sentAt" },
                    lastSent: { $max: "$sentAt" }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalSent: 1,
                    successfulSent: 1,
                    failedSent: 1,
                    uniqueRecipients: { $size: "$uniqueRecipients" },
                    firstSent: 1,
                    lastSent: 1,
                    successRate: {
                        $multiply: [
                            { $divide: ["$successfulSent", "$totalSent"] },
                            100
                        ]
                    }
                }
            }
        ]);

        // Get recent Email activities for this campaign
        const recentEmailActivities = await EmailActivity.find({
            campaignId: campaignIdObj
        })
        .sort({ sentAt: -1 })
        .limit(10)
        .select('to status sentAt subject visitorId visitId errorMessage');

        console.log('📊 Email Stats Result:', {
            statsFound: emailStats.length > 0,
            totalSent: emailStats[0]?.totalSent || 0,
            successfulSent: emailStats[0]?.successfulSent || 0,
            failedSent: emailStats[0]?.failedSent || 0,
            uniqueRecipients: emailStats[0]?.uniqueRecipients || 0,
            recentActivities: recentEmailActivities.length
        });

        const result = {
            campaign: {
                id: campaign._id,
                name: campaign.name,
                category: campaign.category,
                subCategory: campaign.subCategory
            },
            stats: emailStats[0] || {
                totalSent: 0,
                successfulSent: 0,
                failedSent: 0,
                uniqueRecipients: 0,
                successRate: 0
            },
            recentActivities: recentEmailActivities
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Error in getEmailActivityStats:', error);
        return next(error);
    }
};

// 🚀 Get SMS Activities for detailed view
exports.getSMSActivities = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        let { page, limit, status } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        console.log('📱 Get SMS Activities API Called:', {
            timestamp: new Date().toISOString(),
            campaignId,
            page,
            limit,
            status
        });

        // Get campaign to find clientId
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }

        // Build query (filter by messageType: 'sms' to exclude WhatsApp and match campaignId)
        const query = { 
            campaignId: new mongoose.Types.ObjectId(campaignId),
            messageType: 'sms'
        };
        if (status) {
            query.status = status;
        }

        const [smsActivities, total] = await Promise.all([
            SMSActivity.find(query)
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('to status sentAt message visitorId visitId errorMessage'),
            SMSActivity.countDocuments(query)
        ]);

        console.log('📊 SMS Activities Result:', {
            totalFound: total,
            activitiesReturned: smsActivities.length,
            status: status || 'all'
        });

        res.json({
            success: true,
            data: smsActivities,
            total,
            page,
            pages: Math.ceil(total / limit),
            message: 'SMS activities fetched successfully'
        });

    } catch (error) {
        console.error('❌ Error in getSMSActivities:', error);
        return next(error);
    }
};

// 🚀 Get Email Activities for detailed view
exports.getEmailActivities = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        let { page, limit, status } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        console.log('📧 Get Email Activities API Called:', {
            timestamp: new Date().toISOString(),
            campaignId,
            page,
            limit,
            status
        });

        // Get campaign to find clientId
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }

        // Build query
        const query = { campaignId: new mongoose.Types.ObjectId(campaignId) };
        if (status) {
            query.status = status;
        }

        const [emailActivities, total] = await Promise.all([
            EmailActivity.find(query)
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('to status sentAt subject visitorId visitId errorMessage'),
            EmailActivity.countDocuments(query)
        ]);

        console.log('📊 Email Activities Result:', {
            totalFound: total,
            activitiesReturned: emailActivities.length,
            status: status || 'all'
        });

        res.json({
            success: true,
            data: emailActivities,
            total,
            page,
            pages: Math.ceil(total / limit),
            message: 'Email activities fetched successfully'
        });

    } catch (error) {
        console.error('❌ Error in getEmailActivities:', error);
        return next(error);
    }
};

// 📱 Get WhatsApp Activity Stats
exports.getWhatsAppActivityStats = async (req, res, next) => {
    try {
        const { campaignId } = req.params;

        console.log('📱 Get WhatsApp Activity Stats API Called:', {
            timestamp: new Date().toISOString(),
            campaignId
        });

        // Get campaign details
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }

        console.log('📋 Campaign Details:', {
            id: campaign._id,
            name: campaign.campaigndesignerName || campaign.name,
            category: campaign.category,
            subCategory: campaign.subCategory,
            clientId: campaign.clientId
        });

        // Get WhatsApp activity data - filter by campaignId AND userId for accuracy
        const campaignIdObj = new mongoose.Types.ObjectId(campaignId);
        const userIdObj = new mongoose.Types.ObjectId(campaign.clientId);
        
        campaignLogger.statsQuery(campaignId, 'whatsapp', {
            userId: campaign.clientId,
            campaignName: campaign.campaigndesignerName || campaign.name
        });
        
        // Build query that filters by campaignId if it exists, otherwise fallback to userId only
        // For new records, we have campaignId. For old records, we need to check if they match this campaign
        // by checking if they were created around the same time or have matching patterns
        const baseQuery = {
            userId: userIdObj,
            messageType: 'whatsapp'
        };
        
        // Primary query: filter by campaignId (for new records with campaignId)
        const queryWithCampaign = {
            ...baseQuery,
            campaignId: campaignIdObj
        };
        
        campaignLogger.debug('STATS_QUERY', 'Query with campaignId', queryWithCampaign);
        
        // Count activities for this specific campaign
        const totalSent = await SMSActivity.countDocuments(queryWithCampaign);
        
        const successfulSent = await SMSActivity.countDocuments({
            ...queryWithCampaign,
            status: 'sent'
        });
        
        const failedSent = await SMSActivity.countDocuments({
            ...queryWithCampaign,
            status: 'failed'
        });
        
        campaignLogger.info('STATS_RESULT', 'Stats counts calculated', {
            totalSent,
            successfulSent,
            failedSent,
            campaignId
        });
        
        // Get unique recipients for this campaign
        const uniqueRecipients = await SMSActivity.distinct('to', queryWithCampaign);
        
        const whatsappStats = [{
            totalSent,
            successfulSent,
            failedSent,
            uniqueRecipients: uniqueRecipients.length,
            successRate: totalSent > 0 ? (successfulSent / totalSent) * 100 : 0
        }];

        // Get recent WhatsApp activities for this campaign (filter by campaignId)
        const recentWhatsAppActivities = await SMSActivity.find({
            userId: userIdObj,
            messageType: 'whatsapp',
            campaignId: campaignIdObj
        })
        .sort({ sentAt: -1 })
        .limit(10)
        .select('to status sentAt message visitorId visitId errorMessage messageId campaignId');

        campaignLogger.info('STATS_RESULT', 'WhatsApp Stats Result', {
            statsFound: whatsappStats.length > 0,
            totalSent: whatsappStats[0]?.totalSent || 0,
            successfulSent: whatsappStats[0]?.successfulSent || 0,
            failedSent: whatsappStats[0]?.failedSent || 0,
            uniqueRecipients: whatsappStats[0]?.uniqueRecipients || 0,
            recentActivities: recentWhatsAppActivities.length,
            campaignId: campaignId
        });

        // Log recent activities for debugging
        campaignLogger.debug('STATS_ACTIVITIES', 'Recent Activities', {
            activities: recentWhatsAppActivities.map(activity => ({
                to: activity.to.substring(0, 4) + '***' + activity.to.substring(-4),
                status: activity.status,
                sentAt: activity.sentAt,
                hasCampaignId: !!activity.campaignId,
                campaignId: activity.campaignId?.toString(),
                expectedCampaignId: campaignId,
                campaignIdMatch: activity.campaignId?.toString() === campaignId,
                errorMessage: activity.errorMessage
            }))
        });

        // Ensure we have valid stats data
        const statsData = whatsappStats.length > 0 ? whatsappStats[0] : {
            totalSent: 0,
            successfulSent: 0,
            failedSent: 0,
            uniqueRecipients: 0,
            successRate: 0
        };

        const result = {
            campaign: {
                id: campaign._id,
                name: campaign.campaigndesignerName || campaign.name,
                category: campaign.category,
                subCategory: campaign.subCategory
            },
            stats: statsData,
            recentActivities: recentWhatsAppActivities
        };

        console.log('📤 Final WhatsApp Response being sent:', {
            success: true,
            data: result
        });
        
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('❌ Error in getWhatsAppActivityStats:', error);
        return next(error);
    }
};

// 📱 Get WhatsApp Activities for detailed view
exports.getWhatsAppActivities = async (req, res, next) => {
    try {
        const { campaignId } = req.params;
        let { page, limit, status } = req.query;

        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const skip = (page - 1) * limit;

        console.log('📱 Get WhatsApp Activities API Called:', {
            timestamp: new Date().toISOString(),
            campaignId,
            page,
            limit,
            status
        });

        // Get campaign to find clientId
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                message: "Campaign not found"
            });
        }

        // Build query (filter by messageType: 'whatsapp' and campaignId)
        const campaignIdObj = new mongoose.Types.ObjectId(campaignId);
        const query = { 
            userId: new mongoose.Types.ObjectId(campaign.clientId),
            messageType: 'whatsapp',
            campaignId: campaignIdObj
        };
        if (status) {
            query.status = status;
        }

        const [whatsappActivities, total] = await Promise.all([
            SMSActivity.find(query)
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('to status sentAt message visitorId visitId errorMessage messageId campaignId'),
            SMSActivity.countDocuments(query)
        ]);

        console.log('📊 WhatsApp Activities Result:', {
            totalFound: total,
            activitiesReturned: whatsappActivities.length,
            status: status || 'all'
        });

        res.json({
            success: true,
            data: whatsappActivities,
            total,
            page,
            pages: Math.ceil(total / limit),
            message: 'WhatsApp activities fetched successfully'
        });

    } catch (error) {
        console.error('❌ Error in getWhatsAppActivities:', error);
        return next(error);
    }
};