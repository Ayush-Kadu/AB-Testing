const mongoose = require('mongoose');
const connectDB = require('./configs/db');
const UserCampaign = require('./models/user.campaign.model');

async function run() {
    await connectDB();
    console.log('Connected to DB');

    const campaign = await UserCampaign.findOne({ campaigndesignerName: 'lasttest' });
    console.log('--- CONTENT KEY ---');
    if (campaign) {
        const contentVal = campaign.get('content');
        console.log('Type of content:', typeof contentVal);
        if (typeof contentVal === 'string') {
            console.log('Content preview:', contentVal.substring(0, 500));
        } else {
            console.log('Content value:', JSON.stringify(contentVal, null, 2));
        }
    } else {
        console.log('Not found');
    }

    mongoose.connection.close();
}

run().catch(console.error);
