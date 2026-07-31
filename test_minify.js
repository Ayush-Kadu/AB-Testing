const terser = require('terser');
const fs = require('fs');

async function testMinify() {
    const content = fs.readFileSync('e:/URLPT/urlpt-console/src/components/Campaigndesign/Templates/OnsiteAction/LightBoxPopup/Offer.tsx', 'utf8');
    const match = content.match(/const scriptData = \`([\s\S]*?)\`;/);
    if (!match) {
        console.log("No scriptData found");
        return;
    }
    
    let rawScript = match[1];
    
    // Evaluate the template literal with mock variables
    rawScript = rawScript.replace(/\$\{baseURL\}/g, "https://urlpt-api.onrender.comender.com");
    rawScript = rawScript.replace(/\$\{currentTemplate\._id\}/g, "mock_id");
    
    // Evaluate JSON.stringify properly. In JS, JSON.stringify("hello") is '"hello"'.
    // The previous replace replaced all JSON.stringify logic with just "Mock Value"
    // Wait, replacing it using regex is tricky, let's just replace all JSON.stringify blocks with '"Mock"'
    rawScript = rawScript.replace(/\$\{JSON\.stringify\([^\|]+\s*\|\|\s*\"\"\)\}/g, '"Mock"');
    
    // Remove other interpolations
    rawScript = rawScript.replace(/\$\{content\.[^}]+\}/g, 'mock');
    rawScript = rawScript.replace(/\$\{styles\.[^}]+\}/g, 'mock');
    
    const fullContent = `
        async function checkDisplayCountLimit() { return true; }
        checkDisplayCountLimit().then(canShow => {
            if (canShow) {
                ${rawScript}
            }
        });
    `;
    
    console.log("Full Content:", fullContent.substring(0, 500) + "...");
    const minified = await terser.minify(fullContent, {
        ecma: 2020,
        compress: { drop_debugger: true },
        mangle: false
    });
    
    if (minified.error) {
        console.error("Minification Error:", minified.error);
    } else {
        console.log("Minification Success. Length:", minified.code.length);
    }
}

testMinify();
