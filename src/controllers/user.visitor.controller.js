const Uservisitor = require("../models/user.visitor.model")
const mongoose = require('mongoose')
const moment = require('moment');


exports.addVisitors = async (req, res) => {
  try {
    let payload = req.body
    payload['clientId'] = new mongoose.Types.ObjectId(req.body.clientId)

    const visitors = await Uservisitor.create(payload);
    if (!visitors) {
      return res.status(400).send({ message: "Unable to add visitors" });
    }
    return res.status(201).send({ message: "Visitors added in your database", visitors });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
}

exports.getAllVisitors = async (req, res) => {
  try {
    const currUser = req.user;
    const page = parseInt(req.query.page) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const skip = page * limit;

    const searchableFields = [
      "visitId",
      "urlpt_ip",
      "name",
      "email",
      "mobile",
      "traffic_source",
      "first_traffic_source",
      "organic_source",
      "organic_source_str",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "first_utm_source",
      "first_utm_medium",
      "first_utm_campaign",
      "first_utm_term",
      "first_utm_content",
      "gaclientid",
      "fbclid",
      "msclkid",
      "gclid",
      "_fbc",
      "_fbp",
      "urlpt_ref",
      "urlpt_ref_domain",
      "urlpt_original_ref",
      "urlpt_url",
      "urlpt_url_base",
      "urlpt_landing_page",
      "urlpt_landing_page_base",
      "country",
      "state",
      "city",
      "utm_device",
      "utm_devicemodel",
      "user_agent"
    ];

    const filter = {};
    if (currUser.role === 'user') {
      filter.clientId = new mongoose.Types.ObjectId(currUser._id);
    }

    const andConditions = [];

    // Month-wise filtering
    if (req.query.month && req.query.year && req.query.month !== 'null' && req.query.year !== 'null') {
      const month = parseInt(req.query.month) - 1; // JavaScript months are 0-indexed
      const year = parseInt(req.query.year);
      
      const startDate = moment([year, month, 1]).startOf('month').toDate();
      const endDate = moment([year, month, 1]).endOf('month').toDate();
      
      filter.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }
    // If month and year are null or not provided, no date filtering will be applied (shows all time)

    if (req.query.visitorId) {
      let visitorIds = [];

      if (Array.isArray(req.query.visitorId)) {
        visitorIds = req.query.visitorId;
      } else if (typeof req.query.visitorId === 'string') {
        try {
          if (req.query.visitorId.startsWith('[')) {
            visitorIds = JSON.parse(req.query.visitorId);
          } else {
            visitorIds = [req.query.visitorId];
          }
        } catch (err) {
          visitorIds = [req.query.visitorId];
        }
      }

      filter.visitorId = {
        $in: visitorIds.map(id => new RegExp(id, 'i'))
      };
    }

    searchableFields.forEach(field => {
      const value = req.query[field];
      if (value) {
        const isNumeric = !isNaN(value);
        andConditions.push({
          [field]: isNumeric ? Number(value) : { $regex: value, $options: 'i' }
        });
      }
    });

    if (andConditions.length > 0) {
      filter.$and = andConditions;
    }

    // Handle sorting
    let sortObj = { createdAt: -1 }; // default sort
    if (req.query.sortField && req.query.sortDirection) {
      const sortField = req.query.sortField;
      const sortDirection = req.query.sortDirection === 'asc' ? 1 : -1;
      sortObj = { [sortField]: sortDirection };
    }

    const [data, total] = await Promise.all([
      Uservisitor.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit),
      Uservisitor.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error in getAllVisitors:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getSingleVisitor = async (req, res) => {
  try {
    const userId = req.params.id; // Assuming the user ID is in the request parameters
    const user = await Uservisitor.findById(userId);

    if (!user) {
      return res
        .status(404)
        .send({ message: `No user found with the ID: ${userId}` });
    }

    return res
      .status(200)
      .send({ message: "User fetched successfully", user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};


// https://technians.com/contact/?utm_source=google&utm_medium=cpc&utm_campaign=test2-campaign&utm_term=test2-digital%20agency%20in%20delhi&utm_device=m&utm_matchtype=p&utm_adgroup=test2-DMagencycompanyfirmdelhi&utm_adcopyid=407678413195&utm_adposition=4&utm_devicemodel=mobile&utm_physical_location=9298247&utm_interest_location=20456&gclid=CjwKCAjwzuqgBhAcEiwAdj5&utm_content=test2-content&utm_placement=site2.com