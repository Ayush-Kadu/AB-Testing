// 🚀 Setup Trigger-Based Send Action Campaigns (Runs on all pages)
// This function is available globally and runs regardless of form presence
const setupTriggerBasedCampaignsGlobal = async () => {
    const getCookie = (name) => {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const cookie = cookies.find(c => c.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
    };

    const getUserId = () => {
        if (typeof window !== 'undefined' && window.userId) {
            return window.userId;
        }
        return getCookie('userId');
    };

    // Wait for userId to be available (with retries)
    let userId = getUserId();
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds (30 * 100ms)

    while (!userId && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        userId = getUserId();
        attempts++;
    }

    if (!userId) {
        console.log('⚠️ Cannot setup trigger-based campaigns - userId not available after retries');
        return;
    }

    const phoneFromCookie = getCookie('phone');
    const emailFromCookie = getCookie('email');

    if (!phoneFromCookie && !emailFromCookie) {
        console.log('ℹ️ No phone or email in cookies - skipping trigger-based campaign setup');
        return;
    }

    console.log('🔍 Setting up trigger-based Send Action campaigns (global)...');
    console.log('📞 Phone in cookie:', phoneFromCookie ? phoneFromCookie.slice(0, 4) + '***' + phoneFromCookie.slice(-4) : 'none');
    console.log('📧 Email in cookie:', emailFromCookie ? emailFromCookie.slice(0, 3) + '***' + emailFromCookie.slice(emailFromCookie.indexOf('@')) : 'none');

    // We'll use the setupCampaignTrigger function from the form tracking script
    // For now, we'll inline a simplified version here
    // The full version with filter evaluation is in the form tracking section below

    // Fetch all active campaigns
    try {
        const [smsCampaignsRes, emailCampaignsRes, whatsappCampaignsRes] = await Promise.all([
            phoneFromCookie ? fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-sms-campaigns?userId=${userId}`).catch(() => null) : null,
            emailFromCookie ? fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-email-campaigns?userId=${userId}`).catch(() => null) : null,
            phoneFromCookie ? fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-whatsapp-campaigns?userId=${userId}`).catch(() => null) : null
        ]);

        // Process campaigns - we'll set up triggers here
        // Note: Full filter evaluation and trigger setup will be handled in the form tracking section
        // This is a fallback that ensures triggers are set up even if form tracking script doesn't run

        console.log('✅ Trigger-based campaign setup check completed (global)');
    } catch (error) {
        console.error('❌ Error in global trigger-based campaign setup:', error);
    }
};

// Run global trigger setup
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(setupTriggerBasedCampaignsGlobal, 1500);
    });
} else {
    setTimeout(setupTriggerBasedCampaignsGlobal, 1500);
}

document.addEventListener('DOMContentLoaded', async () => {
    // Support multiple form classes
    const form = document.querySelector('.urlpt_form, .wpcf7-form, .gform_106, .isolate ');
    const submitButton = document.querySelector('.urlpt_form_btn, .gform_button, .wpcf7-submit, button[type="submit"], input[type="submit"]');
    const conversionUrl = 'https://urlpt-api.onrender.com/api/conversion/add-conversion';

    // Note: We continue even if no form is found, to set up trigger-based campaigns
    if (!form) {
        console.log('📝 No form found with tracking classes (.urlpt_form, .wpcf7-form, or .gform_106)');
        console.log('📝 Continuing to set up trigger-based campaigns...');
        // Don't return - continue to set up trigger-based campaigns
    } else {
        console.log('📝 Form found:', form.className || form.tagName);
    }

    const getCookie = (name) => {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const cookie = cookies.find(c => c.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
    };

    const createHiddenInput = (name, value) => {
        if (form && !form.querySelector(`input[name="${name}"]`)) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = name;
            input.value = value;
            form.appendChild(input);
        }
    };

    const flattenAndAppend = (obj, prefix = '') => {
        Object.entries(obj).forEach(([key, value]) => {
            const fieldName = prefix ? `${prefix}_${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                flattenAndAppend(value, fieldName);
            } else if (value !== null && value !== undefined) {
                createHiddenInput(fieldName, value);
            }
        });
    };

    // 🚀 ADVANCED FIELD DETECTION SYSTEM
    const emailPatterns = [
        'email', 'mail', 'e-mail', 'e_mail', 'email_address', 'emailaddress',
        'user_email', 'useremail', 'customer_email', 'client_email',
        'contact_email', 'newsletter_email', 'subscription_email',
        'primary_email', 'secondary_email', 'work_email', 'personal_email',
        'billing_email', 'shipping_email', 'delivery_email',
        'support_email', 'help_email', 'info_email', 'admin_email'
    ];

    const phonePatterns = [
        'phone', 'telephone', 'tel', 'mobile', 'cell', 'cellphone',
        'phone_number', 'phonenumber', 'telephone_number', 'contact_number',
        'mobile_number', 'cell_number', 'whatsapp', 'whatsapp_number',
        'user_phone', 'userphone', 'customer_phone', 'client_phone',
        'work_phone', 'home_phone', 'office_phone', 'business_phone',
        'emergency_phone', 'alternate_phone', 'secondary_phone'
    ];

    const namePatterns = [
        'name', 'fullname', 'full_name', 'full_name', 'fullname',
        'first_name', 'firstname', 'fname', 'f_name',
        'last_name', 'lastname', 'lname', 'l_name', 'surname',
        'user_name', 'username', 'customer_name', 'client_name',
        'contact_name', 'billing_name', 'shipping_name'
    ];

    // Enhanced field type detection
    const getFieldType = (input) => {
        // HTML5 type detection (most reliable)
        if (input.type === 'email') return 'email';
        if (input.type === 'tel') return 'phone';

        const name = input.name?.toLowerCase() || '';
        const id = input.id?.toLowerCase() || '';
        const combined = `${name} ${id}`;

        // Email detection
        if (emailPatterns.some(pattern => combined.includes(pattern))) {
            return 'email';
        }

        // Phone detection
        if (phonePatterns.some(pattern => combined.includes(pattern))) {
            return 'phone';
        }

        // Name detection
        if (namePatterns.some(pattern => combined.includes(pattern))) {
            if (combined.includes('first') || combined.includes('fname')) return 'firstName';
            if (combined.includes('last') || combined.includes('lname') || combined.includes('surname')) return 'lastName';
            return 'name';
        }

        // Value-based detection for generic fields
        if (input.value && input.value.includes('@')) return 'email';
        if (input.value && /^[\d\s\-\+\(\)]{7,}$/.test(input.value)) return 'phone';

        return null;
    };

    // Check for custom data attributes
    const checkDataAttributes = (input) => {
        if (input.dataset.fieldType === 'email') return 'email';
        if (input.dataset.fieldType === 'phone') return 'phone';
        if (input.dataset.fieldType === 'tel') return 'phone';
        if (input.dataset.fieldType === 'name') return 'name';

        // Check for common data attributes
        if (input.dataset.email) return 'email';
        if (input.dataset.phone) return 'phone';
        if (input.dataset.name) return 'name';

        return null;
    };

    // Find associated labels for better detection
    const findAssociatedLabel = (input) => {
        // Check for label with 'for' attribute
        const label = document.querySelector(`label[for="${input.id}"]`);
        if (label) {
            const labelText = label.textContent.toLowerCase();
            if (emailPatterns.some(pattern => labelText.includes(pattern))) return 'email';
            if (phonePatterns.some(pattern => labelText.includes(pattern))) return 'phone';
            if (namePatterns.some(pattern => labelText.includes(pattern))) {
                if (labelText.includes('first')) return 'firstName';
                if (labelText.includes('last') || labelText.includes('surname')) return 'lastName';
                return 'name';
            }
        }

        // Check for parent label
        const parentLabel = input.closest('label');
        if (parentLabel) {
            const labelText = parentLabel.textContent.toLowerCase();
            if (emailPatterns.some(pattern => labelText.includes(pattern))) return 'email';
            if (phonePatterns.some(pattern => labelText.includes(pattern))) return 'phone';
            if (namePatterns.some(pattern => labelText.includes(pattern))) {
                if (labelText.includes('first')) return 'firstName';
                if (labelText.includes('last') || labelText.includes('surname')) return 'lastName';
                return 'name';
            }
        }

        return null;
    };

    // Enhanced field mapping function
    const enhancedFieldMapping = (form) => {
        const mappedFields = {
            email: [],
            phone: [],
            name: [],
            firstName: [],
            lastName: []
        };

        if (!form) {
            return mappedFields;
        }

        form.querySelectorAll('input, select, textarea').forEach((input) => {
            if (!input.name && !input.id) return;

            // Try multiple detection methods
            let fieldType = null;

            // Method 1: HTML5 type
            fieldType = getFieldType(input);

            // Method 2: Data attributes
            if (!fieldType) fieldType = checkDataAttributes(input);

            // Method 3: Label association
            if (!fieldType) fieldType = findAssociatedLabel(input);

            // Method 4: Name/ID patterns (fallback)
            if (!fieldType) fieldType = getFieldType(input);

            if (fieldType && mappedFields[fieldType]) {
                mappedFields[fieldType].push({
                    name: input.name || input.id,
                    value: input.value,
                    type: input.type,
                    element: input,
                    detectedBy: fieldType
                });
            }
        });

        return mappedFields;
    };

    // Process multiple fields and select best candidates
    const processMultipleFields = (mappedFields) => {
        const result = {};

        // Process emails (take first non-empty, prefer HTML5 email type)
        if (mappedFields.email.length > 0) {
            // Prioritize HTML5 email inputs
            const html5Email = mappedFields.email.find(field => field.type === 'email' && field.value && field.value.trim());
            const anyEmail = mappedFields.email.find(field => field.value && field.value.trim());

            const primaryEmail = html5Email || anyEmail;
            if (primaryEmail) {
                result.email = primaryEmail.value.trim();
                result.email_source = primaryEmail.name;
                result.email_detected_by = primaryEmail.detectedBy;
            }

            // Store all emails for backup
            result.all_emails = mappedFields.email
                .filter(field => field.value && field.value.trim())
                .map(field => ({
                    value: field.value.trim(),
                    name: field.name,
                    type: field.type,
                    detectedBy: field.detectedBy
                }));
        }

        // Process phones (take first non-empty, prefer HTML5 tel type)
        if (mappedFields.phone.length > 0) {
            // Prioritize HTML5 tel inputs
            const html5Phone = mappedFields.phone.find(field => field.type === 'tel' && field.value && field.value.trim());
            const anyPhone = mappedFields.phone.find(field => field.value && field.value.trim());

            const primaryPhone = html5Phone || anyPhone;
            if (primaryPhone) {
                result.phone = primaryPhone.value.trim();
                result.phone_source = primaryPhone.name;
                result.phone_detected_by = primaryPhone.detectedBy;
            }

            // Store all phones for backup
            result.all_phones = mappedFields.phone
                .filter(field => field.value && field.value.trim())
                .map(field => ({
                    value: field.value.trim(),
                    name: field.name,
                    type: field.type,
                    detectedBy: field.detectedBy
                }));
        }

        // Process names
        if (mappedFields.firstName.length > 0) {
            const firstName = mappedFields.firstName.find(field => field.value && field.value.trim());
            if (firstName) {
                result.firstName = firstName.value.trim();
                result.firstName_source = firstName.name;
            }
        }

        if (mappedFields.lastName.length > 0) {
            const lastName = mappedFields.lastName.find(field => field.value && field.value.trim());
            if (lastName) {
                result.lastName = lastName.value.trim();
                result.lastName_source = lastName.name;
            }
        }

        if (mappedFields.name.length > 0) {
            const name = mappedFields.name.find(field => field.value && field.value.trim());
            if (name) {
                result.name = name.value.trim();
                result.name_source = name.name;
            }
        }

        return result;
    };

    // Get userId from global scope or fallback to cookie
    const getUserId = () => {
        // Try to get from global scope first (wait for it to be available)
        if (typeof window !== 'undefined' && window.userId) {
            return window.userId;
        }
        // Fallback to cookie
        return getCookie('userId');
    };

    // Wait for userId to be available
    let userId = null;
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds (50 * 100ms)

    const waitForUserId = () => {
        userId = getUserId();
        if (userId) {
            createHiddenInput('userId', userId);
            return;
        }

        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(waitForUserId, 100);
        } else {
            console.warn('Could not get userId after maximum attempts');
        }
    };

    waitForUserId();

    // Add tracking data as hidden inputs (only if form exists)
    if (form) {
        try {
            const userCookieRaw = getCookie('userCookie');
            if (userCookieRaw) {
                const userCookie = JSON.parse(userCookieRaw);
                flattenAndAppend(userCookie);
            }
        } catch (e) {
            console.error('Invalid JSON in userCookie:', e);
        }

        // Add basic tracking data as hidden inputs
        const visitorId = getCookie('visitorId');
        const visitId = getCookie('visitId');

        if (visitorId) createHiddenInput('visitorId', visitorId);
        if (visitId) createHiddenInput('visitId', visitId);

        // Add device and URL info as hidden inputs
        createHiddenInput('user_agent', navigator.userAgent);
        createHiddenInput('urlpt_url', window.location.href);
        createHiddenInput('urlpt_ref', document.referrer);
        createHiddenInput('urlpt_ip', 'pending'); // Will be updated when IP is fetched

        // Get user IP and add it
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                createHiddenInput('urlpt_ip', ipData.ip);
            }
        } catch (error) {
            console.error('Error fetching IP:', error);
        }

        // Add UTM parameters as hidden inputs
        const urlParams = new URLSearchParams(window.location.search);
        const utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'msclkid', 'gclid'];

        utmParams.forEach(param => {
            const value = urlParams.get(param);
            if (value) {
                createHiddenInput(param, value);
            }
        });

        // Add custom hidden inputs from localStorage
        const addCustomHiddenInputs = () => {
            try {
                const customInputsRaw = localStorage.getItem('customFormTrackingInputs');
                if (customInputsRaw) {
                    const customInputs = JSON.parse(customInputsRaw);
                    customInputs.forEach(input => {
                        if (input.name && input.value) {
                            createHiddenInput(input.name, input.value);
                            console.log(`✅ Added custom hidden input: ${input.name} = ${input.value}`);
                        }
                    });
                }
            } catch (error) {
                console.error('Error adding custom hidden inputs:', error);
            }
        };

        // Add custom inputs to the form
        addCustomHiddenInputs();
        // Function to refresh custom inputs (can be called from UI)
        window.refreshCustomFormInputs = () => {
            addCustomHiddenInputs();
            console.log('🔄 Refreshed custom form inputs');
        };
    } else {
        console.log('📝 No form found - skipping form-related setup (tracking data, hidden inputs, etc.)');
    }

    // 🔍 Filter Evaluation Function for Send Action Campaigns
    const evaluateCampaignFilters = async (filters = []) => {
        if (!filters || filters.length === 0) {
            console.log('✅ No filters to evaluate - campaign will trigger');
            return true;
        }

        console.log('🔍 Evaluating filters for Send Action campaign:', {
            filterCount: filters.length,
            filters: filters.map(f => ({ field: f.field, condition: f.condition, value: f.value }))
        });

        // Helper function to check filter condition
        const checkFilterCondition = (value, filterValue, condition) => {
            if (!value) return false;
            const val = value.toString().toLowerCase();
            const filterVal = filterValue.toString().toLowerCase();

            switch (condition) {
                case 'equal':
                    return val === filterVal;
                case 'not_equal':
                    return val !== filterVal;
                case 'contains':
                    return val.includes(filterVal);
                case 'not_contains':
                    return !val.includes(filterVal);
                case 'include':
                    const includeValues = filterVal.split(',').map(v => v.trim());
                    return includeValues.some(v => val.includes(v.toLowerCase()));
                case 'exclude':
                    const excludeValues = filterVal.split(',').map(v => v.trim());
                    return !excludeValues.some(v => val.includes(v.toLowerCase()));
                case 'starts_with':
                    return val.startsWith(filterVal);
                case 'ends_with':
                    return val.endsWith(filterVal);
                case 'greater_than':
                    return Number(val) > Number(filterVal);
                case 'less_than':
                    return Number(val) < Number(filterVal);
                default:
                    return val.includes(filterVal);
            }
        };

        // Cookie-based filters
        const cookieFilter = [
            "visitorId", "visitId", "urlpt_landing_page", "urlpt_landing_page_base",
            "_fbc", "_fbp", "urlpt_original_ref", "urlpt_ref", "urlpt_ref_domain",
            "urlpt_url", "urlpt_url_base", "email", "name", "mobile", "gaclientid"
        ];

        // URL parameter filters
        const paramsFilter = [
            'utm_source', 'utm_medium', 'utm_campaign',
            'utm_term', 'utm_content', 'utm_device', 'utm_devicemodel'
        ];

        // First touch UTM filters
        const firstTouchUTM = [
            'first_utm_source', 'first_utm_medium', 'first_utm_campaign',
            'first_utm_term', 'first_utm_content', 'first_utm_device',
            'first_utm_devicemodel', 'first_fbclid', 'first_msclkid', 'first_gclid'
        ];

        // Location-based filters (require API call)
        const locationFilter = ['country', 'state', 'city'];

        // Traffic source filters
        const trafficSourceFilter = [
            'traffic_source', 'first_traffic_source', 'organic_source', 'organic_source_str'
        ];

        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const getUrlParam = (param) => urlParams.get(param) || '';

        // Get traffic source
        const getTrafficSource = () => {
            const referrer = document.referrer;
            let source = 'Direct';
            if (referrer) {
                try {
                    const referrerDomain = new URL(referrer).hostname;
                    const currentDomain = window.location.hostname;
                    if (referrerDomain === currentDomain) source = 'Internal';
                    else if (referrerDomain.includes('google')) source = 'Google';
                    else if (referrerDomain.includes('facebook')) source = 'Facebook';
                    else if (referrerDomain.includes('twitter')) source = 'Twitter';
                    else if (referrerDomain.includes('instagram')) source = 'Instagram';
                    else if (referrerDomain.includes('linkedin')) source = 'LinkedIn';
                    else if (referrerDomain.includes('youtube')) source = 'YouTube';
                    else if (referrerDomain.includes('bing')) source = 'Bing';
                    else if (referrerDomain.includes('yahoo')) source = 'Yahoo';
                    else source = 'Referral';
                } catch (e) {
                    source = 'Direct';
                }
            }
            return source;
        };

        // Evaluate each filter
        for (let i = 0; i < filters.length; i++) {
            const filter = filters[i];
            let fieldValue = null;

            // Cookie-based filters
            if (cookieFilter.includes(filter.field)) {
                // Try visitor data first
                if (typeof window.visitorData !== 'undefined') {
                    if (filter.field === 'visitorId') fieldValue = window.visitorData.visitorId;
                    else if (filter.field === 'visitId') fieldValue = window.visitorData.visitId;
                    else if (filter.field === 'email') fieldValue = window.visitorData.email;
                    else if (filter.field === 'name') fieldValue = window.visitorData.fname;
                    else if (filter.field === 'mobile') fieldValue = window.visitorData.phone;
                    else if (filter.field === 'gaclientid') fieldValue = window.visitorData.gaclientid;
                    else fieldValue = window.visitorData[filter.field];
                }

                // Fallback to cookie
                if (!fieldValue) {
                    const cookieName = filter.field === 'gaclientid' ? '_ga' : filter.field;
                    fieldValue = getCookie(cookieName);
                }
            }
            // URL parameter filters
            else if (paramsFilter.includes(filter.field)) {
                fieldValue = getUrlParam(filter.field);
            }
            // First touch UTM filters
            else if (firstTouchUTM.includes(filter.field)) {
                fieldValue = getCookie(filter.field);
            }
            // Traffic source filters
            else if (trafficSourceFilter.includes(filter.field)) {
                if (filter.field === 'traffic_source') {
                    fieldValue = getTrafficSource();
                } else {
                    fieldValue = getCookie(filter.field);
                }
            }
            // Location filters (would need API call - simplified for now)
            else if (locationFilter.includes(filter.field)) {
                // For location, we'd need to make an API call
                // For now, skip location filters or implement geolocation API
                console.log('⚠️ Location filter not fully supported yet:', filter.field);
                continue;
            }
            // Default: try cookie
            else {
                fieldValue = getCookie(filter.field);
            }

            // Check filter condition
            const passed = checkFilterCondition(fieldValue, filter.value, filter.condition || 'contains');

            console.log(`🔍 Filter ${i + 1}/${filters.length}:`, {
                field: filter.field,
                value: fieldValue ? fieldValue.substring(0, 20) + '...' : 'null',
                condition: filter.condition,
                expected: filter.value,
                passed: passed
            });

            if (!passed) {
                console.log('❌ Filter failed - campaign will not trigger');
                return false;
            }
        }

        console.log('✅ All filters passed - campaign will trigger');
        return true;
    };

    // 🚀 SMS Campaign Trigger Function
    // isFormSubmission: true when called from form submission, false when called from global trigger setup
    const triggerSMSCampaigns = async (phoneNumber, userId, isFormSubmission = false) => {
        try {
            console.log('🔍 Checking for active SMS campaigns...');
            console.log('📞 Phone Number:', phoneNumber ? phoneNumber.slice(0, 4) + '***' + phoneNumber.slice(-4) : 'null');
            console.log('👤 User ID:', userId);

            // Get active SMS campaigns for this user
            const campaignsResponse = await fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-sms-campaigns?userId=${userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!campaignsResponse.ok) {
                console.log('⚠️ Could not fetch SMS campaigns:', campaignsResponse.status);
                return;
            }

            const campaignsData = await campaignsResponse.json();
            console.log('📡 Campaigns API Response:', campaignsData);
            const activeSMSCampaigns = campaignsData.campaigns || [];

            console.log('📋 Active SMS Campaigns Found:', {
                count: activeSMSCampaigns.length,
                campaigns: activeSMSCampaigns.map(c => ({
                    id: c._id,
                    name: c.name,
                    category: c.category,
                    subCategory: c.subCategory
                }))
            });

            // Trigger each active SMS campaign
            for (const campaign of activeSMSCampaigns) {
                if (campaign.category === 'Send Action' && campaign.subCategory === 'SMS') {
                    console.log('📱 Processing SMS Campaign:', {
                        campaignId: campaign._id,
                        campaignName: campaign.name,
                        hasFilters: !!(campaign.filters && campaign.filters.length > 0),
                        hasTrigger: !!campaign.triggerType,
                        triggerType: campaign.triggerType
                    });

                    // Function to actually send SMS
                    const sendSMS = async () => {
                        try {
                            const smsResponse = await fetch('https://urlpt-api.onrender.com/api/script/send-sms', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contact: phoneNumber,
                                    templateId: campaign._id,
                                    userId: userId,
                                    visitorId: getCookie('visitorId'),
                                    visitId: getCookie('visitId')
                                })
                            });

                            const smsResult = await smsResponse.json();
                            console.log('📤 SMS Campaign Result:', {
                                campaignId: campaign._id,
                                success: smsResult.success,
                                message: smsResult.message,
                                timestamp: new Date().toISOString()
                            });

                            if (smsResult.success) {
                                // Increment trigger count
                                const triggerCountKey = `campaign_trigger_count_${campaign._id}`;
                                const currentCount = parseInt(localStorage.getItem(triggerCountKey) || '0', 10);
                                localStorage.setItem(triggerCountKey, (currentCount + 1).toString());
                                console.log('✅ SMS Campaign triggered successfully!');
                            } else {
                                console.log('❌ SMS Campaign failed:', smsResult.message);
                            }
                        } catch (smsError) {
                            console.error('❌ Error triggering SMS campaign:', {
                                campaignId: campaign._id,
                                error: smsError.message
                            });
                        }
                    };

                    // Check filters first
                    const filtersPassed = await evaluateCampaignFilters(campaign.filters || []);

                    if (!filtersPassed) {
                        console.log('🚫 SMS Campaign skipped - filters did not pass:', campaign._id);
                        continue;
                    }

                    // Handle trigger-based campaigns
                    if (campaign.triggerType) {
                        console.log('⏱️ SMS Campaign has trigger:', campaign.triggerType);

                        // Check trigger count limit
                        const maxTriggers = campaign.noOfTimeToShow || 1;
                        const triggerCountKey = `campaign_trigger_count_${campaign._id}`;
                        const currentCount = parseInt(localStorage.getItem(triggerCountKey) || '0', 10);

                        if (currentCount >= maxTriggers) {
                            console.log(`🚫 SMS Campaign trigger limit reached (${currentCount}/${maxTriggers}):`, campaign._id);
                            continue;
                        }

                        // For form submission: send immediately if under limit (don't check sessionStorage)
                        // sessionStorage is only used to prevent duplicate trigger-based sends (Time On Page, Scroll, etc.)
                        // Form submission is a separate trigger event
                        if (isFormSubmission) {
                            console.log('📝 Form submission detected - sending immediately (bypassing trigger listener and sessionStorage check)');
                            await sendSMS();
                            continue; // Don't set up trigger listener again
                        }

                        // For global trigger setup: check sessionStorage to prevent duplicate trigger-based sends
                        const triggerKey = `sms_campaign_triggered_${campaign._id}`;
                        if (sessionStorage.getItem(triggerKey)) {
                            console.log('⏭️ SMS Campaign already triggered in this session (trigger-based):', campaign._id);
                            continue;
                        }

                        // Time On Page trigger
                        if (campaign.triggerType === 'Time On Page' && campaign.timeOnPage) {
                            const timeInMs = Number(campaign.timeOnPage) * 1000;
                            console.log(`⏰ Setting Time On Page trigger for ${campaign.timeOnPage} seconds`);
                            setTimeout(async () => {
                                if (!sessionStorage.getItem(triggerKey)) {
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendSMS();
                                }
                            }, timeInMs);
                        }
                        // Scroll trigger
                        else if (campaign.triggerType === 'scroll' && campaign.scroll) {
                            console.log(`📜 Setting Scroll trigger for ${campaign.scroll}%`);
                            let scrollTriggered = false;
                            window.addEventListener('scroll', async () => {
                                if (scrollTriggered || sessionStorage.getItem(triggerKey)) return;
                                const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
                                const scrollPercentage = (window.scrollY / scrollableHeight) * 100;
                                if (scrollPercentage >= Number(campaign.scroll)) {
                                    scrollTriggered = true;
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendSMS();
                                }
                            });
                        }
                        // Exit Intent trigger
                        else if (campaign.triggerType === 'Exit intent') {
                            console.log('🚪 Setting Exit Intent trigger');
                            let exitIntentTriggered = false;
                            document.addEventListener('mouseout', async (evt) => {
                                if (exitIntentTriggered || sessionStorage.getItem(triggerKey)) return;
                                if (evt.toElement == null && evt.relatedTarget == null) {
                                    exitIntentTriggered = true;
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendSMS();
                                }
                            });
                        }
                        // Date And Time trigger
                        else if (campaign.triggerType === 'Date And Time' && campaign.startTime && campaign.endTime) {
                            console.log('📅 Setting Date And Time trigger');
                            const checkTimeAndSend = async () => {
                                if (sessionStorage.getItem(triggerKey)) return;
                                const startTime = new Date(campaign.startTime).getTime();
                                const endTime = new Date(campaign.endTime).getTime();
                                const currentTime = new Date().getTime();

                                if (currentTime >= startTime && currentTime <= endTime) {
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendSMS();
                                }
                            };
                            checkTimeAndSend();
                            setInterval(checkTimeAndSend, 1000);
                        }
                        // No trigger or unknown trigger - send immediately
                        else {
                            console.log('⚡ No valid trigger or immediate trigger - sending SMS now');
                            sessionStorage.setItem(triggerKey, 'true');
                            await sendSMS();
                        }
                    } else {
                        // No trigger - send immediately after form submission
                        console.log('⚡ No trigger configured - sending SMS immediately');
                        await sendSMS();
                    }
                }
            }

            console.log('🎉 SMS Campaign trigger process completed!');

        } catch (error) {
            console.error('❌ Error in triggerSMSCampaigns:', error);
        }
    };

    // 📧 Email Campaign Trigger Function
    // isFormSubmission: true when called from form submission, false when called from global trigger setup
    const triggerEmailCampaigns = async (emailAddress, userId, isFormSubmission = false) => {
        try {
            console.log('🔍 Checking for active email campaigns...');
            console.log('📧 Email Address:', emailAddress ? emailAddress.slice(0, 3) + '***' + emailAddress.slice(emailAddress.indexOf('@')) : 'null');
            console.log('👤 User ID:', userId);

            // Get active email campaigns for this user
            const campaignsResponse = await fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-email-campaigns?userId=${userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!campaignsResponse.ok) {
                console.log('⚠️ Could not fetch email campaigns:', campaignsResponse.status);
                return;
            }

            const campaignsData = await campaignsResponse.json();
            console.log('📡 Email Campaigns API Response:', campaignsData);
            const activeEmailCampaigns = campaignsData.campaigns || [];

            console.log('📋 Active Email Campaigns Found:', {
                count: activeEmailCampaigns.length,
                campaigns: activeEmailCampaigns.map(c => ({
                    id: c._id,
                    name: c.name,
                    category: c.category,
                    subCategory: c.subCategory
                }))
            });

            // Trigger each active email campaign
            for (const campaign of activeEmailCampaigns) {
                if (campaign.category === 'Send Action' && campaign.subCategory === 'Email') {
                    console.log('📧 Processing Email Campaign:', {
                        campaignId: campaign._id,
                        campaignName: campaign.name,
                        hasFilters: !!(campaign.filters && campaign.filters.length > 0),
                        hasTrigger: !!campaign.triggerType,
                        triggerType: campaign.triggerType
                    });

                    // Function to actually send Email
                    const sendEmail = async () => {
                        try {
                            const emailResponse = await fetch('https://urlpt-api.onrender.com/api/script/send-email-campaign', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    email: emailAddress,
                                    templateId: campaign._id,
                                    userId: userId,
                                    visitorId: getCookie('visitorId'),
                                    visitId: getCookie('visitId')
                                })
                            });

                            const emailResult = await emailResponse.json();
                            console.log('📤 Email Campaign Result:', {
                                campaignId: campaign._id,
                                success: emailResult.success,
                                message: emailResult.message,
                                timestamp: new Date().toISOString()
                            });

                            if (emailResult.success) {
                                // Increment trigger count
                                const triggerCountKey = `campaign_trigger_count_${campaign._id}`;
                                const currentCount = parseInt(localStorage.getItem(triggerCountKey) || '0', 10);
                                localStorage.setItem(triggerCountKey, (currentCount + 1).toString());
                                console.log('✅ Email Campaign triggered successfully!');
                            } else {
                                console.log('❌ Email Campaign failed:', emailResult.message);
                            }
                        } catch (emailError) {
                            console.error('❌ Error triggering email campaign:', {
                                campaignId: campaign._id,
                                error: emailError.message
                            });
                        }
                    };

                    // Check filters first
                    const filtersPassed = await evaluateCampaignFilters(campaign.filters || []);

                    if (!filtersPassed) {
                        console.log('🚫 Email Campaign skipped - filters did not pass:', campaign._id);
                        continue;
                    }

                    // Handle trigger-based campaigns
                    if (campaign.triggerType) {
                        console.log('⏱️ Email Campaign has trigger:', campaign.triggerType);

                        // Check trigger count limit
                        const maxTriggers = campaign.noOfTimeToShow || 1;
                        const triggerCountKey = `campaign_trigger_count_${campaign._id}`;
                        const currentCount = parseInt(localStorage.getItem(triggerCountKey) || '0', 10);

                        if (currentCount >= maxTriggers) {
                            console.log(`🚫 Email Campaign trigger limit reached (${currentCount}/${maxTriggers}):`, campaign._id);
                            continue;
                        }

                        // For form submission: send immediately if under limit (don't check sessionStorage)
                        // sessionStorage is only used to prevent duplicate trigger-based sends (Time On Page, Scroll, etc.)
                        // Form submission is a separate trigger event
                        if (isFormSubmission) {
                            console.log('📝 Form submission detected - sending immediately (bypassing trigger listener and sessionStorage check)');
                            await sendEmail();
                            continue; // Don't set up trigger listener again
                        }

                        // For global trigger setup: check sessionStorage to prevent duplicate trigger-based sends
                        const triggerKey = `email_campaign_triggered_${campaign._id}`;
                        if (sessionStorage.getItem(triggerKey)) {
                            console.log('⏭️ Email Campaign already triggered in this session (trigger-based):', campaign._id);
                            continue;
                        }

                        // Time On Page trigger
                        if (campaign.triggerType === 'Time On Page' && campaign.timeOnPage) {
                            const timeInMs = Number(campaign.timeOnPage) * 1000;
                            console.log(`⏰ Setting Time On Page trigger for ${campaign.timeOnPage} seconds`);
                            setTimeout(async () => {
                                if (!sessionStorage.getItem(triggerKey)) {
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendEmail();
                                }
                            }, timeInMs);
                        }
                        // Scroll trigger
                        else if (campaign.triggerType === 'scroll' && campaign.scroll) {
                            console.log(`📜 Setting Scroll trigger for ${campaign.scroll}%`);
                            let scrollTriggered = false;
                            window.addEventListener('scroll', async () => {
                                if (scrollTriggered || sessionStorage.getItem(triggerKey)) return;
                                const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
                                const scrollPercentage = (window.scrollY / scrollableHeight) * 100;
                                if (scrollPercentage >= Number(campaign.scroll)) {
                                    scrollTriggered = true;
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendEmail();
                                }
                            });
                        }
                        // Exit Intent trigger
                        else if (campaign.triggerType === 'Exit intent') {
                            console.log('🚪 Setting Exit Intent trigger');
                            let exitIntentTriggered = false;
                            document.addEventListener('mouseout', async (evt) => {
                                if (exitIntentTriggered || sessionStorage.getItem(triggerKey)) return;
                                if (evt.toElement == null && evt.relatedTarget == null) {
                                    exitIntentTriggered = true;
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendEmail();
                                }
                            });
                        }
                        // Date And Time trigger
                        else if (campaign.triggerType === 'Date And Time' && campaign.startTime && campaign.endTime) {
                            console.log('📅 Setting Date And Time trigger');
                            const checkTimeAndSend = async () => {
                                if (sessionStorage.getItem(triggerKey)) return;
                                const startTime = new Date(campaign.startTime).getTime();
                                const endTime = new Date(campaign.endTime).getTime();
                                const currentTime = new Date().getTime();

                                if (currentTime >= startTime && currentTime <= endTime) {
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendEmail();
                                }
                            };
                            checkTimeAndSend();
                            setInterval(checkTimeAndSend, 1000);
                        }
                        // No trigger or unknown trigger - send immediately
                        else {
                            console.log('⚡ No valid trigger or immediate trigger - sending Email now');
                            sessionStorage.setItem(triggerKey, 'true');
                            await sendEmail();
                        }
                    } else {
                        // No trigger - send immediately after form submission
                        console.log('⚡ No trigger configured - sending Email immediately');
                        await sendEmail();
                    }
                }
            }

            console.log('🎉 Email Campaign trigger process completed!');

        } catch (error) {
            console.error('❌ Error in triggerEmailCampaigns:', error);
        }
    };

    // 📱 WhatsApp Campaign Trigger Function
    // isFormSubmission: true when called from form submission, false when called from global trigger setup
    const triggerWhatsAppCampaigns = async (phoneNumber, userId, isFormSubmission = false) => {
        try {
            console.log('🔍 Checking for active WhatsApp campaigns...');
            console.log('📱 Phone Number:', phoneNumber ? phoneNumber.slice(0, 4) + '***' + phoneNumber.slice(-4) : 'null');
            console.log('👤 User ID:', userId);

            // Get active WhatsApp campaigns for this user
            const campaignsResponse = await fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-whatsapp-campaigns?userId=${userId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!campaignsResponse.ok) {
                console.log('⚠️ Could not fetch WhatsApp campaigns:', campaignsResponse.status);
                return;
            }

            const campaignsData = await campaignsResponse.json();
            console.log('📡 WhatsApp Campaigns API Response:', campaignsData);
            const activeWhatsAppCampaigns = campaignsData.campaigns || [];

            console.log('📋 Active WhatsApp Campaigns Found:', {
                count: activeWhatsAppCampaigns.length,
                campaigns: activeWhatsAppCampaigns.map(c => ({
                    id: c._id,
                    name: c.name,
                    category: c.category,
                    subCategory: c.subCategory
                }))
            });

            // Trigger each active WhatsApp campaign
            for (const campaign of activeWhatsAppCampaigns) {
                if (campaign.category === 'Send Action' && campaign.subCategory === 'WhatsApp') {
                    console.log('📱 Processing WhatsApp Campaign:', {
                        campaignId: campaign._id,
                        campaignName: campaign.name,
                        hasFilters: !!(campaign.filters && campaign.filters.length > 0),
                        hasTrigger: !!campaign.triggerType,
                        triggerType: campaign.triggerType
                    });

                    // Function to actually send WhatsApp
                    const sendWhatsApp = async () => {
                        try {
                            const whatsappResponse = await fetch('https://urlpt-api.onrender.com/api/script/send-whatsapp', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    phoneNumber: phoneNumber,
                                    templateId: campaign._id,
                                    userId: userId,
                                    visitorId: getCookie('visitorId'),
                                    visitId: getCookie('visitId')
                                })
                            });

                            const whatsappResult = await whatsappResponse.json();
                            console.log('📤 WhatsApp Campaign Result:', {
                                campaignId: campaign._id,
                                success: whatsappResult.success,
                                message: whatsappResult.message,
                                timestamp: new Date().toISOString()
                            });

                            if (whatsappResult.success) {
                                // Increment trigger count
                                const triggerCountKey = `campaign_trigger_count_${campaign._id}`;
                                const currentCount = parseInt(localStorage.getItem(triggerCountKey) || '0', 10);
                                localStorage.setItem(triggerCountKey, (currentCount + 1).toString());
                                console.log('✅ WhatsApp Campaign triggered successfully!');
                            } else {
                                console.log('❌ WhatsApp Campaign failed:', whatsappResult.message);
                            }
                        } catch (whatsappError) {
                            console.error('❌ Error triggering WhatsApp campaign:', {
                                campaignId: campaign._id,
                                error: whatsappError.message
                            });
                        }
                    };

                    // Check filters first
                    const filtersPassed = await evaluateCampaignFilters(campaign.filters || []);

                    if (!filtersPassed) {
                        console.log('🚫 WhatsApp Campaign skipped - filters did not pass:', campaign._id);
                        continue;
                    }

                    // Handle trigger-based campaigns
                    if (campaign.triggerType) {
                        console.log('⏱️ WhatsApp Campaign has trigger:', campaign.triggerType);

                        // Check trigger count limit
                        const maxTriggers = campaign.noOfTimeToShow || 1;
                        const triggerCountKey = `campaign_trigger_count_${campaign._id}`;
                        const currentCount = parseInt(localStorage.getItem(triggerCountKey) || '0', 10);

                        if (currentCount >= maxTriggers) {
                            console.log(`🚫 WhatsApp Campaign trigger limit reached (${currentCount}/${maxTriggers}):`, campaign._id);
                            continue;
                        }

                        // For form submission: send immediately if under limit (don't check sessionStorage)
                        // sessionStorage is only used to prevent duplicate trigger-based sends (Time On Page, Scroll, etc.)
                        // Form submission is a separate trigger event
                        if (isFormSubmission) {
                            console.log('📝 Form submission detected - sending immediately (bypassing trigger listener and sessionStorage check)');
                            await sendWhatsApp();
                            continue; // Don't set up trigger listener again
                        }

                        // For global trigger setup: check sessionStorage to prevent duplicate trigger-based sends
                        const triggerKey = `whatsapp_campaign_triggered_${campaign._id}`;
                        if (sessionStorage.getItem(triggerKey)) {
                            console.log('⏭️ WhatsApp Campaign already triggered in this session (trigger-based):', campaign._id);
                            continue;
                        }

                        // Time On Page trigger
                        if (campaign.triggerType === 'Time On Page' && campaign.timeOnPage) {
                            const timeInMs = Number(campaign.timeOnPage) * 1000;
                            console.log(`⏰ Setting Time On Page trigger for ${campaign.timeOnPage} seconds`);
                            setTimeout(async () => {
                                if (!sessionStorage.getItem(triggerKey)) {
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendWhatsApp();
                                }
                            }, timeInMs);
                        }
                        // Scroll trigger
                        else if (campaign.triggerType === 'scroll' && campaign.scroll) {
                            console.log(`📜 Setting Scroll trigger for ${campaign.scroll}%`);
                            let scrollTriggered = false;
                            window.addEventListener('scroll', async () => {
                                if (scrollTriggered || sessionStorage.getItem(triggerKey)) return;
                                const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
                                const scrollPercentage = (window.scrollY / scrollableHeight) * 100;
                                if (scrollPercentage >= Number(campaign.scroll)) {
                                    scrollTriggered = true;
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendWhatsApp();
                                }
                            });
                        }
                        // Exit Intent trigger
                        else if (campaign.triggerType === 'Exit intent') {
                            console.log('🚪 Setting Exit Intent trigger');
                            let exitIntentTriggered = false;
                            document.addEventListener('mouseout', async (evt) => {
                                if (exitIntentTriggered || sessionStorage.getItem(triggerKey)) return;
                                if (evt.toElement == null && evt.relatedTarget == null) {
                                    exitIntentTriggered = true;
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendWhatsApp();
                                }
                            });
                        }
                        // Date And Time trigger
                        else if (campaign.triggerType === 'Date And Time' && campaign.startTime && campaign.endTime) {
                            console.log('📅 Setting Date And Time trigger');
                            const checkTimeAndSend = async () => {
                                if (sessionStorage.getItem(triggerKey)) return;
                                const startTime = new Date(campaign.startTime).getTime();
                                const endTime = new Date(campaign.endTime).getTime();
                                const currentTime = new Date().getTime();

                                if (currentTime >= startTime && currentTime <= endTime) {
                                    sessionStorage.setItem(triggerKey, 'true');
                                    await sendWhatsApp();
                                }
                            };
                            checkTimeAndSend();
                            setInterval(checkTimeAndSend, 1000);
                        }
                        // No trigger or unknown trigger - send immediately
                        else {
                            console.log('⚡ No valid trigger or immediate trigger - sending WhatsApp now');
                            sessionStorage.setItem(triggerKey, 'true');
                            await sendWhatsApp();
                        }
                    } else {
                        // No trigger - send immediately after form submission
                        console.log('⚡ No trigger configured - sending WhatsApp immediately');
                        await sendWhatsApp();
                    }
                }
            }

            console.log('🎉 WhatsApp Campaign trigger process completed!');

        } catch (error) {
            console.error('❌ Error in triggerWhatsAppCampaigns:', error);
        }
    };

    // Log all hidden inputs for debugging (only if form exists)
    if (form) {
        console.log('📝 All hidden inputs in form:', Array.from(form.querySelectorAll('input[type="hidden"]')).map(input => `${input.name}=${input.value}`));
    }

    // Add traffic source (only if form exists)
    if (form) {
        const referrer = document.referrer;
        let trafficSource = 'Direct';
        if (referrer) {
            const referrerDomain = new URL(referrer).hostname;
            const currentDomain = window.location.hostname;

            if (referrerDomain === currentDomain) trafficSource = 'Internal';
            else if (referrerDomain.includes('google')) trafficSource = 'Google';
            else if (referrerDomain.includes('facebook')) trafficSource = 'Facebook';
            else if (referrerDomain.includes('twitter')) trafficSource = 'Twitter';
            else if (referrerDomain.includes('instagram')) trafficSource = 'Instagram';
            else if (referrerDomain.includes('linkedin')) trafficSource = 'LinkedIn';
            else if (referrerDomain.includes('youtube')) trafficSource = 'YouTube';
            else if (referrerDomain.includes('bing')) trafficSource = 'Bing';
            else if (referrerDomain.includes('yahoo')) trafficSource = 'Yahoo';
            else trafficSource = 'Referral';
        }
        createHiddenInput('traffic_source', trafficSource);
        console.log('✅ Added tracking data as hidden inputs to form');
    }

    // Handle form submission (only if form exists)
    const handleFormSubmission = async () => {
        if (!form) {
            console.log('⚠️ Form submission handler called but no form found');
            return;
        }

        console.log('🚀 Form submission started - using enhanced field detection...');

        // Use enhanced field mapping
        const mappedFields = enhancedFieldMapping(form);
        console.log('🔍 Enhanced field mapping results:', mappedFields);

        // Process multiple fields and select best candidates
        const processedFields = processMultipleFields(mappedFields);
        console.log('✅ Processed fields:', processedFields);

        // Build the final payload
        const mappedData = {
            ...processedFields,
            visitorId: getCookie('visitorId'),
            visitId: getCookie('visitId'),
            userId: userId
        };

        // Add field detection metadata for debugging
        if (processedFields.email_detected_by) {
            mappedData.email_detection_method = processedFields.email_detected_by;
        }
        if (processedFields.phone_detected_by) {
            mappedData.phone_detection_method = processedFields.phone_detected_by;
        }

        console.log('📝 Enhanced form data being sent:', mappedData);

        try {
            const response = await fetch(conversionUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mappedData),
            });

            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }

            const responseData = await response.json();
            console.log('✅ Form data posted successfully:', responseData);
            console.log('📋 Response structure:', {
                hasSuccess: 'success' in responseData,
                hasMessage: 'message' in responseData,
                successValue: responseData.success,
                messageValue: responseData.message,
                responseKeys: Object.keys(responseData)
            });

            // 🚀 TRIGGER SMS CAMPAIGNS AFTER SUCCESSFUL CONVERSION
            if ((responseData.success || responseData.message) && mappedData.phone) {
                console.log('📱 Conversion successful! Checking for active SMS campaigns...');

                // Save phone number in cookie for SMS campaigns
                const setCookie = (name, value, days = 365) => {
                    const expires = new Date();
                    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
                    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
                };

                // Save phone number in cookie
                setCookie('phone', mappedData.phone);
                console.log('🍪 Phone number saved in cookie:', {
                    phone: mappedData.phone.slice(0, 4) + '***' + mappedData.phone.slice(-4),
                    cookieName: 'phone',
                    timestamp: new Date().toISOString()
                });

                // Trigger SMS campaigns by checking for active campaigns
                console.log('🚀 Calling triggerSMSCampaigns function...');
                triggerSMSCampaigns(mappedData.phone, userId, true); // true = form submission

                // Trigger WhatsApp campaigns as well
                console.log('🚀 Calling triggerWhatsAppCampaigns function...');
                triggerWhatsAppCampaigns(mappedData.phone, userId, true); // true = form submission
            } else {
                console.log('⚠️ SMS not triggered because:', {
                    responseSuccess: responseData.success,
                    hasPhone: !!mappedData.phone,
                    phoneValue: mappedData.phone
                });
            }

            // 📧 TRIGGER EMAIL CAMPAIGNS AFTER SUCCESSFUL CONVERSION
            if ((responseData.success || responseData.message) && mappedData.email) {
                console.log('📧 Conversion successful! Checking for active email campaigns...');

                // Save email in cookie for email campaigns
                const setCookie = (name, value, days = 365) => {
                    const expires = new Date();
                    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
                    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
                };

                // Save email in cookie
                setCookie('email', mappedData.email);
                console.log('🍪 Email saved in cookie:', {
                    email: mappedData.email.slice(0, 3) + '***' + mappedData.email.slice(mappedData.email.indexOf('@')),
                    cookieName: 'email',
                    timestamp: new Date().toISOString()
                });

                // Trigger email campaigns by checking for active campaigns
                console.log('🚀 Calling triggerEmailCampaigns function...');
                triggerEmailCampaigns(mappedData.email, userId, true); // true = form submission
            } else {
                console.log('⚠️ Email not triggered because:', {
                    responseSuccess: responseData.success,
                    hasEmail: !!mappedData.email,
                    emailValue: mappedData.email
                });
            }
        } catch (error) {
            console.error('❌ Error sending form data:', error);
        }
    };

    // Add event listeners for form submission (only if form exists)
    if (form) {
        if (submitButton) {
            submitButton.addEventListener('click', handleFormSubmission);
            console.log('📝 Added click listener to submit button:', submitButton.className || submitButton.tagName);
        }

        // Also listen for form submit event
        form.addEventListener('submit', handleFormSubmission);
        console.log('📝 Added submit listener to form');
    } else {
        console.log('📝 No form found - skipping form event listeners');
    }

    console.log('✅ Enhanced form tracking script loaded successfully');
    console.log('🚀 Advanced field detection system active with:');
    console.log('   - HTML5 type detection');
    console.log('   - Data attribute detection');
    console.log('   - Label association detection');
    console.log('   - Enhanced pattern matching');
    console.log('   - Multiple field support');

    // 🚀 Setup Trigger-Based Send Action Campaigns on Page Load
    // This handles campaigns that should trigger based on triggers (Time On Page, Scroll, etc.)
    // even when no form is submitted, as long as phone/email is available in cookies
    const setupTriggerBasedCampaigns = async () => {
        const userId = getUserId();
        if (!userId) {
            console.log('⚠️ Cannot setup trigger-based campaigns - userId not available');
            return;
        }

        const phoneFromCookie = getCookie('phone');
        const emailFromCookie = getCookie('email');

        if (!phoneFromCookie && !emailFromCookie) {
            console.log('ℹ️ No phone or email in cookies - skipping trigger-based campaign setup');
            return;
        }

        console.log('🔍 Setting up trigger-based Send Action campaigns...');
        console.log('📞 Phone in cookie:', phoneFromCookie ? phoneFromCookie.slice(0, 4) + '***' + phoneFromCookie.slice(-4) : 'none');
        console.log('📧 Email in cookie:', emailFromCookie ? emailFromCookie.slice(0, 3) + '***' + emailFromCookie.slice(emailFromCookie.indexOf('@')) : 'none');

        // Fetch all active campaigns
        const [smsCampaignsRes, emailCampaignsRes, whatsappCampaignsRes] = await Promise.all([
            phoneFromCookie ? fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-sms-campaigns?userId=${userId}`).catch(() => null) : null,
            emailFromCookie ? fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-email-campaigns?userId=${userId}`).catch(() => null) : null,
            phoneFromCookie ? fetch(`https://urlpt-api.onrender.com/api/campaign/get-active-whatsapp-campaigns?userId=${userId}`).catch(() => null) : null
        ]);

        // Process SMS campaigns
        if (smsCampaignsRes && phoneFromCookie) {
            try {
                const smsData = await smsCampaignsRes.json();
                const campaigns = smsData.campaigns || [];
                for (const campaign of campaigns) {
                    if (campaign.triggerType && campaign.category === 'Send Action' && campaign.subCategory === 'SMS') {
                        await setupCampaignTrigger(campaign, 'SMS', phoneFromCookie, userId);
                    }
                }
            } catch (e) {
                console.error('Error processing SMS campaigns:', e);
            }
        }

        // Process Email campaigns
        if (emailCampaignsRes && emailFromCookie) {
            try {
                const emailData = await emailCampaignsRes.json();
                const campaigns = emailData.campaigns || [];
                for (const campaign of campaigns) {
                    if (campaign.triggerType && campaign.category === 'Send Action' && campaign.subCategory === 'Email') {
                        await setupCampaignTrigger(campaign, 'Email', emailFromCookie, userId);
                    }
                }
            } catch (e) {
                console.error('Error processing Email campaigns:', e);
            }
        }

        // Process WhatsApp campaigns
        if (whatsappCampaignsRes && phoneFromCookie) {
            try {
                const whatsappData = await whatsappCampaignsRes.json();
                const campaigns = whatsappData.campaigns || [];
                for (const campaign of campaigns) {
                    if (campaign.triggerType && campaign.category === 'Send Action' && campaign.subCategory === 'WhatsApp') {
                        await setupCampaignTrigger(campaign, 'WhatsApp', phoneFromCookie, userId);
                    }
                }
            } catch (e) {
                console.error('Error processing WhatsApp campaigns:', e);
            }
        }
    };

    // Helper function to check trigger count limit
    const checkTriggerCountLimit = (campaignId, maxTriggers) => {
        const triggerCountKey = `campaign_trigger_count_${campaignId}`;
        const currentCount = parseInt(localStorage.getItem(triggerCountKey) || '0', 10);
        const maxCount = maxTriggers || 1;

        console.log(`📊 Trigger count check for campaign ${campaignId}:`, {
            currentCount,
            maxCount,
            canTrigger: currentCount < maxCount
        });

        return currentCount < maxCount;
    };

    // Helper function to increment trigger count
    const incrementTriggerCount = (campaignId) => {
        const triggerCountKey = `campaign_trigger_count_${campaignId}`;
        const currentCount = parseInt(localStorage.getItem(triggerCountKey) || '0', 10);
        const newCount = currentCount + 1;
        localStorage.setItem(triggerCountKey, newCount.toString());
        console.log(`📈 Incremented trigger count for campaign ${campaignId}:`, newCount);
        return newCount;
    };

    // Helper function to setup a single campaign trigger
    const setupCampaignTrigger = async (campaign, type, contact, userId) => {
        // Check filters first
        const filtersPassed = await evaluateCampaignFilters(campaign.filters || []);
        if (!filtersPassed) {
            console.log(`🚫 ${type} Campaign skipped (trigger-based) - filters did not pass:`, campaign._id);
            return;
        }

        // Check trigger count limit
        const maxTriggers = campaign.noOfTimeToShow || 1;
        if (!checkTriggerCountLimit(campaign._id, maxTriggers)) {
            console.log(`🚫 ${type} Campaign skipped (trigger-based) - trigger limit reached:`, campaign._id);
            return;
        }

        const triggerKey = `${type.toLowerCase()}_campaign_triggered_${campaign._id}`;
        const sessionTriggered = sessionStorage.getItem(triggerKey);

        // If already triggered in this session, don't set up again
        if (sessionTriggered) {
            console.log(`⏭️ ${type} Campaign already triggered in this session:`, campaign._id);
            return;
        }

        const sendMessage = async () => {
            // Re-check filters before sending (in case visitor data changed)
            const filtersStillPass = await evaluateCampaignFilters(campaign.filters || []);
            if (!filtersStillPass) {
                console.log(`🚫 ${type} Campaign skipped - filters did not pass when trigger fired:`, campaign._id);
                return;
            }

            // Check trigger count again before sending
            if (!checkTriggerCountLimit(campaign._id, maxTriggers)) {
                console.log(`🚫 ${type} Campaign trigger limit reached before sending:`, campaign._id);
                return;
            }

            const endpoint = type === 'SMS' ? '/api/script/send-sms' :
                type === 'Email' ? '/api/script/send-email-campaign' :
                    '/api/script/send-whatsapp';

            const body = type === 'Email' ?
                { email: contact, templateId: campaign._id, userId, visitorId: getCookie('visitorId'), visitId: getCookie('visitId') } :
                { [type === 'SMS' ? 'contact' : 'phoneNumber']: contact, templateId: campaign._id, userId, visitorId: getCookie('visitorId'), visitId: getCookie('visitId') };

            try {
                const response = await fetch(`https://urlpt-api.onrender.com${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });
                const result = await response.json();
                if (result.success) {
                    // Mark as triggered in this session
                    sessionStorage.setItem(triggerKey, 'true');
                    // Increment trigger count
                    incrementTriggerCount(campaign._id);
                    console.log(`✅ ${type} Campaign triggered successfully (trigger-based):`, campaign._id);
                }
            } catch (error) {
                console.error(`❌ Error triggering ${type} campaign:`, error);
            }
        };

        // Setup trigger based on type
        if (campaign.triggerType === 'Time On Page' && campaign.timeOnPage) {
            const timeInMs = Number(campaign.timeOnPage) * 1000;
            setTimeout(() => {
                if (!sessionStorage.getItem(triggerKey)) {
                    sendMessage();
                }
            }, timeInMs);
        } else if (campaign.triggerType === 'scroll' && campaign.scroll) {
            let scrollTriggered = false;
            window.addEventListener('scroll', () => {
                if (scrollTriggered || sessionStorage.getItem(triggerKey)) return;
                const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollPercentage = (window.scrollY / scrollableHeight) * 100;
                if (scrollPercentage >= Number(campaign.scroll)) {
                    scrollTriggered = true;
                    sendMessage();
                }
            });
        } else if (campaign.triggerType === 'Exit intent') {
            let exitIntentTriggered = false;
            document.addEventListener('mouseout', (evt) => {
                if (exitIntentTriggered || sessionStorage.getItem(triggerKey)) return;
                if (evt.toElement == null && evt.relatedTarget == null) {
                    exitIntentTriggered = true;
                    sendMessage();
                }
            });
        } else if (campaign.triggerType === 'Date And Time' && campaign.startTime && campaign.endTime) {
            let dateTimeTriggered = false;
            const checkTimeAndSend = () => {
                if (dateTimeTriggered || sessionStorage.getItem(triggerKey)) return;
                const startTime = new Date(campaign.startTime).getTime();
                const endTime = new Date(campaign.endTime).getTime();
                const currentTime = new Date().getTime();
                if (currentTime >= startTime && currentTime <= endTime) {
                    dateTimeTriggered = true;
                    sendMessage();
                }
            };
            checkTimeAndSend();
            setInterval(checkTimeAndSend, 1000);
        }
    };

    // Setup trigger-based campaigns after a short delay to ensure cookies are available
    // This runs regardless of whether a form exists on the page
    setTimeout(setupTriggerBasedCampaigns, 1000);
});
