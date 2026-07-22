const mongoose = require('mongoose');
const connectDB = require('./configs/db');
const Visitor = require('./models/user.visitor.model');
const Contact = require('./models/contact.model');
const EmailSubmission = require('./models/emailSubmission.model');

async function run() {
    await connectDB();
    console.log('Connected to DB');

    const visitor = await Visitor.findOne({}).sort({ createdAt: -1 });
    console.log('--- LATEST VISITOR ---');
    console.log(JSON.stringify(visitor, null, 2));

    const contacts = await Contact.find({}).sort({ createdAt: -1 });
    console.log('--- ALL CONTACTS ---');
    console.log(JSON.stringify(contacts, null, 2));

    const submission = await EmailSubmission.findOne({}).sort({ createdAt: -1 });
    console.log('--- LATEST EMAIL SUBMISSION ---');
    console.log(JSON.stringify(submission, null, 2));

    mongoose.connection.close();
}

run().catch(console.error);



