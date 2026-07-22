const express = require('express');
const { addVisitors, getAllVisitors,getSingleVisitor } = require('../controllers/user.visitor.controller');
const auth = require('../middlewares/authMiddleware');
const router = express.Router();

router.route('/').post(addVisitors);
router.route('/getvisitor').get(auth, getAllVisitors);
router.route('/getvisitor/:id').get(getSingleVisitor);

module.exports = router;
