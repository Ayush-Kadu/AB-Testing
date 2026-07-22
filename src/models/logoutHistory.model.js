const mongoose = require('mongoose');

process.env.TZ = 'Asia/Kolkata';

const logoutHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  loginTime: { type: Date, default: Date.now }, 
  logoutTime: { type: Date },
  logoutMethod: { type: String, enum: ['manual', 'automatic'] },
  createdAt: { type: Date, default: Date.now }
});


const LogoutHistory = new mongoose.model('logoutHistory', logoutHistorySchema);
module.exports = LogoutHistory;
