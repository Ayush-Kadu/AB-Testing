const axios = require('axios');
require('dotenv').config();

const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN || 'EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag';
const META_WABA_ID = process.env.META_WABA_ID;
const META_BUSINESS_ID = process.env.META_BUSINESS_ID || '933540033366513';

async function checkWABA() {
  console.log('🔍 Checking META_WABA_ID from .env file...\n');
  console.log('═'.repeat(60));
  
  if (!META_WABA_ID) {
    console.log('⚠️  META_WABA_ID is not set in .env file');
    console.log('   This is OK if you\'re not using it in code');
    return;
  }
  
  console.log(`📋 META_WABA_ID from .env: ${META_WABA_ID}\n`);
  
  // First, get all accessible WABAs
  console.log('📋 Step 1: Getting all accessible WABAs...');
  try {
    const wabaResponse = await axios.get(
      `https://graph.facebook.com/v24.0/${META_BUSINESS_ID}/client_whatsapp_business_accounts`,
      {
        headers: {
          'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        params: {
          fields: 'id,name',
          limit: 100
        },
        timeout: 30000
      }
    );
    
    const wabas = wabaResponse.data?.data || [];
    console.log(`✅ Found ${wabas.length} accessible WABA(s):`);
    wabas.forEach((waba, index) => {
      const isMatch = waba.id === META_WABA_ID;
      const marker = isMatch ? ' ⭐ MATCHES META_WABA_ID' : '';
      console.log(`   ${index + 1}. ID: ${waba.id}, Name: ${waba.name || 'N/A'}${marker}`);
    });
    
    // Check if META_WABA_ID is in the list
    const foundWABA = wabas.find(w => w.id === META_WABA_ID);
    if (!foundWABA) {
      console.log(`\n❌ PROBLEM: META_WABA_ID (${META_WABA_ID}) is NOT in the list of accessible WABAs!`);
      console.log('   This WABA ID is either:');
      console.log('   - From a different business account');
      console.log('   - From Syncspace app (not accessible with URLPT token)');
      console.log('   - Invalid/non-existent');
      console.log('   - Or the token doesn\'t have access to it');
    } else {
      console.log(`\n✅ META_WABA_ID (${META_WABA_ID}) is accessible and matches: ${foundWABA.name || 'N/A'}`);
    }
    
    // Try to access the WABA directly
    console.log(`\n📋 Step 2: Testing direct access to META_WABA_ID (${META_WABA_ID})...`);
    try {
      const directResponse = await axios.get(
        `https://graph.facebook.com/v24.0/${META_WABA_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
            'Content-Type': 'application/json'
          },
          params: {
            fields: 'id,name,account_review_status,status'
          },
          timeout: 30000
        }
      );
      
      console.log('✅ Direct access successful:');
      console.log(`   ID: ${directResponse.data.id}`);
      console.log(`   Name: ${directResponse.data.name || 'N/A'}`);
      console.log(`   Status: ${directResponse.data.status || 'N/A'}`);
      console.log(`   Review Status: ${directResponse.data.account_review_status || 'N/A'}`);
      
    } catch (directError) {
      console.log('❌ Direct access failed:');
      const errorData = directError.response?.data?.error || {};
      console.log(`   Error Code: ${errorData.code || 'N/A'}`);
      console.log(`   Error Type: ${errorData.type || 'N/A'}`);
      console.log(`   Error Message: ${errorData.message || directError.message}`);
      
      if (errorData.code === 100) {
        console.log('\n⚠️  Error 100 typically means:');
        console.log('   - Object does not exist');
        console.log('   - Cannot be loaded due to missing permissions');
        console.log('   - Does not support this operation');
        console.log('   This confirms META_WABA_ID is not accessible with this token!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking WABAs:', error.response?.data || error.message);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('\n📝 Summary:');
  console.log('   - Check if META_WABA_ID matches any accessible WABA');
  console.log('   - If not, remove it from .env or update to a valid WABA ID');
  console.log('   - URLPT-specific WABAs found:');
  console.log('     • 638683979331861 (Prince Sachdeva)');
  console.log('     • 856684160402997 (Visitor Tracker - URLPT)');
}

checkWABA();

