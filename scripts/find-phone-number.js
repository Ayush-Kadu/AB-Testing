const axios = require('axios');
require('dotenv').config();

// Meta credentials
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN || 'EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag';
const API_VERSION = 'v24.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Configuration - can be passed as command line arguments
let WABA_ID = process.argv[2] || '638683979331861';
let TARGET_PHONE = process.argv[3] || '+91 80939 34217';

/**
 * Find phone number details by display number
 */
async function findPhoneNumber(wabaId, displayNumber) {
  try {
    console.log(`\n🔍 Searching for phone number: ${displayNumber}`);
    console.log(`📱 WABA ID: ${wabaId}`);
    
    const response = await axios.get(
      `${BASE_URL}/${wabaId}/phone_numbers`,
      {
        headers: {
          'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        params: {
          fields: 'id,display_phone_number,verified_name,quality_rating,status,code_verification_status'
        }
      }
    );
    
    const phoneNumbers = response.data?.data || [];
    console.log(`\n📋 Found ${phoneNumbers.length} phone number(s) in WABA:`);
    
    phoneNumbers.forEach((phone, index) => {
      console.log(`\n   ${index + 1}. Phone Number ID: ${phone.id}`);
      console.log(`      Display: ${phone.display_phone_number}`);
      console.log(`      Verified Name: ${phone.verified_name || 'N/A'}`);
      console.log(`      Status: ${phone.status || 'N/A'}`);
      console.log(`      Quality Rating: ${phone.quality_rating || 'N/A'}`);
      console.log(`      Code Verification: ${phone.code_verification_status || 'N/A'}`);
    });
    
    // Find the matching phone number
    const matchingPhone = phoneNumbers.find(
      phone => phone.display_phone_number === displayNumber || 
               phone.display_phone_number === displayNumber.replace(/\s/g, '') ||
               phone.display_phone_number === displayNumber.replace(/\s/g, '').replace('+', '')
    );
    
    if (matchingPhone) {
      console.log(`\n✅ Found matching phone number!`);
      console.log(`\n📄 Phone Number Details:`);
      console.log(`   Phone Number ID: ${matchingPhone.id}`);
      console.log(`   Display Number: ${matchingPhone.display_phone_number}`);
      console.log(`   Verified Name: ${matchingPhone.verified_name || 'N/A'}`);
      console.log(`   Status: ${matchingPhone.status || 'N/A'}`);
      console.log(`   Quality Rating: ${matchingPhone.quality_rating || 'N/A'}`);
      console.log(`   Code Verification: ${matchingPhone.code_verification_status || 'N/A'}`);
      
      console.log(`\n📝 To delete this phone number:`);
      console.log(`   1. Go to Meta Business Manager: https://business.facebook.com/wa/manage/`);
      console.log(`   2. Select WABA ID: ${wabaId}`);
      console.log(`   3. Go to Phone Numbers section`);
      console.log(`   4. Find and delete: ${matchingPhone.display_phone_number}`);
      console.log(`\n   ⚠️  Note: Phone numbers cannot be deleted via API. Manual deletion required.`);
      
      return matchingPhone;
    } else {
      console.log(`\n❌ Phone number "${displayNumber}" not found in WABA ${wabaId}`);
      return null;
    }
  } catch (error) {
    console.error('\n❌ Error fetching phone numbers:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Find Phone Number in WABA                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  console.log(`\nUsage: node find-phone-number.js [WABA_ID] [PHONE_NUMBER]`);
  console.log(`\nCurrent configuration:`);
  console.log(`   WABA ID: ${WABA_ID}`);
  console.log(`   Phone Number: ${TARGET_PHONE}`);
  
  try {
    await findPhoneNumber(WABA_ID, TARGET_PHONE);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { findPhoneNumber };

