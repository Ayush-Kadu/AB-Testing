const axios = require('axios');
require('dotenv').config();

// Meta credentials - Use environment variable or provide token here
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN || 'EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag';
const API_VERSION = 'v24.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Configuration
const WABA_ID = '638683979331861';
const TARGET_PHONE_NUMBER = '+91 80939 34217'; // The display phone number to delete

/**
 * Find phone number ID by display number
 */
async function findPhoneNumberId(wabaId, displayNumber) {
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
          fields: 'id,display_phone_number,verified_name,status'
        }
      }
    );
    
    const phoneNumbers = response.data?.data || [];
    console.log(`\n📋 Found ${phoneNumbers.length} phone number(s) in WABA:`);
    
    phoneNumbers.forEach((phone, index) => {
      console.log(`   ${index + 1}. ID: ${phone.id}`);
      console.log(`      Display: ${phone.display_phone_number}`);
      console.log(`      Verified Name: ${phone.verified_name || 'N/A'}`);
      console.log(`      Status: ${phone.status || 'N/A'}`);
    });
    
    // Find the matching phone number
    const matchingPhone = phoneNumbers.find(
      phone => phone.display_phone_number === displayNumber || 
               phone.display_phone_number === displayNumber.replace(/\s/g, '') ||
               phone.display_phone_number === displayNumber.replace(/\s/g, '').replace('+', '')
    );
    
    if (matchingPhone) {
      console.log(`\n✅ Found matching phone number!`);
      console.log(`   Phone Number ID: ${matchingPhone.id}`);
      return matchingPhone.id;
    } else {
      console.log(`\n❌ Phone number "${displayNumber}" not found in WABA ${wabaId}`);
      console.log(`\nAvailable phone numbers:`);
      phoneNumbers.forEach(phone => {
        console.log(`   - ${phone.display_phone_number} (ID: ${phone.id})`);
      });
      return null;
    }
  } catch (error) {
    console.error('\n❌ Error fetching phone numbers:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Delete phone number by ID
 */
async function deletePhoneNumber(phoneNumberId) {
  try {
    console.log(`\n🗑️  Deleting phone number ID: ${phoneNumberId}`);
    
    const response = await axios.delete(
      `${BASE_URL}/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`\n✅ Phone number deleted successfully!`);
    console.log(`   Response:`, response.data || 'OK');
    
    return true;
  } catch (error) {
    console.error('\n❌ Error deleting phone number:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.error(`   Error Code: ${error.response.data.error?.code || 'N/A'}`);
      console.error(`   Error Type: ${error.response.data.error?.type || 'N/A'}`);
      console.error(`   Error Message: ${error.response.data.error?.message || 'N/A'}`);
    }
    
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Delete Phone Number from WABA                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n📅 Started at: ${new Date().toISOString()}`);
  console.log(`🔑 Token: ${META_SYSTEM_USER_TOKEN ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log(`📱 Target Phone: ${TARGET_PHONE_NUMBER}`);
  console.log(`🏢 WABA ID: ${WABA_ID}`);
  
  try {
    // Step 1: Find the phone number ID
    const phoneNumberId = await findPhoneNumberId(WABA_ID, TARGET_PHONE_NUMBER);
    
    if (!phoneNumberId) {
      console.log('\n❌ Cannot proceed: Phone number ID not found');
      process.exit(1);
    }
    
    // Step 2: Confirm deletion
    console.log(`\n⚠️  WARNING: This will permanently delete the phone number!`);
    console.log(`   Phone Number ID: ${phoneNumberId}`);
    console.log(`   Display Number: ${TARGET_PHONE_NUMBER}`);
    console.log(`   WABA ID: ${WABA_ID}`);
    
    // For script execution, we'll proceed (remove this in production or add confirmation prompt)
    console.log(`\n🔄 Proceeding with deletion...`);
    
    // Step 3: Delete the phone number
    const deleted = await deletePhoneNumber(phoneNumberId);
    
    if (deleted) {
      console.log(`\n╔════════════════════════════════════════════════════════════╗`);
      console.log(`║              ✅ Deletion Successful                          ║`);
      console.log(`╚════════════════════════════════════════════════════════════╝`);
      console.log(`\n📞 Phone number ${TARGET_PHONE_NUMBER} has been deleted from WABA ${WABA_ID}`);
      console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  // You can also pass phone number and WABA ID as command line arguments
  const args = process.argv.slice(2);
  
  if (args.length >= 2) {
    const [wabaId, phoneNumber] = args;
    // Update globals if provided
    WABA_ID = wabaId;
    TARGET_PHONE_NUMBER = phoneNumber;
    console.log(`\n📝 Using provided values:`);
    console.log(`   WABA ID: ${WABA_ID}`);
    console.log(`   Phone Number: ${TARGET_PHONE_NUMBER}`);
  }
  
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { findPhoneNumberId, deletePhoneNumber };

