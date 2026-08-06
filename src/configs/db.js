const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    console.log("Mongo URI:", process.env.MONGODB_URI);
    const connect = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected at host ${connect.connection.host}`);
  } catch (error) {
    console.error("DB connection failed:", error);
    process.exit(1);
  }
};

module.exports = connectDB;