const axios = require('axios');
require('dotenv').config();

// Meta credentials
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN || 'EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag';
const META_BUSINESS_ID = process.env.META_BUSINESS_ID || '933540033366513';
const API_VERSION = 'v24.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  token: {
    configured: !!META_SYSTEM_USER_TOKEN,
    length: META_SYSTEM_USER_TOKEN?.length || 0,
    preview: META_SYSTEM_USER_TOKEN ? META_SYSTEM_USER_TOKEN.substring(0, 15) + '...' : 'N/A'
  },
  tests: {}
};

// Utility function to make API calls
async function makeApiCall(method, endpoint, params = {}, headers = {}) {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      method,
      url,
      headers: {
        'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 30000 // 30 seconds
    };

    if (method === 'GET') {
      config.params = params;
    } else {
      config.data = params;
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || null,
      error: {
        message: error.message,
        code: error.response?.data?.error?.code,
        type: error.response?.data?.error?.type,
        error_subcode: error.response?.data?.error?.error_subcode,
        error_user_title: error.response?.data?.error?.error_user_title,
        error_user_msg: error.response?.data?.error?.error_user_msg,
        data: error.response?.data
      }
    };
  }
}

// Test 1: Token Validation - Get token info
async function testTokenValidation() {
  console.log('\n🔍 Test 1: Token Validation (/me)');
  console.log('─'.repeat(60));
  
  const result = await makeApiCall('GET', '/me', {
    fields: 'id,name,permissions'
  });

  testResults.tests.tokenValidation = {
    endpoint: '/me',
    ...result
  };

  if (result.success) {
    console.log('✅ Token is valid!');
    console.log(`   ID: ${result.data.id}`);
    console.log(`   Name: ${result.data.name || 'N/A'}`);
    if (result.data.permissions) {
      const permissions = Array.isArray(result.data.permissions) 
        ? result.data.permissions 
        : (result.data.permissions.data || []);
      console.log(`   Permissions: ${permissions.length} permissions`);
      if (permissions.length > 0) {
        const permList = permissions.map(p => 
          typeof p === 'string' ? p : (p.permission || p)
        ).join(', ');
        console.log(`   Permission list: ${permList}`);
      }
    } else {
      console.log(`   Permissions: Not available in response`);
    }
  } else {
    console.log('❌ Token validation failed!');
    console.log(`   Error: ${result.error.message}`);
    console.log(`   Code: ${result.error.code || 'N/A'}`);
    console.log(`   Type: ${result.error.type || 'N/A'}`);
  }

  return result.success;
}

// Test 2: Business Account Access
async function testBusinessAccount() {
  console.log('\n🔍 Test 2: Business Account Access');
  console.log('─'.repeat(60));
  
  const result = await makeApiCall('GET', `/${META_BUSINESS_ID}`, {
    fields: 'id,name'
  });

  testResults.tests.businessAccount = {
    endpoint: `/${META_BUSINESS_ID}`,
    ...result
  };

  if (result.success) {
    console.log('✅ Business Account accessible!');
    console.log(`   ID: ${result.data.id}`);
    console.log(`   Name: ${result.data.name || 'N/A'}`);
  } else {
    console.log('❌ Business Account access failed!');
    console.log(`   Error: ${result.error.message}`);
    console.log(`   Code: ${result.error.code || 'N/A'}`);
  }

  return result.success;
}

// Test 3: Fetch WABA Accounts (Standard Endpoint)
async function testFetchWABAsStandard() {
  console.log('\n🔍 Test 3: Fetch WABA Accounts (Standard Endpoint)');
  console.log('─'.repeat(60));
  
  const result = await makeApiCall('GET', `/${META_BUSINESS_ID}/whatsapp_business_accounts`, {
    fields: 'id,name,account_review_status,message_template_namespace,ownership_type,primary_funding_id,timezone_id,currency,status,business_verification_status',
    limit: 100
  });

  testResults.tests.fetchWABAsStandard = {
    endpoint: `/${META_BUSINESS_ID}/whatsapp_business_accounts`,
    ...result
  };

  if (result.success) {
    const wabas = result.data.data || [];
    console.log(`✅ Successfully fetched ${wabas.length} WABA(s)!`);
    
    if (wabas.length > 0) {
      console.log('\n   WABA Details:');
      wabas.forEach((waba, index) => {
        console.log(`   ${index + 1}. ID: ${waba.id}`);
        console.log(`      Name: ${waba.name || 'N/A'}`);
        console.log(`      Status: ${waba.status || 'N/A'}`);
        console.log(`      Review Status: ${waba.account_review_status || 'N/A'}`);
        console.log(`      Currency: ${waba.currency || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️  No WABAs found');
    }

    if (result.data.paging?.next) {
      console.log('   📄 Pagination available (more WABAs may exist)');
    }
  } else {
    console.log('❌ Failed to fetch WABAs from standard endpoint!');
    console.log(`   Error: ${result.error.message}`);
    console.log(`   Code: ${result.error.code || 'N/A'}`);
    console.log(`   Type: ${result.error.type || 'N/A'}`);
  }

  return result.success ? (result.data.data || []) : [];
}

// Test 4: Fetch WABA Accounts (Client Endpoint - Fallback)
async function testFetchWABAsClient() {
  console.log('\n🔍 Test 4: Fetch WABA Accounts (Client Endpoint - Fallback)');
  console.log('─'.repeat(60));
  
  const result = await makeApiCall('GET', `/${META_BUSINESS_ID}/client_whatsapp_business_accounts`, {
    fields: 'id,name,account_review_status,status',
    limit: 100
  });

  testResults.tests.fetchWABAsClient = {
    endpoint: `/${META_BUSINESS_ID}/client_whatsapp_business_accounts`,
    ...result
  };

  if (result.success) {
    const wabas = result.data.data || [];
    console.log(`✅ Successfully fetched ${wabas.length} WABA(s) from client endpoint!`);
    
    if (wabas.length > 0) {
      wabas.slice(0, 5).forEach((waba, index) => {
        console.log(`   ${index + 1}. ID: ${waba.id}, Name: ${waba.name || 'N/A'}`);
      });
      if (wabas.length > 5) {
        console.log(`   ... and ${wabas.length - 5} more`);
      }
    }
  } else {
    console.log('❌ Failed to fetch WABAs from client endpoint!');
    console.log(`   Error: ${result.error.message}`);
    console.log(`   Code: ${result.error.code || 'N/A'}`);
  }

  return result.success ? (result.data.data || []) : [];
}

// Test 5: Fetch Phone Numbers for a WABA
async function testFetchPhoneNumbers(wabaId) {
  console.log(`\n🔍 Test 5: Fetch Phone Numbers for WABA ${wabaId}`);
  console.log('─'.repeat(60));
  
  const result = await makeApiCall('GET', `/${wabaId}/phone_numbers`, {
    fields: 'id,display_phone_number,verified_name,quality_rating,status,code_verification_status',
    limit: 100
  });

  testResults.tests.fetchPhoneNumbers = testResults.tests.fetchPhoneNumbers || [];
  testResults.tests.fetchPhoneNumbers.push({
    wabaId,
    endpoint: `/${wabaId}/phone_numbers`,
    ...result
  });

  if (result.success) {
    const phones = result.data.data || [];
    console.log(`✅ Successfully fetched ${phones.length} phone number(s)!`);
    
    if (phones.length > 0) {
      console.log('\n   Phone Number Details:');
      phones.slice(0, 5).forEach((phone, index) => {
        console.log(`   ${index + 1}. ID: ${phone.id}`);
        console.log(`      Display: ${phone.display_phone_number || 'N/A'}`);
        console.log(`      Verified Name: ${phone.verified_name || phone.name || 'N/A'}`);
        console.log(`      Status: ${phone.status || 'N/A'}`);
        console.log(`      Quality Rating: ${phone.quality_rating || 'N/A'}`);
      });
      if (phones.length > 5) {
        console.log(`   ... and ${phones.length - 5} more`);
      }
    } else {
      console.log('   ⚠️  No phone numbers found for this WABA');
    }

    return phones;
  } else {
    console.log('❌ Failed to fetch phone numbers!');
    console.log(`   Error: ${result.error.message}`);
    console.log(`   Code: ${result.error.code || 'N/A'}`);
    return [];
  }
}

// Test 6: Fetch Phone Number Details
async function testFetchPhoneDetails(phoneNumberId) {
  console.log(`\n🔍 Test 6: Fetch Phone Number Details for ${phoneNumberId}`);
  console.log('─'.repeat(60));
  
  const result = await makeApiCall('GET', `/${phoneNumberId}`, {
    fields: 'id,display_phone_number,verified_name,quality_rating,status,code_verification_status'
  });

  testResults.tests.fetchPhoneDetails = testResults.tests.fetchPhoneDetails || [];
  testResults.tests.fetchPhoneDetails.push({
    phoneNumberId,
    endpoint: `/${phoneNumberId}`,
    ...result
  });

  if (result.success) {
    console.log('✅ Successfully fetched phone number details!');
    console.log(`   ID: ${result.data.id}`);
    console.log(`   Display: ${result.data.display_phone_number || 'N/A'}`);
    console.log(`   Verified Name: ${result.data.verified_name || result.data.name || 'N/A'}`);
    console.log(`   Status: ${result.data.status || 'N/A'}`);
    console.log(`   Quality Rating: ${result.data.quality_rating || 'N/A'}`);
    return result.data;
  } else {
    console.log('❌ Failed to fetch phone number details!');
    console.log(`   Error: ${result.error.message}`);
    console.log(`   Code: ${result.error.code || 'N/A'}`);
    return null;
  }
}

// Test 7: Fetch Message Templates
async function testFetchMessageTemplates(wabaId, phoneNumberId) {
  console.log(`\n🔍 Test 7: Fetch Message Templates for WABA ${wabaId}`);
  console.log('─'.repeat(60));
  
  // Message templates should be fetched from WABA, not phone number
  const result = await makeApiCall('GET', `/${wabaId}/message_templates`, {
    limit: 10
  });

  testResults.tests.fetchMessageTemplates = testResults.tests.fetchMessageTemplates || [];
  testResults.tests.fetchMessageTemplates.push({
    wabaId,
    phoneNumberId,
    endpoint: `/${wabaId}/message_templates`,
    ...result
  });

  if (result.success) {
    const templates = result.data.data || [];
    console.log(`✅ Successfully fetched ${templates.length} message template(s)!`);
    
    if (templates.length > 0) {
      templates.slice(0, 3).forEach((template, index) => {
        console.log(`   ${index + 1}. Name: ${template.name || 'N/A'}`);
        console.log(`      Status: ${template.status || 'N/A'}`);
        console.log(`      Category: ${template.category || 'N/A'}`);
      });
      if (templates.length > 3) {
        console.log(`   ... and ${templates.length - 3} more`);
      }
    } else {
      console.log('   ⚠️  No message templates found');
    }

    return templates;
  } else {
    console.log('❌ Failed to fetch message templates!');
    console.log(`   Error: ${result.error.message}`);
    console.log(`   Code: ${result.error.code || 'N/A'}`);
    return [];
  }
}

// Main test runner
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Meta Graph API Comprehensive Test Suite                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📅 Test started at: ${testResults.timestamp}`);
  console.log(`🔑 Token: ${testResults.token.configured ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`📏 Token Length: ${testResults.token.length}`);
  console.log(`🔤 Token Preview: ${testResults.token.preview}`);
  console.log(`🏢 Business ID: ${META_BUSINESS_ID}`);

  // Test 1: Token Validation
  const tokenValid = await testTokenValidation();
  if (!tokenValid) {
    console.log('\n❌ Token validation failed. Stopping tests.');
    return testResults;
  }

  // Test 2: Business Account
  await testBusinessAccount();

  // Test 3: Fetch WABAs (Standard)
  const wabasStandard = await testFetchWABAsStandard();
  
  // Test 4: Fetch WABAs (Client - if standard failed)
  let wabas = wabasStandard;
  if (wabas.length === 0) {
    console.log('\n⚠️  No WABAs from standard endpoint, trying client endpoint...');
    wabas = await testFetchWABAsClient();
  }

  // Test 5-7: For each WABA, test phone numbers, details, and templates
  if (wabas.length > 0) {
    console.log(`\n\n📱 Testing Phone Numbers for ${wabas.length} WABA(s)...`);
    
    for (const waba of wabas.slice(0, 3)) { // Limit to first 3 WABAs to avoid timeout
      const phones = await testFetchPhoneNumbers(waba.id);
      
      // Test phone details for each phone
      if (phones.length > 0) {
        for (const phone of phones.slice(0, 2)) { // Limit to first 2 phones per WABA
          await testFetchPhoneDetails(phone.id);
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Test message templates once per WABA (not per phone)
        await testFetchMessageTemplates(waba.id, phones[0]?.id);
      }
      
      // Add delay between WABAs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } else {
    console.log('\n⚠️  No WABAs found. Skipping phone number and template tests.');
  }

  // Summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const totalTests = Object.keys(testResults.tests).length;
  const passedTests = Object.values(testResults.tests).filter(test => {
    if (Array.isArray(test)) {
      return test.some(t => t.success);
    }
    return test.success;
  }).length;

  console.log(`\n✅ Passed: ${passedTests}/${totalTests} test groups`);
  console.log(`📊 Total API Calls: ${Object.values(testResults.tests).reduce((sum, test) => {
    if (Array.isArray(test)) return sum + test.length;
    return sum + 1;
  }, 0)}`);
  
  console.log('\n📄 Detailed results saved in testResults object');
  console.log(`\n⏰ Test completed at: ${new Date().toISOString()}`);

  return testResults;
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests()
    .then((results) => {
      // Optionally save results to file
      const fs = require('fs');
      const path = require('path');
      const resultsPath = path.join(__dirname, 'meta-api-test-results.json');
      fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
      console.log(`\n💾 Detailed results saved to: ${resultsPath}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fatal error running tests:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests };

