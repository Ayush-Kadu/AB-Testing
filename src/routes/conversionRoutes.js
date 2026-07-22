const express = require('express');
const auth = require('../middlewares/authMiddleware');
const router = express.Router();
const { addConversion, getAllConversions, getAllContacts, addContact, editContact, getContact, deleteContact, addCurrencyCode, createConversion } = require('../controllers/conversionControllers')


router.post('/add-conversion', addConversion);
router.get('/get-all-conversion', auth, getAllConversions);
router.get('/get-all-contact', auth, getAllContacts);
router.post('/contact', auth, addContact);
router.put('/contact/:contactId', auth, editContact);
router.get('/contact/:contactId', auth, getContact);
router.delete('/contact/:contactId', auth, deleteContact);
router.get('/getCurrency', addCurrencyCode);
router.post('/createConversion', auth, createConversion);


module.exports = router