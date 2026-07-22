const mongoose = require('mongoose');
const filtersModel = require('../src/models/filtersModel');

// All searchable fields for visitor filtering based on cookies data
const searchableFields = [
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

async function populateFilters() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/urlpt';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing filters
    await filtersModel.deleteMany({});
    console.log('Cleared existing filters');
    
    // Insert new filters
    const result = await filtersModel.insertMany(searchableFields);
    console.log(`Successfully inserted ${result.length} filters`);
    
    // Verify the data
    const filters = await filtersModel.find();
    console.log('Current filters in database:', filters.length);
    
    console.log('✅ Filter population completed successfully!');
    
  } catch (error) {
    console.error('❌ Error populating filters:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
if (require.main === module) {
  populateFilters();
}

module.exports = { populateFilters, searchableFields }; 