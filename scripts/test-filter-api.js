const mongoose = require('mongoose');
const filtersModel = require('../src/models/filtersModel');

// Production MongoDB connection string
// const PRODUCTION_MONGO_URI = 'mongodb://localhost:27017/urlpt_backup';
const PRODUCTION_MONGO_URI = 'mongodb://localhost:27017/urlpt_backup';

async function testFilterAPI() {
  try {
    // Connect to MongoDB
    await mongoose.connect(PRODUCTION_MONGO_URI);
    console.log('✅ Connected to production MongoDB database');

    // Test the getFilters function (simulating the API endpoint)
    const filters = await filtersModel.find().sort({ display: 1 });
    
    console.log(`📊 API Test Results:`);
    console.log(`- Total filters returned: ${filters.length}`);
    console.log(`- Expected: 39 filters`);
    
    if (filters.length === 39) {
      console.log('✅ Filter API is working correctly!');
      
      // Show a few sample filters
      console.log('\n📋 Sample filters from API:');
      filters.slice(0, 5).forEach((filter, index) => {
        console.log(`${index + 1}. ${filter.display} (${filter.value})`);
      });
      
      // Check for specific important filters
      const importantFilters = ['visitorId', 'email', 'traffic_source', 'utm_source', 'country'];
      const foundFilters = importantFilters.filter(field => 
        filters.some(f => f.value === field)
      );
      
      console.log(`\n🔍 Important filters found: ${foundFilters.length}/${importantFilters.length}`);
      foundFilters.forEach(filter => {
        console.log(`  ✅ ${filter}`);
      });
      
      const missingFilters = importantFilters.filter(field => 
        !filters.some(f => f.value === field)
      );
      
      if (missingFilters.length > 0) {
        console.log(`\n❌ Missing important filters:`);
        missingFilters.forEach(filter => {
          console.log(`  ❌ ${filter}`);
        });
      }
      
    } else {
      console.log('❌ Filter API is not returning expected number of filters');
    }

  } catch (error) {
    console.error('❌ Error testing filter API:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the test
if (require.main === module) {
  testFilterAPI();
}

module.exports = { testFilterAPI }; 