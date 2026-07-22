const express = require('express');
const auth = require('../middlewares/authMiddleware');
const router = express.Router();

const {
  getAllUserProfile,
  getUserProfile,
  // Email credentials controllers
  postUserEmailCredentials,
  getUserEmailCredentials,
  updateUserEmailCredentials,
  toggleEmailCredentialStatus,
  deleteEmailCredential,
  // SMS credentials controllers
  postUserSmsCredentials,
  getUserSmsCredentials,
  updateUserSmsCredentials,
  toggleSmsCredentialStatus,
  deleteSmsCredential,
  sendTestEmail,sendTestSms
} = require('../controllers/userProfileControllers.js');

// ----------------------
// 🧩 User Profile Routes
// ----------------------
router.get('/getAllUserProfile', auth, getAllUserProfile);
router.get('/userProfile/:userProfileId', auth, getUserProfile);

// ----------------------
// 📧 Email Credentials Routes
// ----------------------
router.post('/email-credentials', auth, postUserEmailCredentials);
router.get('/email-credentials/:userId', auth, getUserEmailCredentials);
router.put('/email-credentials/:editingId', auth, updateUserEmailCredentials);
router.patch('/email-credentials/:id', auth, toggleEmailCredentialStatus);
router.delete('/email-credentials/:id', auth, deleteEmailCredential);

// ----------------------
// 📱 SMS Credentials Routes
// ----------------------
router.post('/sms-credentials', auth, postUserSmsCredentials);
router.get('/sms-credentials/:userId', auth, getUserSmsCredentials);
router.put('/sms-credentials/:editingId', auth, updateUserSmsCredentials);
router.patch('/sms-credentials/:id', auth, toggleSmsCredentialStatus);
router.delete('/sms-credentials/:id', auth, deleteSmsCredential);

//testing mail route
 router.post('/sendgrid-test-email', auth, sendTestEmail );
 router.post('/twilio-test-sms', auth, sendTestSms );

module.exports = router;
