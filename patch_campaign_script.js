/**
 * Patches the active campaign script for 'lasttest' to include
 * the feedback submission API call when the submit button is clicked.
 */

const path = require('path');
const fs = require('fs');

const CAMPAIGN_ID = '6a3a2e2b33a297dd051160e0';
const CLIENT_ID = '68b58625949a81fd08330b38';
const BASE_URL = 'http://localhost:5008';
const SCRIPT_FILE = path.join(__dirname, `src/scripts/${CLIENT_ID}-${CAMPAIGN_ID}.js`);

let script = fs.readFileSync(SCRIPT_FILE, 'utf8');
console.log('Script length before patch:', script.length);

// Exact old handler from the minified script
const OLD_HANDLER = `button_feedback_1781613029109_submit.addEventListener("click",async()=>{const payload={campaignId:"6a3a2e2b33a297dd051160e0",buttonValue:button_feedback_1781613029109_submit.textContent,visitorId,visitId};await postData("increase-counter",payload),completelyClosePopup()})`;

// New handler with feedback submission API call
const NEW_HANDLER = `button_feedback_1781613029109_submit.addEventListener("click",async()=>{const allInputs=container.querySelectorAll("input");const allTextareas=container.querySelectorAll("textarea");let email="";let name="";const feedbackData={};allInputs.forEach(function(inp){const val=inp.value.trim();const placeholder=(inp.placeholder||"").toLowerCase();if(inp.type==="email"||placeholder.includes("email")||val.includes("@")){email=val;}else if(placeholder.includes("name")||(inp.name||"").toLowerCase().includes("name")){name=val;}else{feedbackData[inp.placeholder||inp.name||"input"]=val;}});allTextareas.forEach(function(ta){feedbackData[ta.placeholder||ta.name||"feedback"]=ta.value.trim();});if(!email){email=getCookie("email")||("anonymous_feedback_"+visitorId+"@urlpt.com");}if(!name){name=getCookie("fname")||"";}const emailPayload={campaignId:"${CAMPAIGN_ID}",clientId:"{{USER_ID}}",email:email,name:name,visitorId:visitorId,visitId:visitId,campaignType:"dynamic_template",campaignAction:"feedback_submission",feedbackData:feedbackData};try{await fetch("${BASE_URL}/api/visitors/email-submission",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(emailPayload)});console.log("Feedback submitted successfully");}catch(err){console.error("Error submitting feedback:",err);}const payload={campaignId:"${CAMPAIGN_ID}",buttonValue:button_feedback_1781613029109_submit.textContent,visitorId:visitorId,visitId:visitId};await postData("increase-counter",payload);completelyClosePopup();})`;

if (script.includes(OLD_HANDLER)) {
    script = script.replace(OLD_HANDLER, NEW_HANDLER);
    fs.writeFileSync(SCRIPT_FILE, script, 'utf8');
    console.log('✅ Script patched successfully!');
    console.log('Script length after patch:', script.length);
} else {
    console.log('❌ Could not find the exact handler to replace.');
    console.log('Searching for the listener...');
    const idx = script.indexOf('button_feedback_1781613029109_submit.addEventListener');
    if (idx >= 0) {
        console.log('Found at index:', idx);
        console.log('Context:', script.substring(idx, idx + 300));
    }
}
