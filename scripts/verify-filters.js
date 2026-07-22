const mongoose = require('mongoose');
const filtersModel = require('../src/models/filtersModel');

// Production MongoDB connection string
const PRODUCTION_MONGO_URI = 'mongodb://localhost:27017/urlpt_backup';

// Complete list of expected filters
const expectedFilters = [
  { display: "Visit ID", value: "visitId" },
  { display: "User IP", value: "urlpt_ip" },
  { display: "Name", value: "name" },
  { display: "Email", value: "email" },
  { display: "Mobile", value: "mobile" },
  { display: "Traffic Source", value: "traffic_source" },
  { display: "First Traffic Source", value: "first_traffic_source" },
  { display: "Organic Source", value: "organic_source" },
  { display: "Organic Source String", value: "organic_source_str" },
  { display: "UTM Source", value: "utm_source" },
  { display: "UTM Medium", value: "utm_medium" },
  { display: "UTM Campaign", value: "utm_campaign" },
  { display: "UTM Content", value: "utm_content" },
  { display: "UTM Term", value: "utm_term" },
  { display: "First UTM Source", value: "first_utm_source" },
  { display: "First UTM Medium", value: "first_utm_medium" },
  { display: "First UTM Campaign", value: "first_utm_campaign" },
  { display: "First UTM Term", value: "first_utm_term" },
  { display: "First UTM Content", value: "first_utm_content" },
  { display: "Google Client ID", value: "gaclientid" },
  { display: "Facebook Click ID", value: "fbclid" },
  { display: "Microsoft Click ID", value: "msclkid" },
  { display: "Google Click ID", value: "gclid" },
  { display: "Facebook Browser Cookie", value: "_fbc" },
  { display: "Facebook Browser Pixel", value: "_fbp" },
  { display: "Referrer URL", value: "urlpt_ref" },
  { display: "Referrer Domain", value: "urlpt_ref_domain" },
  { display: "Original Referrer", value: "urlpt_original_ref" },
  { display: "Current URL", value: "urlpt_url" },
  { display: "URL Base", value: "urlpt_url_base" },
  { display: "Landing Page", value: "urlpt_landing_page" },
  { display: "Landing Page Base", value: "urlpt_landing_page_base" },
  { display: "Country", value: "country" },
  { display: "State", value: "state" },
  { display: "City", value: "city" },
  { display: "Device Type", value: "utm_device" },
  { display: "Device Model", value: "utm_devicemodel" },
  { display: "User Agent", value: "user_agent" },
  { display: "Visitor ID", value: "visitorId" }
];

async function verifyFilters() {
  try {
    // Connect to MongoDB
    await mongoose.connect(PRODUCTION_MONGO_URI);
    console.log('✅ Connected to production MongoDB database');

    // Get all filters from database
    const existingFilters = await filtersModel.find().sort({ display: 1 });
    console.log(`📊 Found ${existingFilters.length} filters in production database`);

    // Check if we have all expected filters
    if (existingFilters.length === expectedFilters.length) {
      console.log('✅ All 39 filters are present in production database!');
      
      console.log('\n📋 Complete filter list:');
      existingFilters.forEach((filter, index) => {
        console.log(`${index + 1}. ${filter.display} (${filter.value})`);
      });
      
      console.log('\n🎉 Visitor filtering system is ready for use!');
      console.log('📚 Check VISITOR_FILTERING_GUIDE.md for usage instructions');
      
    } else {
      console.log(`❌ Expected ${expectedFilters.length} filters, but found ${existingFilters.length}`);
      
      // Find missing filters
      const existingValues = existingFilters.map(f => f.value);
      const missingFilters = expectedFilters.filter(filter => 
        !existingValues.includes(filter.value)
      );
      
      if (missingFilters.length > 0) {
        console.log('\n📋 Missing filters:');
        missingFilters.forEach((filter, index) => {
          console.log(`${index + 1}. ${filter.display} (${filter.value})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the verification
if (require.main === module) {
  verifyFilters();
}

module.exports = { verifyFilters }; 