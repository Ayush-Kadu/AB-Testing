const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { addPackage, editPackage, getPackage, deletePackage, getAllPackages, makeDefaultPackage, UpdatePackage } = require('../controllers/pricingControllers');
const router = express.Router();


router.post('/add-package', auth, addPackage)
router.put('/edit-package/:packageId', auth, editPackage)
router.get('/get-package/:packageId', auth, getPackage)
router.delete('/delete-package/:packageId', auth, deletePackage)
router.get('/get-packages', auth, getAllPackages)
router.post('/package/primary/:packageId', auth, makeDefaultPackage)
router.get('/getPackages', getAllPackages)
router.put('/update-package/:id', auth, UpdatePackage);


module.exports = router