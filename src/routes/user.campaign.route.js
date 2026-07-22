const express = require('express');
const { isAuthenticate, isAuthorised } = require('../middlewares/auth');
const { createCampaign, 
    getCampaign, 
    deleteCampaign, 
    updateCampaign, 
    getAllCampaign,
    changeCampaignStatus
 } = require('../controllers/user.campaign.controller');
const router = express.Router();
const auth = require('../middlewares/authMiddleware')


router.route('/').post(auth, createCampaign);
router.route('/:id').get(getCampaign);
router.put('/update-status/:id', auth, changeCampaignStatus)
router.route('/delete/:id').delete(deleteCampaign);
router.route('/update/:id').put(auth, updateCampaign);
router.route('/').get(getAllCampaign);

module.exports = router;
