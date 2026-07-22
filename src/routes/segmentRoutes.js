const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { createSegment, getAllSegments, getSegmentsForDropdown } = require('../controllers/segmentControllers');
const router = express.Router();

router.post('/create-segment', auth, createSegment);
router.get('/get-segments', auth, getAllSegments);
router.get('/get-segments-dropdown', auth, getSegmentsForDropdown);


module.exports = router;