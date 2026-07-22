const mongoose = require('mongoose');
require('dotenv').config();

const SMSActivity = require('../src/models/SMSActivity.model');

/**
 * Script to migrate existing WhatsApp activities
 * Sets messageType field for WhatsApp messages that were saved before the field was added
 */

async function migrateWhatsAppActivities() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/urlpt_backup';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find all SMS activities without messageType field
    const activitiesWithoutType = await SMSActivity.find({ messageType: { $exists: false } });
    
    console.log(`📊 Found ${activitiesWithoutType.length} activities without messageType field`);

    if (activitiesWithoutType.length === 0) {
      console.log('✅ No activities to migrate. All records already have messageType field.');
      process.exit(0);
    }

    // Update all to default 'sms' (since they were SMS before WhatsApp was added)
    const result = await SMSActivity.updateMany(
      { messageType: { $exists: false } },
      { $set: { messageType: 'sms' } }
    );

    console.log(`✅ Updated ${result.modifiedCount} activities with messageType: 'sms'`);

    // Display summary
    const smsCount = await SMSActivity.countDocuments({ messageType: 'sms' });
    const whatsappCount = await SMSActivity.countDocuments({ messageType: 'whatsapp' });

    console.log('\n📊 Current Activity Breakdown:');
    console.log(`  - SMS Activities: ${smsCount}`);
    console.log(`  - WhatsApp Activities: ${whatsappCount}`);

    console.log('\n✅ Migration complete!');
    console.log('WhatsApp statistics should now display correctly.');

  } catch (error) {
    console.error('❌ Error migrating WhatsApp activities:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
migrateWhatsAppActivities();
