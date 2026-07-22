const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://localhost:27017/urlpt_backup');
        console.log('Connected to DB');
        
        const EmailActivity = mongoose.model('email-activity', new mongoose.Schema({}, { strict: false }));
        
        const latest = await EmailActivity.find({}).sort({ sentAt: -1 }).limit(5);
        console.log('Latest Email Activities:', JSON.stringify(latest, null, 2));
        
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
