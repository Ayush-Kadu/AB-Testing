const mongoose = require('mongoose');
require('dotenv').config();

const packageModel = require('../src/models/packageModel');

/**
 * Script to add WhatsApp to all packages' subCategory array
 * This allows users to select WhatsApp when creating Send Action campaigns
 */

async function addWhatsAppToPackages() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/urlpt_backup';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all packages
    const packages = await packageModel.find();
    
    if (packages.length === 0) {
      console.log('⚠️  No packages found in database!');
      process.exit(1);
    }

    console.log(`📦 Found ${packages.length} packages`);

    let updatedCount = 0;
    let alreadyHasCount = 0;

    // Update each package to include WhatsApp in subCategory
    for (const pkg of packages) {
      const subCategory = pkg.subCategory || [];
      
      // Check if WhatsApp already exists
      if (subCategory.includes('WhatsApp')) {
        console.log(`✅ "${pkg.name}" already has WhatsApp`);
        alreadyHasCount++;
      } else {
        // Add WhatsApp to subCategory array
        pkg.subCategory = [...subCategory, 'WhatsApp'];
        await pkg.save();
        console.log(`✅ Added WhatsApp to "${pkg.name}"`);
        updatedCount++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`  - Total packages: ${packages.length}`);
    console.log(`  - Updated: ${updatedCount}`);
    console.log(`  - Already had WhatsApp: ${alreadyHasCount}`);

    // Display updated packages
    console.log('\n📋 Package SubCategories:');
    const updatedPackages = await packageModel.find();
    updatedPackages.forEach(pkg => {
      console.log(`\n  ${pkg.name}:`);
      console.log(`    SubCategories: ${(pkg.subCategory || []).join(', ')}`);
    });

    console.log('\n✅ WhatsApp added to all packages successfully!');
    console.log('Users can now select WhatsApp when creating Send Action campaigns.');

  } catch (error) {
    console.error('❌ Error adding WhatsApp to packages:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
addWhatsAppToPackages();
