
                // Campaign Script for 6a3d24f9f3011983080c7093 - No filters - Generated at 2026-06-26T04:29:50.227Z
                console.log('🚀 Campaign Script Loading - Campaign: 6a3d24f9f3011983080c7093 (No filters)');
                console.log('✅ No filters applied - checking display count limit');
                console.log('   - No. of Time to Show: 1');
                
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
                        const response = await fetch('https://urlpt-api.onrender.comender.com/api/campaign/check-display-limit/6a3d24f9f3011983080c7093', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                visitorId: window.visitorId || getCookie('visitorId'),
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
                        console.log('✅ Display count check passed - showing campaign 6a3d24f9f3011983080c7093');
                        
            (function () {
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

                var visitorId = getCookie('visitorId');
                var visitId = getCookie('visitId');
                var popUpShown = false;
                var completelyClosed = false;
                var sessionShown = false;
                
                async function postData(endpoint, body) {
                    try {
                        const response = await fetch('https://urlpt-api.onrender.comender.com/api/campaign/' + endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(body)
                        });
                        return await response.json();
                    } catch (error) {
                        console.error('Error:', error);
                    }
                }

                function createMiniButton() {
                    if (document.querySelector('.dynamic-template-mini-btn')) return;
                    
                    const miniBtnContainer = document.createElement('div');
                    miniBtnContainer.className = 'dynamic-template-mini-btn';
                    miniBtnContainer.style.cssText = `position: fixed; bottom: 20px; left: 20px; display: flex; align-items: center; background: #2185a6; color: #FFFFFF; border-radius: 0.5rem; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 99999998; transition: all 0.3s ease;`;
                    // Check for other teasers and add count badge - with better debugging and timing
                    console.log('🔍 DynamicTemplate2: Checking for existing teasers...');
                    
                    // Add a small delay to ensure DOM is updated
                    setTimeout(() => {
                        // Use class-based selector to find all teaser containers
                        const allTeasers = document.querySelectorAll('.urlpt-teaser-container, .dynamic-template-mini-btn');
                        console.log('🔍 DynamicTemplate2: Found', allTeasers.length, 'existing teaser containers');
                        
                        // Log details of found elements
                        allTeasers.forEach((teaser, index) => {
                            console.log('🔍 DynamicTemplate2: Teaser', index, 'style:', teaser.style.cssText.substring(0, 100));
                        });
                        
                        if (allTeasers.length > 0) {
                            console.log('🔍 DynamicTemplate2: Adding count badge and hover effects');
                            
                            // Check if a count badge already exists
                            let existingCountBadge = document.querySelector('.teaser-count-badge');
                            if (!existingCountBadge) {
                                // Create count badge only if one doesn't exist
                                const countBadge = document.createElement('div');
                                countBadge.className = 'teaser-count-badge';
                                countBadge.style.cssText = 'position: absolute; top: -8px; right: -8px; background: #FF6B6B; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; z-index: 99999999; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
                                countBadge.textContent = allTeasers.length + 1;
                                miniBtnContainer.appendChild(countBadge);
                                console.log('🔍 DynamicTemplate2: Created new count badge with number:', allTeasers.length + 1);
                            } else {
                                // Update existing count badge
                                existingCountBadge.textContent = allTeasers.length + 1;
                                console.log('🔍 DynamicTemplate2: Updated existing count badge to:', allTeasers.length + 1);
                            }
                            
                            // Add hover effect to spread teasers
                            const addHoverEffects = () => {
                                console.log('🔍 DynamicTemplate2: Hover ENTER - spreading teasers');
                                const teasers = document.querySelectorAll('.urlpt-teaser-container, .dynamic-template-mini-btn');
                                console.log('🔍 DynamicTemplate2: Found', teasers.length, 'teasers to spread');
                                teasers.forEach((teaser, index) => {
                                    const transform = 'translateX(' + (index * 30) + 'px) translateY(' + (-index * 15) + 'px)';
                                    teaser.style.transform = transform;
                                    console.log('🔍 DynamicTemplate2: Teaser', index, 'transform:', transform);
                                    // Ensure all teasers are visible by giving them high z-index values
                                    teaser.style.zIndex = 99999999 + index;
                                    console.log('🔍 DynamicTemplate2: Teaser', index, 'z-index:', 99999999 + index);
                                });
                            };
                            
                            const removeHoverEffects = () => {
                                console.log('🔍 DynamicTemplate2: Hover LEAVE - resetting teasers');
                                const teasers = document.querySelectorAll('.urlpt-teaser-container, .dynamic-template-mini-btn');
                                teasers.forEach((teaser, index) => {
                                    teaser.style.transform = '';
                                    teaser.style.zIndex = '99999998';
                                    console.log('🔍 DynamicTemplate2: Reset teaser', index, 'transform and z-index');
                                });
                            };
                            
                            // Add hover effects to this teaser
                            miniBtnContainer.addEventListener('mouseenter', addHoverEffects);
                            miniBtnContainer.addEventListener('mouseleave', removeHoverEffects);
                            console.log('🔍 DynamicTemplate2: Added hover effects to new teaser');
                            
                            // Add hover effects to all existing teasers
                            allTeasers.forEach((teaser, index) => {
                                teaser.addEventListener('mouseenter', addHoverEffects);
                                teaser.addEventListener('mouseleave', removeHoverEffects);
                                console.log('🔍 DynamicTemplate2: Added hover effects to existing teaser', index);
                            });
                        } else {
                            console.log('🔍 DynamicTemplate2: No existing teasers found, skipping count badge and hover effects');
                        }
                    }, 100); // 100ms delay

                    const miniBtn = document.createElement('button');
                    miniBtn.textContent = 'Show Offer';
                    miniBtn.style.cssText = `font-size: 1rem; font-weight: 600; padding: 0.5rem 1rem; border: none; background: transparent; color: inherit; cursor: pointer;`;
                    
                    const divider = document.createElement('span');
                    divider.style.cssText = `width: 1px; height: 20px; background-color: rgba(255,255,255,0.3);`;

                    const permanentCloseBtn = document.createElement('button');
                    permanentCloseBtn.innerHTML = '×';
                    permanentCloseBtn.style.cssText = `font-size: 1.5rem; font-weight: bold; padding: 0 0.75rem; height: 100%; border: none; background: transparent; color: inherit; cursor: pointer; display: flex; align-items: center;`;
                    permanentCloseBtn.title = 'Permanently close';
                    
                    miniBtn.onclick = () => {
                        // Clear teaser state when user clicks "Still Interested?"
                        localStorage.removeItem('6a3d24f9f3011983080c7093_teaser');
                        main();
                        miniBtnContainer.remove();
                    };
                    
                    permanentCloseBtn.onclick = async (e) => {
                        e.stopPropagation();
                        
                        // Track permanent close event
                        const payload = {
                            campaignId: '6a3d24f9f3011983080c7093',
                            buttonValue: '✕',
                            visitorId, 
                            visitId
                        };
                        
                        await postData('increase-counter', payload);
                        // Clear teaser state when permanently closing
                        localStorage.removeItem('6a3d24f9f3011983080c7093_teaser');
                        completelyClosePopup();
                        miniBtnContainer.remove();
                    };
                    
                    miniBtnContainer.appendChild(miniBtn);
                    miniBtnContainer.appendChild(divider);
                    miniBtnContainer.appendChild(permanentCloseBtn);
                    document.body.appendChild(miniBtnContainer);
                }
                
                function completelyClosePopup() {
                    completelyClosed = true;
                    localStorage.setItem('6a3d24f9f3011983080c7093', 'true');
                    const overlay = document.querySelector('div[data-popup="true"]');
                    if (overlay) overlay.remove();
                    document.body.style.overflow = '';
                }

                function main() {
                    console.log('🚀 Dynamic Template: main() called');
                    // Check if popup was permanently closed
                    if (localStorage.getItem('6a3d24f9f3011983080c7093') === 'true') {
                        console.log('⚠️ Dynamic Template: Popup permanently closed, returning');
                        return;
                    }
                    
                    // Check if campaign is in teaser state
                    if (localStorage.getItem('6a3d24f9f3011983080c7093_teaser') === 'true') {
                        console.log('⚠️ Dynamic Template: Campaign in teaser state, showing teaser');
                        createMiniButton();
                        return;
                    }
                    
                    if (popUpShown || completelyClosed) {
                        console.log('⚠️ Dynamic Template: Popup already shown or completely closed, returning');
                        return;
                    }
                    popUpShown = true;
                    
                    // Track popup appearance only once per session
                    if (!sessionShown) {
                        postData('increase-appear', {
                            campaignId: '6a3d24f9f3011983080c7093',
                            visitorId, 
                            visitId
                        });
                        sessionShown = true;
                    }

                    const floatPosition = 'top-left'.toLowerCase().trim().replace(/\s+/g, '-');
                    const isFloatingBar = floatPosition === 'top' || floatPosition === 'bottom';
                    const isSideBar = floatPosition === 'left' || floatPosition === 'right';
                    const isWelcomeMat = 'CowntDown Timer' === 'Full Screen Welcome Mat';
                    const borderRadius = '1%';

                    if (!isFloatingBar && !isSideBar) {
                        document.body.style.overflow = 'hidden';
                    }

                    const hasSplitElement = false;
                    if (hasSplitElement && !document.getElementById('urlpt-split-layout-styles')) {
                        const splitStyles = document.createElement('style');
                        splitStyles.id = 'urlpt-split-layout-styles';
                        splitStyles.innerHTML = `
                            .urlpt-split-container {
                                display: flex;
                                flex-direction: column;
                                width: 100%;
                                gap: 16px;
                                align-items: center;
                            }
                            @media (min-width: 600px) {
                                .urlpt-split-container {
                                    flex-direction: row !important;
                                
                                    text-align: left !important;
                                }
                                .urlpt-split-col-left {
                                    flex: 1 !important;
                                    display: flex !important;
                                    justify-content: center !important;
                                    min-width: 0 !important;
                                }
                                .urlpt-split-col-right {
                                    flex: 1 !important;
                                    display: flex !important;
                                    flex-direction: column !important;
                                    gap: 12px !important;
                                    min-width: 0 !important;
                                    align-items: stretch !important;
                                }
                            }
                        `;
                        document.head.appendChild(splitStyles);
                    }

                    if (!document.getElementById('urlpt-campaign-animations')) {
                        const animStyle = document.createElement('style');
                        animStyle.id = 'urlpt-campaign-animations';
                        animStyle.innerHTML = `
                            @keyframes urlpt-fade-in {
                                from { opacity: 0; }
                                to { opacity: 1; }
                            }
                            @keyframes urlpt-zoom-in {
                                from { transform: scale(0.95); opacity: 0; }
                                to { transform: scale(1); opacity: 1; }
                            }
                            @keyframes urlpt-zoom-in-centered {
                                from { transform: translate(-50%, -50%) scale(0.95); opacity: 0; }
                                to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                            }
                            @keyframes urlpt-slide-up-floating {
                                from { transform: translateX(-50%) translateY(100px); opacity: 0; }
                                to { transform: translateX(-50%) translateY(0); opacity: 1; }
                            }
                            @keyframes urlpt-slide-down-floating {
                                from { transform: translateX(-50%) translateY(-100px); opacity: 0; }
                                to { transform: translateX(-50%) translateY(0); opacity: 1; }
                            }
                            @keyframes urlpt-slide-up-corner {
                                from { transform: translateY(40px); opacity: 0; }
                                to { transform: translateY(0); opacity: 1; }
                            }
                            @keyframes urlpt-slide-down-corner {
                                from { transform: translateY(-40px); opacity: 0; }
                                to { transform: translateY(0); opacity: 1; }
                            }
                            @keyframes urlpt-slide-in-left {
                                from { transform: translateX(-100%); opacity: 0; }
                                to { transform: translateX(0); opacity: 1; }
                            }
                            @keyframes urlpt-slide-in-right {
                                from { transform: translateX(100%); opacity: 0; }
                                to { transform: translateX(0); opacity: 1; }
                            }
                            @keyframes urlpt-element-entrance {
                                from { opacity: 0; transform: translateY(15px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                            @keyframes urlpt-shake-smooth {
                                0%, 75%, 100% { transform: rotate(0deg) translate(0, 0); }
                                80% { transform: rotate(-0.5deg) translate(-1px, -0.5px); }
                                85% { transform: rotate(0.5deg) translate(1px, 0.5px); }
                                90% { transform: rotate(-0.3deg) translate(-0.5px, 0.5px); }
                                95% { transform: rotate(0.3deg) translate(0.5px, -0.5px); }
                            }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn) {
                                animation: urlpt-element-entrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
                            }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(2) { animation-delay: 0.05s; }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(3) { animation-delay: 0.12s; }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(4) { animation-delay: 0.19s; }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(5) { animation-delay: 0.26s; }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(6) { animation-delay: 0.33s; }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(7) { animation-delay: 0.40s; }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(8) { animation-delay: 0.47s; }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(9) { animation-delay: 0.54s; }
                            [data-popup="true"] > div > div > *:not(.urlpt-close-btn):nth-child(10) { animation-delay: 0.61s; }
                        `;
                        document.head.appendChild(animStyle);
                    }

                    const overlay = document.createElement('div');
                    overlay.setAttribute('data-popup', 'true');
                    overlay.style.position = 'fixed';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.width = '100vw';
                    overlay.style.height = '100vh';
                    if (isFloatingBar || isSideBar) {
                        overlay.style.backgroundColor = 'transparent';
                        overlay.style.pointerEvents = 'none';
                    } else {
                        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
                    }
                    overlay.style.display = 'flex';
                    overlay.style.alignItems = 'center';
                    overlay.style.justifyContent = 'center';
                    overlay.style.zIndex = '99999999';
                    overlay.style.animation = 'urlpt-fade-in 0.25s ease-out forwards';

                    const posWrapper = document.createElement('div');
                    posWrapper.style.position = 'fixed';
                    posWrapper.style.zIndex = '99999999';
                    if (isFloatingBar || isSideBar) {
                        posWrapper.style.pointerEvents = 'none';
                    }

                    const container = document.createElement('div');
                    container.style.background = '#2185a6';
                    container.style.color = 'white';
                    container.style.position = 'relative';
                    container.style.overflow = 'hidden';
                    container.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.15)';
                    container.style.boxSizing = 'border-box';
                    container.style.textAlign = 'center';
                    container.style.pointerEvents = 'auto';

                    if (isFloatingBar) {
                        const fp = floatPosition || 'top';
                        posWrapper.style.width = '90%';
                        posWrapper.style.maxWidth = '600px';
                        posWrapper.style.position = 'fixed';
                        posWrapper.style.left = '50%';
                        posWrapper.style.transform = 'translateX(-50%)';
                        if (fp === 'top') {
                            posWrapper.style.top = '20px';
                            posWrapper.style.animation = 'urlpt-slide-down-floating 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                        } else {
                            posWrapper.style.bottom = '20px';
                            posWrapper.style.animation = 'urlpt-slide-up-floating 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                        }

                        container.style.width = '100%';
                        container.style.padding = '12px 40px 12px0p
                        container.style.borderRadius = borderRadius || '12px';
                        container.style.display = 'flex';
                        container.style.flexDirection = 'row';
                        container.style.justifyContent = 'center';
                        container.style.alignItems = 'center';
                        container.style.gap = '16px';
                        container.style.animation = 'urlpt-shake-smooth 6s ease-in-out infinite';
                    } else if (isSideBar) {
                        const fp = floatPosition || 'left';
                        posWrapper.style.width = '100%';
                        posWrapper.style.maxWidth = '360px';
                        posWrapper.style.position = 'fixed';

                        const gapVal = '0px';
                        if (fp === 'right') {
                            posWrapper.style.right = '0';
                            posWrapper.style.top = '0';
                            posWrapper.style.bottom = '0';
                            posWrapper.style.height = '100vh';
                            posWrapper.style.maxHeight = '100vh';
                            posWrapper.style.animation = 'urlpt-slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';

                            container.style.width = '100%';
                            container.style.height = '100%';
                            container.style.borderRadius = '0';
                        } else if (fp === 'top-left') {
                            posWrapper.style.left = gapVal;
                            posWrapper.style.top = gapVal;
                            posWrapper.style.height = 'auto';
                            posWrapper.style.maxHeight = '100vh';
                            posWrapper.style.animation = 'urlpt-slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';

                            container.style.width = '100%';
                            container.style.height = '100%';
                            container.style.borderRadius = borderRadius;
                        } else if (fp === 'bottom-left') {
                            posWrapper.style.left = gapVal;
                            posWrapper.style.bottom = gapVal;
                            posWrapper.style.height = 'auto';
                            posWrapper.style.maxHeight = '100vh';
                            posWrapper.style.animation = 'urlpt-slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';

                            container.style.width = '100%';
                            container.style.height = '100%';
                            container.style.borderRadius = borderRadius;
                        } else if (fp === 'top-right') {
                            posWrapper.style.right = gapVal;
                            posWrapper.style.top = gapVal;
                            posWrapper.style.height = 'auto';
                            posWrapper.style.maxHeight = '100vh';
                            posWrapper.style.animation = 'urlpt-slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';

                            container.style.width = '100%';
                            container.style.height = '100%';
                            container.style.borderRadius = borderRadius;
                        } else if (fp === 'bottom-right') {
                            posWrapper.style.right = gapVal;
                            posWrapper.style.bottom = gapVal;
                            posWrapper.style.height = 'auto';
                            posWrapper.style.maxHeight = '100vh';
                            posWrapper.style.animation = 'urlpt-slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';

                            container.style.width = '100%';
                            container.style.height = '100%';
                            container.style.borderRadius = borderRadius;
                        } else { // default to 'left'
                            posWrapper.style.left = '0';
                            posWrapper.style.top = '0';
                            posWrapper.style.bottom = '0';
                            posWrapper.style.height = '100vh';
                            posWrapper.style.maxHeight = '100vh';
                            posWrapper.style.animation = 'urlpt-slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';

                            container.style.width = '100%';
                            container.style.height = '100%';
                            container.style.borderRadius = '0';
                        }

                        container.style.overflowY = 'auto';
                        container.style.overflowX = 'hidden';
                        container.style.display = 'flex';
                        container.style.flexDirection = 'column';
                        container.style.justifyContent = 'flex-start';
                        container.style.alignItems = 'stretch';
                        container.style.padding = '2rem 1rem';
                        container.style.boxShadow = '2px 2px 16px rgba(0,0,0,0.08)';
                        container.style.animation = 'urlpt-shake-smooth 6s ease-in-out infinite';
                    } else {
                        posWrapper.style.position = 'fixed';
                        posWrapper.style.zIndex = '99999999';
                        if (isWelcomeMat) {
                            posWrapper.style.width = '100%';
                            posWrapper.style.maxWidth = '100%';
                            posWrapper.style.height = '100vh';
                            posWrapper.style.maxHeight = '100vh';
                            posWrapper.style.top = '0';
                            posWrapper.style.left = '0';
                            posWrapper.style.transform = 'none';
                            posWrapper.style.animation = 'urlpt-fade-in 0.4s ease-out forwards';
                        } else {
                            posWrapper.style.boxSizing = 'border-box';
                            if (hasSplitElement && window.innerWidth >= 600) {
                                posWrapper.style.width = '750px';
                                posWrapper.style.maxWidth = '100vw';
                            } else {
                            
                                posWrapper.style.maxWidth = '100vw';
                            }
                            posWrapper.style.maxHeight = '100vh';
                            
                            const fp = floatPosition || 'center';
                            if (window.innerWidth < 600) {
                                posWrapper.style.top = '50%';
                                posWrapper.style.left = '50%';
                                posWrapper.style.transform = 'translate(-50%, -50%)';
                                posWrapper.style.animation = 'urlpt-zoom-in-centered 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
                            } else {
                                switch (fp) {
                                    case 'left':
                                        posWrapper.style.left = '0px';
                                        posWrapper.style.top = '50%';
                                        posWrapper.style.transform = 'translateY(-50%)';
                                        posWrapper.style.animation = 'urlpt-slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                                        break;
                                    case 'right':
                                        posWrapper.style.right = '0px';
                                        posWrapper.style.top = '50%';
                                        posWrapper.style.transform = 'translateY(-50%)';
                                        posWrapper.style.animation = 'urlpt-slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                                        break;
                                    case 'top':
                                        posWrapper.style.top = '0px';
                                        posWrapper.style.left = '50%';
                                        posWrapper.style.transform = 'translateX(-50%)';
                                        posWrapper.style.animation = 'urlpt-slide-down-floating 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                                        break;
                                    case 'bottom':
                                        posWrapper.style.bottom = '0px';
                                        posWrapper.style.left = '50%';
                                        posWrapper.style.transform = 'translateX(-50%)';
                                        posWrapper.style.animation = 'urlpt-slide-up-floating 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                                        break;
                                    case 'top-left':
                                        posWrapper.style.top = '0px';
                                        posWrapper.style.left = '0px';
                                        posWrapper.style.transform = 'none';
                                        posWrapper.style.animation = 'urlpt-slide-down-corner 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                                        break;
                                    case 'bottom-left':
                                        posWrapper.style.bottom = '0px';
                                        posWrapper.style.left = '0px';
                            
                                        posWrapper.style.transform = 'none';
                                        posWrapper.style.animation = 'urlpt-slide-up-corner 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                                        break;
                                    case 'top-right':
                                        posWrapper.style.top = '0px';
                                        posWrapper.style.right = '0px';
                                        posWrapper.style.transform = 'none';
                                        posWrapper.style.animation = 'urlpt-slide-down-corner 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                                        break;
                                    case 'bottom-right':
                                        posWrapper.style.bottom = '0px';
                                        posWrapper.style.right = '0px';
                                        posWrapper.style.transform = 'none';
                                        posWrapper.style.animation = 'urlpt-slide-up-corner 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
                                        break;
                                    case 'center':
                                    default:
                                        posWrapper.style.top = '50%';
                                        posWrapper.style.left = '50%';
                                        posWrapper.style.transform = 'translate(-50%, -50%)';
                                        posWrapper.style.animation = 'urlpt-zoom-in-centered 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
                                        break;
                                }
                            }
                        }

                        container.style.width = '100%';
                        container.style.height = '100%';
                        container.style.borderRadius = isWelcomeMat ? '0' : borderRadius;
                        container.style.padding = isWelcomeMat ? '4rem 2rem' : '2rem';
                        container.style.overflowY = 'auto';
                        container.style.overflowX = 'hidden';
                        if (isWelcomeMat) {
                            container.style.display = 'flex';
                            container.style.flexDirection = 'column';
                            container.style.justifyContent = 'center';
                            container.style.alignItems = 'center';
                            container.style.gap = '1.5rem';
                        } else {
                            container.style.animation = 'urlpt-shake-smooth 6s ease-in-out infinite';
                        }
                    }

                    // Dynamic content rendering
                    
                            const timerContainer_timer_1782284700302 = document.createElement('div');
                            timerContainer_timer_1782284700302.style.marginBottom = '1.5rem';
                            timerContainer_timer_1782284700302.style.display = 'flex';
                            timerContainer_timer_1782284700302.style.justifyContent = 'center';
                            timerContainer_timer_1782284700302.style.flexWrap = 'wrap';
                            timerContainer_timer_1782284700302.style.gap = '0.75rem';

                            const timerUnits_timer_1782284700302 = ['DD', 'HH', 'MM', 'SS'];
                            const timerBoxes_timer_1782284700302 = {};
                            const timerStorageKey_timer_1782284700302 = '6a3d24f9f3011983080c7093_timer_timer_1782284700302';

                            timerUnits_timer_1782284700302.forEach(function(unit) {
                                const box = document.createElement('div');
                                box.style.minWidth = '72px';
                                box.style.padding = '1rem';
                                box.style.borderRadius = '1rem';
                                box.style.backgroundColor = '#4C1D95';
                                box.style.color = '#FACC15';
                                box.style.display = 'flex';
                                box.style.flexDirection = 'column';
                                box.style.alignItems = 'center';
                                box.style.justifyContent = 'center';
                                box.style.fontFamily = 'Arial';
                                box.style.fontWeight = 'bold';
                                box.style.fontSize = '16px';

                                const value = document.createElement('div');
                                value.textContent = '00';
                                value.style.fontSize = '1.2rem';
                                value.style.fontWeight = '700';
                                value.style.marginBottom = '0.25rem';

                                const label = document.createElement('div');
                                label.textContent = unit;
                                label.style.fontSize = '0.75rem';
                                label.style.opacity = '0.85';

                                box.appendChild(value);
                                box.appendChild(label);
                                timerContainer_timer_1782284700302.appendChild(box);
                                timerBoxes_timer_1782284700302[unit] = value;
                            });

                            let existingEndTime_timer_1782284700302 = parseInt(localStorage.getItem(timerStorageKey_timer_1782284700302), 10);
                            if (isNaN(existingEndTime_timer_1782284700302) || existingEndTime_timer_1782284700302 <= Date.now()) {
                                existingEndTime_timer_1782284700302 = Date.now() + 32700 * 1000;
                                localStorage.setItem(timerStorageKey_timer_1782284700302, existingEndTime_timer_1782284700302.toString());
                            }
                            let timerSeconds_timer_1782284700302 = Math.max(0, Math.ceil((existingEndTime_timer_1782284700302 - Date.now()) / 1000));

                            function updateTimer_timer_1782284700302() {
                                const now = Date.now();
                                if (existingEndTime_timer_1782284700302 <= now) {
                                    timerSeconds_timer_1782284700302 = 0;
                                    timerBoxes_timer_1782284700302['DD'].textContent = '00';
                                    timerBoxes_timer_1782284700302['HH'].textContent = '00';
                                    timerBoxes_timer_1782284700302['MM'].textContent = '00';
                                    timerBoxes_timer_1782284700302['SS'].textContent = '00';
                                    return;
                                }
                                timerSeconds_timer_1782284700302 = Math.max(0, Math.ceil((existingEndTime_timer_1782284700302 - now) / 1000));
                                const days = Math.floor(timerSeconds_timer_1782284700302 / 86400);
                                const hours = Math.floor((timerSeconds_timer_1782284700302 % 86400) / 3600);
                                const minutes = Math.floor((timerSeconds_timer_1782284700302 % 3600) / 60);
                                const seconds = timerSeconds_timer_1782284700302 % 60;
                                timerBoxes_timer_1782284700302['DD'].textContent = days.toString().padStart(2, '0');
                                timerBoxes_timer_1782284700302['HH'].textContent = hours.toString().padStart(2, '0');
                                timerBoxes_timer_1782284700302['MM'].textContent = minutes.toString().padStart(2, '0');
                                timerBoxes_timer_1782284700302['SS'].textContent = seconds.toString().padStart(2, '0');
                            }

                            updateTimer_timer_1782284700302();
                            const timerInterval_timer_1782284700302 = setInterval(function () {
                                if (existingEndTime_timer_1782284700302 <= Date.now()) {
                                    clearInterval(timerInterval_timer_1782284700302);
                                    updateTimer_timer_1782284700302();
                                    return;
                                }
                                updateTimer_timer_1782284700302();
                            }, 1000);
                            

                    // Close button
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'urlpt-close-btn';
                    closeBtn.innerHTML = '×';
                    closeBtn.style.position = 'absolute';
                    closeBtn.style.top = isFloatingBar ? '50%' : '10px';
                    closeBtn.style.transform = isFloatingBar ? 'translateY(-50%)' : 'none';
                    closeBtn.style.right = '10px';
                    closeBtn.style.background = 'none';
                    closeBtn.style.border = 'none';
                    closeBtn.style.color = 'white';
                    closeBtn.style.fontSize = '1.5rem';
                    closeBtn.style.cursor = 'pointer';
                    closeBtn.style.fontWeight = 'bold';
                    closeBtn.style.zIndex = '1';

                    closeBtn.addEventListener('click', async () => {
                        // Track close event
                        const payload = {
                            campaignId: '6a3d24f9f3011983080c7093',
                            buttonValue: '✕',
                            visitorId, 
                            visitId
                        };
                        
                        await postData('increase-counter', payload);
                        
                        // Check if teaser is enabled
                        if (true) {
                            // Store teaser state in localStorage
                            localStorage.setItem('6a3d24f9f3011983080c7093_teaser', 'true');
                            // Create teaser instead of completely closing
                            popUpShown = false; // Reset so teaser can reopen
                            createMiniButton();
                        document.body.style.overflow = '';
                        overlay.remove();
                        } else {
                            // Completely close the popup
                            completelyClosePopup();
                        }
                    });

                    // Add event listeners for buttons
                    

                    // Assemble popup
                    container.appendChild(closeBtn);
                    
                    let targetContainer = container;
                    let leftCol = null;
                    let rightCol = null;
                    
                    if (hasSplitElement) {
                        const innerWrapper = document.createElement('div');
                        innerWrapper.className = 'urlpt-split-container';
                        innerWrapper.style.width = '100%';
                        
                        leftCol = document.createElement('div');
                        leftCol.className = 'urlpt-split-col-left';
                        
                        rightCol = document.createElement('div');
                        rightCol.className = 'urlpt-split-col-right';
                        
                        innerWrapper.appendChild(leftCol);
                        innerWrapper.appendChild(rightCol);
                        container.appendChild(innerWrapper);
                    }
                    
                    
                            if (hasSplitElement) {
                                if (false) {
                                    if (leftCol && timerContainer_timer_1782284700302) leftCol.appendChild(timerContainer_timer_1782284700302);
                                } else {
                                    if (rightCol && timerContainer_timer_1782284700302) rightCol.appendChild(timerContainer_timer_1782284700302);
                                }
                            } else {
                                if (container && timerContainer_timer_1782284700302) container.appendChild(timerContainer_timer_1782284700302);
                            }
            
                    posWrapper.appendChild(container);
                    overlay.appendChild(posWrapper);
                    document.body.appendChild(overlay);
                }

                // Check if popup was permanently closed
                if (localStorage.getItem('6a3d24f9f3011983080c7093') === 'true') {
                    completelyClosed = true;
                } else {
                    if (document.readyState === 'loading') {
                        document.addEventListener('DOMContentLoaded', function () {
                            
            setTimeout(() => {
                if (popUpShown) return;
                main()
            }, Number("1") * 1000);
            
                        });
                    } else {
                        
            setTimeout(() => {
                if (popUpShown) return;
                main()
            }, Number("1") * 1000);
            
                    }
                }
            })();
        
                    } else {
                        console.log('🚫 Campaign 6a3d24f9f3011983080c7093 blocked by display count limit');
                    }
                });
            