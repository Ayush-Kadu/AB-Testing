/**
 * Register Phone Number with Meta WhatsApp API
 * 
 * This script registers a phone number with backup and PIN settings
 * 
 * Usage:
 * node scripts/register-phone-number.js
 * 
 * Or with custom values:
 * PHONE_NUMBER_ID=968822482972218 PIN=123456 BACKUP_PASSWORD=demoacc100 node scripts/register-phone-number.js
 */

const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

// Phone number details - can be overridden via environment variables
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '968822482972218'; // Phone number ID for +919217754763
const PIN = process.env.PIN || '123456';
const BACKUP_PASSWORD = process.env.BACKUP_PASSWORD || 'demoacc100';
const BACKUP_DATA = process.env.BACKUP_DATA || 'BACKUP_DATA'; // Replace with actual backup data if available
const META_SYSTEM_USER_TOKEN = process.env.META_SYSTEM_USER_TOKEN || 'EAAKwc0W1T2IBQa2bRSCsS4iM9cSYFLuBFzjZCZBjM6dClG5MIlBBYJkEbHKLNPmGSJYqfepCv2212CAaoZCXfevnuLT2ke7HURGUMu4ZA1G0f6PUszoQ80xwLfs2ZAokbpVKq1DOn5n6mq0j1KPkgYDSvsCJgy3lIBCUC3u5D42A9wgwSwSnB0LfwR0oE7QAfYZAElTnXw4zAvtT1YGYugwCBPuVh7rrbmUIag';
const API_VERSION = 'v22.0';

async function getPhoneNumberDetails() {
  try {
    console.log('🔍 [REGISTER_PHONE] Checking phone number details...');
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}`;
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`
      },
      params: {
        fields: 'id,display_phone_number,verified_name,status,code_verification_status'
      },
      timeout: 30000
    });
    
    console.log('✅ [REGISTER_PHONE] Phone number details:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.warn('⚠️ [REGISTER_PHONE] Could not fetch phone number details:', error.message);
    return null;
  }
}

async function waitForConnectedStatus(maxWaitSeconds = 60) {
  console.log(`⏳ [REGISTER_PHONE] Waiting for phone number to become CONNECTED (max ${maxWaitSeconds}s)...`);
  const startTime = Date.now();
  const checkInterval = 3000; // Check every 3 seconds
  
  while (Date.now() - startTime < maxWaitSeconds * 1000) {
    const phoneDetails = await getPhoneNumberDetails();
    if (phoneDetails && phoneDetails.status === 'CONNECTED') {
      console.log('✅ [REGISTER_PHONE] Phone number is now CONNECTED!');
      return true;
    }
    console.log(`⏳ [REGISTER_PHONE] Status: ${phoneDetails?.status || 'UNKNOWN'}, waiting...`);
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.log(`⚠️ [REGISTER_PHONE] Phone number did not become CONNECTED within ${maxWaitSeconds} seconds`);
  return false;
}

async function registerPhoneNumber() {
  try {
    console.log('📞 [REGISTER_PHONE] ===== Starting Phone Number Registration =====');
    console.log('📞 [REGISTER_PHONE] Phone Number ID:', PHONE_NUMBER_ID);
    console.log('📞 [REGISTER_PHONE] PIN:', PIN);
    console.log('📞 [REGISTER_PHONE] Backup Password:', BACKUP_PASSWORD);
    console.log('📞 [REGISTER_PHONE] Backup Data:', BACKUP_DATA === 'BACKUP_DATA' ? 'BACKUP_DATA (placeholder - may need actual value)' : 'Provided');
    
    // First, check phone number status
    let phoneDetails = await getPhoneNumberDetails();
    if (phoneDetails) {
      console.log('📞 [REGISTER_PHONE] Current Status:', phoneDetails.status);
      console.log('📞 [REGISTER_PHONE] Code Verification:', phoneDetails.code_verification_status);
    }
    
    // If status is PENDING, wait for it to become CONNECTED
    if (phoneDetails && phoneDetails.status === 'PENDING') {
      console.log('⚠️ [REGISTER_PHONE] Phone number status is PENDING');
      console.log('⚠️ [REGISTER_PHONE] Waiting for status to change to CONNECTED before registration...');
      
      const becameConnected = await waitForConnectedStatus(60);
      
      if (!becameConnected) {
        console.log('⚠️ [REGISTER_PHONE] Phone number is still PENDING. Attempting registration anyway...');
        console.log('⚠️ [REGISTER_PHONE] Note: Registration may fail if phone is not fully connected');
      } else {
        // Re-fetch phone details after status change
        phoneDetails = await getPhoneNumberDetails();
        console.log('✅ [REGISTER_PHONE] Phone number is now CONNECTED, proceeding with registration');
      }
    }
    
    const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/register`;
    
    // Build request data
    // Note: Backup data must be actual backup data from Meta, not a placeholder
    // If you don't have backup data, we'll try without it first
    const requestData = {
      messaging_product: 'whatsapp',
      pin: PIN
    };
    
    // Add backup only if actual backup data is provided (not placeholder)
    if (BACKUP_DATA && BACKUP_DATA !== 'BACKUP_DATA' && BACKUP_DATA.length > 20) {
      requestData.backup = {
        data: BACKUP_DATA,
        password: BACKUP_PASSWORD
      };
      console.log('✅ [REGISTER_PHONE] Using provided backup data');
    } else {
      console.log('⚠️ [REGISTER_PHONE] No valid backup data provided - trying registration without backup');
      console.log('⚠️ [REGISTER_PHONE] Note: Some registrations may require backup data');
    }
    
    console.log('📤 [REGISTER_PHONE] Sending registration request...');
    console.log('📤 [REGISTER_PHONE] URL:', url);
    console.log('📤 [REGISTER_PHONE] Request Data:', {
      messaging_product: requestData.messaging_product,
      pin: requestData.pin,
      backup: requestData.backup ? {
        data: requestData.backup.data === 'BACKUP_DATA' ? 'BACKUP_DATA (placeholder)' : '***',
        password: '***'
      } : 'Not included'
    });
    
    const response = await axios.post(url, requestData, {
      headers: {
        'Authorization': `Bearer ${META_SYSTEM_USER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    console.log('✅ [REGISTER_PHONE] Registration successful!');
    console.log('✅ [REGISTER_PHONE] Response:', JSON.stringify(response.data, null, 2));
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.error('❌ [REGISTER_PHONE] Registration failed!');
    console.error('❌ [REGISTER_PHONE] Error:', error.message);
    
    if (error.response) {
      console.error('❌ [REGISTER_PHONE] Status:', error.response.status);
      console.error('❌ [REGISTER_PHONE] Error Data:', JSON.stringify(error.response.data, null, 2));
      
      const metaError = error.response.data?.error;
      if (metaError) {
        console.error('❌ [REGISTER_PHONE] Meta Error Code:', metaError.code);
        console.error('❌ [REGISTER_PHONE] Meta Error Type:', metaError.type);
        console.error('❌ [REGISTER_PHONE] Meta Error Message:', metaError.message);
        console.error('❌ [REGISTER_PHONE] FB Trace ID:', metaError.fbtrace_id);
        
        // Provide helpful suggestions based on error
        if (metaError.code === 100) {
          console.error('\n💡 [REGISTER_PHONE] Suggestion: This error often means:');
          console.error('   1. Phone number status is PENDING (needs to be CONNECTED first)');
          console.error('   2. Missing permissions on the token');
          console.error('   3. Invalid backup data format');
        }
      }
    }
    
    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
}

// Run the script
if (require.main === module) {
  registerPhoneNumber()
    .then(result => {
      if (result.success) {
        console.log('\n✅ Phone number registration completed successfully!');
        process.exit(0);
      } else {
        console.log('\n❌ Phone number registration failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n❌ Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { registerPhoneNumber };

