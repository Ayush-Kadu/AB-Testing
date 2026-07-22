const ErrorHandler = require('../utils/errorHandler');
const SegmentModel = require('../models/segmentModel')
const mongoose = require('mongoose');


exports.createSegment = async (req, res, next) => {
    try {
        const payload = req.body

        const isExists = await SegmentModel.findOne({'segment': payload.segment})
        if(isExists){
            return next(new ErrorHandler('Segment already exists!.', 403))
        }

        payload['userId'] = req.user._id



        const segment = await SegmentModel.create(payload)

        if(!segment){
            return next(new ErrorHandler('Failed to create segment.'))
        }
        if(segment && segment._id){
            res.json({
                success: true,
                data: segment
            })
        }
    } catch (error) {
        next(error);
    }
};



exports.getAllSegments = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const user = req.user;

        // Build query based on role
        let query = {};
        if (user.role !== 'admin') {
            query = {
                userId: new mongoose.Types.ObjectId(user._id),
                isDelete: false
            };
        }

        // Fetch segments and total count
        const [segments, total] = await Promise.all([
            SegmentModel.find(query)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 }),

            SegmentModel.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: segments,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};


exports.getSegmentsForDropdown = async (req, res, next) => {
    try {
        const user = req.user;

        let query = { isDelete: false };
        if (user.role !== 'admin') {
            query.userId = new mongoose.Types.ObjectId(user._id);
        }

        const segments = await SegmentModel.find(query)
            .sort({ createdAt: -1 })
            .select('_id segment');

        res.json({
            success: true,
            data: segments.map(seg => ({
                value: seg._id,
                label: seg.segment
            }))
        });
    } catch (error) {
        next(error);
    }
};

