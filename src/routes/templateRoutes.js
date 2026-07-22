const express = require('express');
const auth = require('../middlewares/authMiddleware');
const isTemplateManager = require('../middlewares/templateManagerMiddleware');
const router = express.Router();
const { addTemplate, getTemplates, getTemplate, updateTemplateById, updateTemplateDetails, deleteTemplate, getDraftTemplates, approveTemplate, debugTemplates } = require('../controllers/templateControllers')

// Test route to verify routes are working
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Template routes are working!' });
});

// Template CRUD routes
router.post('/add-template', auth, isTemplateManager, addTemplate);
router.get('/get-templates', auth, getTemplates);
router.get('/get-draft-templates', auth, getDraftTemplates);
router.get('/debug-templates', auth, debugTemplates);
router.get('/get-template/:id', auth, getTemplate);
router.put('/edit-template/:id', auth, isTemplateManager, updateTemplateById);
router.put('/edit-template-details/:id', auth, isTemplateManager, updateTemplateDetails);
router.put('/approve-template/:id', auth, approveTemplate);
router.delete('/delete-template/:id', auth, isTemplateManager, deleteTemplate);

module.exports = router