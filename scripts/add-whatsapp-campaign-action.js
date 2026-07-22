const mongoose = require('mongoose');
require('dotenv').config();

const campaignActionModel = require('../src/models/campaignActionModel');
const campaignTypeModel = require('../src/models/campaignTypeModel');

/**
 * Script to add WhatsApp as a campaign action for Send Action category
 * Run this script once to add WhatsApp to your database
 */

async function addWhatsAppCampaignAction() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/urlpt_backup';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Find the "Send Action" campaign type
    const sendActionType = await campaignTypeModel.findOne({ name: 'Send Action' });
    
    if (!sendActionType) {
      console.log('❌ "Send Action" campaign type not found in database!');
      console.log('Please ensure "Send Action" campaign type exists first.');
      process.exit(1);
    }

    console.log('✅ Found "Send Action" campaign type:', sendActionType._id);

    // Check if WhatsApp already exists
    const existingWhatsApp = await campaignActionModel.findOne({ 
      actionName: 'WhatsApp',
      isDelete: false 
    });

    if (existingWhatsApp) {
      console.log('⚠️  WhatsApp campaign action already exists!');
      console.log('Existing WhatsApp action:', existingWhatsApp);
      
      // Check if Send Action is already linked
      const hasSendAction = existingWhatsApp.campaignTypeId.some(
        id => id.toString() === sendActionType._id.toString()
      );

      if (!hasSendAction) {
        // Add Send Action to existing WhatsApp
        existingWhatsApp.campaignTypeId.push(sendActionType._id);
        await existingWhatsApp.save();
        console.log('✅ Added "Send Action" to existing WhatsApp campaign action');
      } else {
        console.log('✅ WhatsApp is already linked to "Send Action"');
      }
    } else {
      // Create new WhatsApp campaign action
      const whatsappAction = await campaignActionModel.create({
        actionName: 'WhatsApp',
        campaignTypeId: [sendActionType._id],
        isActive: true,
        isDelete: false
      });

      console.log('✅ Successfully created WhatsApp campaign action!');
      console.log('WhatsApp Action:', whatsappAction);
    }

    // Verify the result
    const allActions = await campaignActionModel.aggregate([
      { $match: { isDelete: false } },
      {
        $lookup: {
          from: 'campaign-types',
          localField: 'campaignTypeId',
          foreignField: '_id',
          as: 'campaignTypes'
        }
      }
    ]);

    console.log('\n📋 Current Campaign Actions:');
    allActions.forEach(action => {
      const types = action.campaignTypes.map(t => t.name).join(', ');
      console.log(`  - ${action.actionName} (${types || 'No types'})`);
    });

    console.log('\n✅ WhatsApp campaign action setup complete!');
    console.log('Users can now select WhatsApp as a subcategory when creating Send Action campaigns.');

  } catch (error) {
    console.error('❌ Error adding WhatsApp campaign action:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the script
addWhatsAppCampaignAction();
