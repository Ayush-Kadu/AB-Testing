const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const cookie=require("cookie");

exports.isAuthenticate = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res
      .status(401)
      .send({
        Success: false,
        message: "Authorization token not found or incorrect.",
      });
  }
  let decodeData;
  try {
    decodeData = jwt.verify(token, process.env.SECRET_KEY);
  } catch (error) {
    return res.status(401).send({ Success: false, error: error.message });
  }
  req.user = await User.findById(decodeData.isRegistered._id).select("-password");
  next();
};

exports.isAuthorised = (req, res, next) => {
  console.log(req.user)
  if (req.user && req.user.isAdmin === 'admin') {
    return next();
  } else {
    res.status(403).json({ message: 'Permission denied' });
  }
};
