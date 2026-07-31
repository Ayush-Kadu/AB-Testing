/**
 * Script to patch the active lasttest campaign script file to include
 * the feedback submission API call when the submit button is clicked.
 * 
 * Campaign ID: 6a3a2e2b33a297dd051160e0
 * Client ID: 68b58625949a81fd08330b38
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config();

const CAMPAIGN_ID = '6a3a2e2b33a297dd051160e0';
const CLIENT_ID = '68b58625949a81fd08330b38';
const BASE_URL = process.env.BACKEND_URL;
const SCRIPT_FILE = path.join(__dirname, `../scripts/${CLIENT_ID}-${CAMPAIGN_ID}.js`);

// Read current script
let script = fs.readFileSync(SCRIPT_FILE, 'utf8');
console.log('Script length before patch:', script.length);

// We need to replace the feedback submit button click handler.
// In the current minified script, the handler for the submit button looks like:
// button_feedback_1781613029109_submit.addEventListener("click",async()=>{...increase-counter...completelyClosePopup()})
// 
// We need to inject the email-submission call before the increase-counter call.

const OLD_HANDLER = `button_feedback_1781613029109_submit.addEventListener("click",async()=>{const payload={campaignId:"6a3a2e2b33a297dd051160e0",buttonValue:button_feedback_1781613029109_submit.textContent,visitorId,visitId};await postData("increase-counter",payload),completelyClosePopup()})`;

const NEW_HANDLER = `button_feedback_1781613029109_submit.addEventListener("click",async()=>{
    // Collect form data from the popup
    const allInputs = container.querySelectorAll('input');
    const allTextareas = container.querySelectorAll('textarea');
    let email = '';
    let name = '';
    const feedbackData = {};
    allInputs.forEach(function(inp) {
        const val = inp.value.trim();
        const placeholder = (inp.placeholder || '').toLowerCase();
        if (inp.type === 'email' || placeholder.includes('email') || val.includes('@')) {
            email = val;
        } else if (placeholder.includes('name') || (inp.name || '').toLowerCase().includes('name')) {
            name = val;
        } else {
            feedbackData[inp.placeholder || inp.name || 'input'] = val;
        }
    });
    allTextareas.forEach(function(ta) {
        feedbackData[ta.placeholder || ta.name || 'feedback'] = ta.value.trim();
    });
    if (!email) {
        email = getCookie('email') || ('anonymous_feedback_' + visitorId + '@urlpt.com');
    }
    if (!name) {
        name = getCookie('fname') || '';
    }
    const emailPayload = {
        campaignId: '${CAMPAIGN_ID}',
        clientId: '{{USER_ID}}',
        email: email,
        name: name,
        visitorId: visitorId,
        visitId: visitId,
        campaignType: 'dynamic_template',
        campaignAction: 'feedback_submission',
        feedbackData: feedbackData
    };
    try {
        await fetch('${BASE_URL}/api/visitors/email-submission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload)
        });
        console.log('Feedback submitted successfully');
    } catch (err) {
        console.error('Error submitting feedback:', err);
    }
    const payload = {campaignId:"${CAMPAIGN_ID}",buttonValue:button_feedback_1781613029109_submit.textContent,visitorId,visitId};
    await postData("increase-counter",payload);
    completelyClosePopup();
})`.replace(/\n\s*/g, ' ').replace(/\s+/g, ' ');

if (script.includes(OLD_HANDLER)) {
    script = script.replace(OLD_HANDLER, NEW_HANDLER);
    fs.writeFileSync(SCRIPT_FILE, script, 'utf8');
    console.log('✅ Script patched successfully!');
    console.log('Script length after patch:', script.length);
} else {
    console.log('❌ Could not find the handler to replace. Looking for partial match...');
    // Try to find the handler with a partial search
    const partialSearch = 'button_feedback_1781613029109_submit.addEventListener';
    const idx = script.indexOf(partialSearch);
    if (idx >= 0) {
        console.log('Found at index:', idx);
        console.log('Context (200 chars):', script.substring(idx, idx + 200));
    } else {
        console.log('Could not find button_feedback_1781613029109_submit at all!');
        // Try alternate search
        const altSearch = 'feedback_1781613029109_submit';
        const altIdx = script.indexOf(altSearch);
        console.log('Alt search for feedback_1781613029109_submit at idx:', altIdx);
        if (altIdx >= 0) {
            console.log('Context around it:', script.substring(Math.max(0, altIdx - 50), altIdx + 300));
        }
    }
}
