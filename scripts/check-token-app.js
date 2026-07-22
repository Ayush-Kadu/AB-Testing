const axios = require('axios');

const TOKEN = process.argv[2] || 'EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag';

const URLPT_APP_ID = '756959090659170';
const SYNCSPACE_APP_ID = '31374122698901890';
const META_BUSINESS_ID = '933540033366513';

async function checkTokenApp() {
  console.log('🔍 Checking which app this token belongs to...\n');
  console.log('═'.repeat(60));
  
  try {
    // Step 1: Get token info (system user info)
    console.log('\n📋 Step 1: Getting token owner information...');
    const meResponse = await axios.get('https://graph.facebook.com/v24.0/me', {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      },
      params: {
        fields: 'id,name,permissions'
      }
    });
    
    console.log('✅ Token Owner Info:');
    console.log(`   ID: ${meResponse.data.id}`);
    console.log(`   Name: ${meResponse.data.name}`);
    console.log(`   Permissions: ${meResponse.data.permissions?.data?.length || 0} granted`);
    
    // Step 2: Try to get app information using token debug endpoint
    console.log('\n📋 Step 2: Getting app information from token...');
    try {
      const debugResponse = await axios.get('https://graph.facebook.com/v24.0/debug_token', {
        params: {
          input_token: TOKEN,
          access_token: TOKEN
        }
      });
      
      const tokenData = debugResponse.data.data;
      console.log('✅ Token Debug Info:');
      console.log(`   App ID: ${tokenData.app_id || 'N/A'}`);
      console.log(`   User ID: ${tokenData.user_id || 'N/A'}`);
      console.log(`   Type: ${tokenData.type || 'N/A'}`);
      console.log(`   Valid: ${tokenData.is_valid}`);
      console.log(`   Expires At: ${tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : 'Never'}`);
      
      const appId = tokenData.app_id;
      if (appId === URLPT_APP_ID) {
        console.log('\n✅ RESULT: This token belongs to URLPT APP (756959090659170)');
      } else if (appId === SYNCSPACE_APP_ID) {
        console.log('\n⚠️  RESULT: This token belongs to SYNCSPACE APP (31374122698901890)');
      } else {
        console.log(`\n❓ RESULT: This token belongs to UNKNOWN APP (${appId})`);
      }
    } catch (debugError) {
      console.log('❌ Could not get app info from debug_token endpoint');
      console.log(`   Error: ${debugError.response?.data?.error?.message || debugError.message}`);
    }
    
    // Step 3: Test access to business accounts
    console.log('\n📋 Step 3: Testing access to business accounts...');
    
    // Test URLPT business account context
    try {
      const urlptBusinessTest = await axios.get(`https://graph.facebook.com/v24.0/${META_BUSINESS_ID}`, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        },
        params: {
          fields: 'id,name'
        }
      });
      
      console.log('✅ Access to Parent Business Account (Nians):');
      console.log(`   ID: ${urlptBusinessTest.data.id}`);
      console.log(`   Name: ${urlptBusinessTest.data.name}`);
    } catch (error) {
      console.log('❌ Cannot access Parent Business Account:');
      console.log(`   Error: ${error.response?.data?.error?.message || error.message}`);
    }
    
    // Test Syncspace business account
    try {
      const syncspaceBusinessTest = await axios.get('https://graph.facebook.com/v24.0/1355930519871142', {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        },
        params: {
          fields: 'id,name'
        }
      });
      
      console.log('\n✅ Access to Syncspace Business Account:');
      console.log(`   ID: ${syncspaceBusinessTest.data.id}`);
      console.log(`   Name: ${syncspaceBusinessTest.data.name}`);
    } catch (error) {
      console.log('\n❌ Cannot access Syncspace Business Account:');
      console.log(`   Error: ${error.response?.data?.error?.message || error.message}`);
    }
    
    // Step 4: Check which WABAs are accessible
    console.log('\n📋 Step 4: Checking accessible WABAs...');
    try {
      const wabaResponse = await axios.get(`https://graph.facebook.com/v24.0/${META_BUSINESS_ID}/client_whatsapp_business_accounts`, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`
        },
        params: {
          fields: 'id,name',
          limit: 10
        }
      });
      
      const wabas = wabaResponse.data?.data || [];
      console.log(`✅ Found ${wabas.length} WABA(s):`);
      wabas.forEach((waba, index) => {
        console.log(`   ${index + 1}. ID: ${waba.id}, Name: ${waba.name || 'N/A'}`);
      });
    } catch (error) {
      console.log('❌ Cannot access WABAs:');
      console.log(`   Error: ${error.response?.data?.error?.message || error.message}`);
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('\n📝 Summary:');
    console.log('   - Check the "App ID" in Step 2 to determine which app owns this token');
    console.log('   - If App ID matches URLPT_APP (756959090659170), token is correct');
    console.log('   - If App ID matches SYNCSPACE (31374122698901890), you need a new token from URLPT app');
    
  } catch (error) {
    console.error('❌ Error checking token:', error.response?.data || error.message);
    process.exit(1);
  }
}

checkTokenApp();

