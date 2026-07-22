const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://localhost:27017/urlpt_backup');
        console.log('Connected to DB');
        
        const Campaign = mongoose.model('Campaign', new mongoose.Schema({}, { strict: false }), 'usercampaigns');
        const campaign = await Campaign.findById('6a46472fb22f86f1c66510d4');
        console.log('Full Campaign Details for 6a46472fb22f86f1c66510d4:', JSON.stringify(campaign, null, 2));
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
