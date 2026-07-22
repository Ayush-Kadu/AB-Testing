const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://localhost:27017/urlpt_backup');
        console.log('Connected to DB');
        
        const Campaign = mongoose.model('Campaign', new mongoose.Schema({}, { strict: false }), 'usercampaigns');
        const campaign = await Campaign.findById('6a463c7bbc218cdc9720041b');
        console.log('Full Campaign Details:', JSON.stringify(campaign, null, 2));
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
