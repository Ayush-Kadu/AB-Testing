const User = require("../models/user.model");
const LoginHistory = require("../models/loginHistoryModel");
const jwt = require("jsonwebtoken");
const { default: mongoose } = require("mongoose");
const sendEmail = require('../configs/nodemailerConfig');
const crypto = require("crypto");
const LogoutHistory = require("../models/logoutHistory.model");


require("dotenv").config();

exports.register = async (req, res) => {
  try {
    const { email } = req.body;
    let user = await User.findOne({ email: email });
    if (user) {
      return res.status(400).send({ Success: false, message: "User already exists" });
    }
    user = await User.create(req.body);

    // Generate a JWT token
    const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY);

    return res.status(201).send({
      Success: true,
      message: "Account created successfully",
      token, // Send the token to the client
      user
    });
  } catch (error) {
    return res.status(500).send({ errors: error.message, Success: false });
  }
};


exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const isRegistered = await User.findOne({ email: email });
    if (!isRegistered) {
      return res.status(401).send({
        Success: false,
        message: "You are not a registered user,Please register first!",
      });
    }
    const match = await isRegistered.comparePassword(password);
    if (!match) {
      return res
        .status(401)
        .send({ Success: false, message: "Invalid credentials found!" });
    }
    const token = jwt.sign({ isRegistered }, process.env.SECRET_KEY);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "none",
      maxAge: new Date(
        Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
      ),
    });
    await LoginHistory.create({ userId: isRegistered._id, loginTime: new Date() });
    return res.status(200).send({
      Success: true,
      message: "User login successfully",
      isRegistered,
      token,
    });
  } catch (error) {
    return res.status(500).send({ errors: error.message });
  }
};

// const sessionTimeout = 1 * 60 * 1000; // 10 minutes in milliseconds
// setInterval(async () => {
//   try {
//     console.log("hii");
//     const inactiveUsers = await LogoutHistory.find({
//       loginTime: { $lt: new Date(Date.now() - sessionTimeout) },
//       logoutTime: null // Only consider users who haven't logged out manually
//     });

//     inactiveUsers.forEach(async (inactiveUser) => {
//       console.log("hii2");

//       // Perform automatic logout for each inactive user
//       await LogoutHistory.findByIdAndUpdate(inactiveUser._id, { logoutTime: new Date(), logoutMethod: 'automatic' });
//       // No need to clear session cookie when using express-session
//     });
//   } catch (error) {
//     console.error('Error during automatic logout:', error);
//   }
// }, sessionTimeout);

exports.logOut = async (req, res) => {
  try {
    const userId = req.body.userId;
    const logoutMethod = req.body.logoutMethod;
    console.log("logoutMethod", logoutMethod);

    // Check if userId and logoutMethod are provided
    if (!userId || !logoutMethod) {
      return res.status(400).send({
        success: false,
        message: "Invalid userId or logoutMethod provided!",
      });
    }

    // Check if logoutMethod is valid
    if (logoutMethod !== 'manual' && logoutMethod !== 'automatic') {
      return res.status(400).send({
        success: false,
        message: "Invalid logoutMethod provided!",
      });
    }

    // Record logout method in LogoutHistory
    await LogoutHistory.create({ userId, logoutMethod });

    // Update logout time and method in LoginHistory
    const updateFilter = await LoginHistory.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $sort: { createdAt: -1 } },
      { $limit: 1 },
      { $project: { userId: 1, createdAt: 1 } }
    ]);
    if (updateFilter.length > 0) {
      await LoginHistory.updateOne(
        { _id: updateFilter[0]._id },
        { $set: { logOutTime: new Date(), logoutMethod: logoutMethod } }
      );
    }

    // Clear session cookie if session exists
    if (req.session) {
      req.session.destroy();
    }

    return res.status(200).send({ message: "Logout Successfully!", success: true });
  } catch (error) {
    console.error('Error logging out:', error);
    return res.status(500).send({ errors: error.message });
  }
};


exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).limit(100); // Adjust the limit as needed

    if (!users || users.length === 0) {
      return res
        .status(404)
        .send({ message: "No users found with the specified email address" });
    }

    return res
      .status(200)
      .send({ message: "Users fetched successfully", users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).send({ error: "Internal Server Error" });
  }
};
exports.getSingleUser = async (req, res) => {
  try {
    const userId = req.params.id; // Assuming the user ID is in the request parameters
    const user = await User.findById(userId);

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

exports.getAllUsersLoginHistory = async (req, res) => {
  try {
    const users = await LoginHistory.find({}).limit(100);
   

    if (!users || users.length === 0) {
      return res
        .status(404)
        .send({ message: "No users found with the specified email address" });
    }

    return res
      .status(200)
      .send({ message: "Users fetched successfully", users });
  } catch (error) {
    console.error("Error fetching users:", error); // Log the error
    return res.status(500).send({ error: "Internal Server Error" });
  }
};


exports.updateUserInfo = async (req, res) => {
  try {
    let user = await User.findById(req.params.id);
    if (!user) {
      return res.status(402).send({ success: false, message: `User with ${req.params.id} is not present!` });
    }
    user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    return res.status(200).send({ success: true, message: "Profile updated successfully!", user });
  } catch (error) {
    return res.status(500).send({ success: false, error: error.message });
  }
}

exports.ForgotPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send({ success: false, message: 'User not found' });
    }

    const resetToken = user.createResetPasswordToken();
    // Set token expiry
    user.passwordResetTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const resetUrl = `http://localhost:5173/resetPassword/${resetToken}`;
    const message = `We received a reset password request. Please click the link below: \n\n ${resetUrl}\n\n This link is valid for 10 minutes. `;


    await sendEmail({
      email: user.email,
      subject: 'Password Change Request Received',
      message: message
    });

    return res.status(200).send({ success: true, message: 'Reset password email sent successfully' });
  } catch (error) {
    console.error('Error sending reset password email:', error);
    return res.status(500).send({ success: false, error: 'Internal Server Error' });
  }
};

exports.resetPassword = async (req, res) => {
  const token = crypto.createHash('sha256').update(req.params.token).digest("hex");
  console.log("Received token:", token);

  const user = await User.findOne({ passwordResetToken: token, passwordResetTokenExpires: { $gt: Date.now() } });
  console.log("User:", user);

  if (!user) {
    console.log("Token not found or expired.");
    return res.status(404).send({ success: false, message: 'Token is invalid or expired' });
  }

  console.log("Updating user password...");
  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpires = undefined;
  user.passwordChangeAt = Date.now();

  await user.save();
  console.log("User password updated successfully.");

  return res.status(200).send({ success: true, message: 'Password reset successful' });
};
