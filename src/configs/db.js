const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    const url = process.env.MONGODB_URI || `mongodb://localhost:27017/urlpt_backup`;
    try {
        const connect = await mongoose.connect(url);
        console.log(`MongoDb connected at host ${connect.connection.host}`);
    } catch (error) {
        console.log(`error ${error.message}`);
    }
}

module.exports = connectDB;