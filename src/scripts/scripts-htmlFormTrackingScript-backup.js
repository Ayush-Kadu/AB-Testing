document.addEventListener('DOMContentLoaded', async () => {
    // Support multiple form classes
    const form = document.querySelector('.urlpt_form, .wpcf7-form');
    const submitButton = document.querySelector('.urlpt_form_btn, .gform_button, .wpcf7-submit');
    const conversionUrl = 'http://localhost:5008/api/conversion/add-conversion';

    const getCookie = (name) => {
        const cookies = document.cookie.split(';').map(c => c.trim());
        const cookie = cookies.find(c => c.startsWith(`${name}=`));
        return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
    };

    const createHiddenInput = (name, value) => {
        if (!form.querySelector(`input[name="${name}"]`)) {
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

    try {
        const userCookieRaw = getCookie('userCookie');
        if (userCookieRaw) {
            const userCookie = JSON.parse(userCookieRaw);
            flattenAndAppend(userCookie);
        }
    } catch (e) {
        console.error('Invalid JSON in userCookie:', e);
    }

    submitButton.addEventListener('click', async () => {
        const data = {};

        // Collect form values by name or id
        form.querySelectorAll('input, select, textarea').forEach((el) => {
            const key = el.name || el.id;
            if (key && el.value !== undefined && el.value !== null) {
                data[key] = el.value;
            }
        });

        // Auto-detect and map form fields intelligently
        const mappedData = {};
        Object.entries(data).forEach(([key, value]) => {
            let mappedKey = key;
            
            // Auto-detect email fields
            if (
                key.toLowerCase().includes('email') ||
                key.toLowerCase().includes('mail') ||
                key.toLowerCase().includes('e-mail') ||
                key.toLowerCase().includes('useremail') ||
                key.toLowerCase().includes('user_email') ||
                (key.toLowerCase().includes('input_') && value && value.includes('@')) ||
                (key.toLowerCase().includes('field_') && value && value.includes('@'))
            ) {
                mappedKey = 'email';
            }
            // Auto-detect name fields
            else if (
                key.toLowerCase().includes('name') ||
                key.toLowerCase().includes('fname') ||
                key.toLowerCase().includes('firstname') ||
                key.toLowerCase().includes('first_name') ||
                key.toLowerCase().includes('fullname') ||
                key.toLowerCase().includes('full_name') ||
                key.toLowerCase().includes('username') ||
                key.toLowerCase().includes('user_name') ||
                (key.toLowerCase().includes('input_') && !key.toLowerCase().includes('email') && !key.toLowerCase().includes('phone') && !key.toLowerCase().includes('tel'))
            ) {
                mappedKey = 'name';
            }
            // Auto-detect phone fields
            else if (
                key.toLowerCase().includes('phone') ||
                key.toLowerCase().includes('tel') ||
                key.toLowerCase().includes('mobile') ||
                key.toLowerCase().includes('cell') ||
                key.toLowerCase().includes('telephone') ||
                key.toLowerCase().includes('userphone') ||
                key.toLowerCase().includes('user_phone') ||
                (key.toLowerCase().includes('input_') && value && /[\d\s\-\+\(\)]/.test(value) && value.length >= 7)
            ) {
                mappedKey = 'phone';
            }
            // Auto-detect first name fields
            else if (
                key.toLowerCase().includes('first') ||
                key.toLowerCase().includes('fname') ||
                key.toLowerCase().includes('firstname') ||
                key.toLowerCase().includes('first_name')
            ) {
                mappedKey = 'firstName';
            }
            // Auto-detect last name fields
            else if (
                key.toLowerCase().includes('last') ||
                key.toLowerCase().includes('lname') ||
                key.toLowerCase().includes('lastname') ||
                key.toLowerCase().includes('last_name') ||
                key.toLowerCase().includes('surname')
            ) {
                mappedKey = 'lastName';
            }
            
            mappedData[mappedKey] = value;
        });

        // Add required fields
        mappedData.visitorId = getCookie('visitorId');
        mappedData.visitId = getCookie('visitId');
        mappedData.userId = userId;

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
            console.log('Data posted successfully:', responseData);
        } catch (error) {
            console.error('Error sending form data:', error);
        }
    });
});