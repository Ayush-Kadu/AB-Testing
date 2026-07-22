const express = require('express')
const auth = require('../middlewares/authMiddleware')
const { addCred, updateCred, getCred } = require('../controllers/credentialsControllers')




const router = express.Router()

router.post('/add-cred', auth, addCred)
router.put('/update-cred/:id', auth, updateCred)
router.get('/get-cred', auth, getCred)




module.exports = router