(function () {
        console.log('📧 Email Campaign Script Loaded - Campaign ID: 6a463c7bbc218cdc9720041b');
        console.log('👤 User ID: 68b58625949a81fd08330b38');
        console.log('🔍 Campaign Details:', {
            name: 'send',
            category: 'Send Action',
            subCategory: 'Email',
            isActive: true
        });

        const main = () => {
            
        console.log('🚀 Filter script starting execution...');
        console.log('📊 Total filters to evaluate:', 0);

        // Filter evaluation function
        function evaluateFilters() {
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
                } else if (originalRef.match(/facebook/i) !== null || originalRef.match(/fb\.com$/i) !== null) {
                    source = "Facebook";
                } else if (originalRef.match(/twitter/i) !== null || originalRef.match(/t\.co$/i) !== null) {
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
                };
                return trafficData;
            }
     
                console.log('✅ All filters passed - campaign will be shown');
                return true;
            }
            
            // Execute the filter evaluation
            const filterResult = evaluateFilters();
            if (!filterResult) {
                console.log('❌ Filter evaluation failed - campaign will not be shown');
                return false;
            }
            console.log('✅ Filter evaluation passed - campaign will be shown');
            return true;
        

            console.log('🚀 Email Campaign Script Executing - Main function called!');
            console.log('🚀 Email Campaign Script Executing...');
            
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
            
            // Function to send email
            const sendEmail = (emailAddress) => {
                console.log('✅ Email address found! Preparing to send email...');
                console.log('📤 Sending Email Request:', {
                    to: emailAddress.substring(0, 3) + '***' + emailAddress.substring(emailAddress.indexOf('@')),
                    templateId: '6a463c7bbc218cdc9720041b',
                    userId: '68b58625949a81fd08330b38',
                    campaignName: 'send'
                });
                
                fetch('https://urlpt-api.onrender.com/api/script/send-email-campaign', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        email: emailAddress, 
                        templateId: "6a463c7bbc218cdc9720041b", 
                        userId: "68b58625949a81fd08330b38" 
                    }),
                })
                .then(response => {
                    console.log('📡 Email API Response Status:', response.status);
                    return response.json();
                })
                .then(data => {
                    console.log('✅ Email Sent Successfully:', {
                        success: data.success,
                        message: data.message,
                        campaignId: '6a463c7bbc218cdc9720041b',
                        timestamp: new Date().toISOString()
                    });
                })
                .catch((error) => {
                    console.error('❌ Email Send Failed:', {
                        error: error.message,
                        campaignId: '6a463c7bbc218cdc9720041b',
                        timestamp: new Date().toISOString()
                    });
                });
            };
            
            let popUpShown = false;
            const showPopUp = () => {
                console.log('🎯 Trigger fired! Running email campaign action...');
                
                // Check for email address in cookies immediately
                const emailAddress = getCookie('email');
                console.log('📧 Email Address Check:', {
                    found: !!emailAddress,
                    value: emailAddress ? emailAddress.substring(0, 3) + '***' + emailAddress.substring(emailAddress.indexOf('@')) : null,
                    cookieName: 'email'
                });
                
                // Check all cookies for debugging
                console.log('🍪 All Cookies:', document.cookie);
                
                if (emailAddress) {
                    // Email address found immediately - send email
                    sendEmail(emailAddress);
                } else {
                    console.log('⏳ No email address found immediately - setting up form submission listener...');
                    
                    // Listen for form submissions to catch when email address gets saved
                    const checkForEmailAndSendEmail = () => {
                        const emailInCookie = getCookie('email');
                        if (emailInCookie) {
                            console.log('🎉 Email address detected after form submission!');
                            sendEmail(emailInCookie);
                            return true; // Stop checking
                        }
                        return false; // Continue checking
                    };
                    
                    // Check every 2 seconds for 30 seconds (15 attempts)
                    let attempts = 0;
                    const maxAttempts = 15;
                    const checkInterval = setInterval(() => {
                        attempts++;
                        console.log('🔍 Checking for email address (attempt ' + attempts + '/' + maxAttempts + ')...');
                        
                        if (checkForEmailAndSendEmail()) {
                            console.log('✅ Email address found and email sent!');
                            clearInterval(checkInterval);
                        } else if (attempts >= maxAttempts) {
                            console.log('⏰ Timeout: No email address found after 30 seconds');
                            clearInterval(checkInterval);
                        }
                    }, 2000);
                    
                    // Also listen for form submission events
                    document.addEventListener('submit', (event) => {
                        console.log('📝 Form submission detected - checking for email address...');
                        setTimeout(() => {
                            if (checkForEmailAndSendEmail()) {
                                clearInterval(checkInterval);
                            }
                        }, 1000); // Wait 1 second after form submission
                    });
                }
            };

            // Trigger initialization
            setTimeout(() => {
            showPopUp()
        }, Number('1') * 1000);
        };

        if (document.readyState === 'loading') {
            console.log('⏳ DOM Loading - Waiting for DOMContentLoaded...');
            document.addEventListener('DOMContentLoaded', main);
        } else {
            console.log('⚡ DOM Ready - Executing immediately...');
            main();
        }
    })();