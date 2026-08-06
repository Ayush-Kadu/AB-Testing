const LoginHistory = require("../models/loginHistoryModel");
const ErrorHandler = require("../utils/errorHandler");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const axios = require('axios')
const qs = require('querystring');
const { getIpDetails, createUserJSON } = require("../utils/helper");
const crypto = require("crypto");
const { passwordResetTemplate, welcomeEmailTemplate } = require("../template/emailTemplates");
const { activationEmailTemplate } = require("../template/activationEmailTemplate");
const SECRET_KEY = "TECHNIANS"
const bcrypt = require("bcrypt");
const { createCampaignConfig, updateMainScript } = require("../utils/createScript");
const { createMainScript } = require("../utils/scriptUtils");
const packageModel = require("../models/packageModel");
var CryptoJS = require("crypto-js");
const { sendEmail } = require("../utils/mailer");


exports.login = async (req, res, next) => {
  try {
    const { email, password, IP } = req.body;

    if (!email) {
      return next(new ErrorHandler('Please enter email.'))
    }
    if (!password) {
      return next(new ErrorHandler('Please enter password.'))
    }

    const user = await User.findOne({ email: email });
    if (!user) {
      return next(new ErrorHandler('Invalid credentials.', 401))
    }

    if (user.isDeleted) {
      return next(new ErrorHandler('Your account is deactivated. Do you want to activate it?.', 403));
    }

    const match = await user.comparePassword(password);
    if (!match) {
      return next(new ErrorHandler('Invalid credentials.', 401))
    }
    const token = jwt.sign({ userId: user._id }, SECRET_KEY);

    const getDetails = await getIpDetails(IP);

    const loginPayload = {
      loginTime: moment().utc().format(),
      userId: user._id,
      ip: IP,
      authType: 'Login',
      method: 'Form',
      city: getDetails.city || "",
      state: getDetails.region_name || "",
      country: getDetails.country_name || "",
      postal: getDetails.postal || ""
    };
    await LoginHistory.create(loginPayload);
    return res.json({
      success: true,
      message: "User login successfully",
      user,
      token,
    });
  } catch (error) {
    return next(error)
  }
};




exports.me = async (req, res, next) => {
  try {
    const user = req.user
    if (!user) {
      return next(new ErrorHandler('Unauthorized', 401))
    }

    res.json({
      success: true,
      user
    })
  } catch (error) {
    return next(error)
  }
}

exports.signUp = async (req, res, next) => {
  try {
    const { email, website, IP } = req.body;
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (user.authProvider === 'google' && req.body.authProvider === 'form') {
        return res.status(400).json({
          success: false,
          message: "This email is linked with Google. Please login via Google."
        });
      }

      if (user.authProvider === 'microsoft' && req.body.authProvider === 'form') {
        return res.status(400).json({
          success: false,
          message: "This email is linked with Microsoft. Please login via Microsoft."
        });
      }

      if (user.authProvider === 'form' && req.body.authProvider === 'google') {
        return res.status(400).json({
          success: false,
          message: "This email is registered with password. Please login using email & password."
        });
      }

      if (user.authProvider === 'form' && req.body.authProvider === 'microsoft') {
        return res.status(400).json({
          success: false,
          message: "This email is registered with password. Please login using email & password."
        });
      }

      return res.status(400).json({ success: false, message: "User already exists." });
    }

    // New user (fresh signup)
    const websiteData = {
      website,
      isPrimary: true,
      isActive: true,
    };

    const payload = {
      ...req.body,
      websites: [websiteData],
      authProvider: "form",
    };

    console.log("Signup payload:", { payload });
    console.log("Creating user with websiteDaata:", websiteData);

    user = await User.create(payload);
    const token = jwt.sign({ userId: user._id }, SECRET_KEY, { expiresIn: "7d" });

    console.log("Signup create:", { user });

    const getDetails = await getIpDetails(IP);
    await createMainScript(user);

    const loginPayload = {
      loginTime: moment().utc().format(),
      userId: user._id,
      ip: IP,
      authType: "Signup",
      method: "Form",
      city: getDetails.city || "",
      state: getDetails.region_name || "",
      country: getDetails.country_name || "",
      postal: getDetails.postal || "",
    };
    await LoginHistory.create(loginPayload);

    // Send welcome email
    try {
      const userName = `${user.firstName} ${user.lastName}`.trim() || user.firstName || "User";
      await sendEmail(user.email, "Welcome to URLPT! 🎉", welcomeEmailTemplate(userName, user.email));
      console.log(`Welcome email sent to: ${user.email}`);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail signup if email fails
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};


exports.loginWithGoogle = async (req, res, next) => {
  const { code } = req.query;

  if (!code) {
    return next(new ErrorHandler("Authorization code not provided."));
  }
  try {
    // 1. Exchange code for tokens
    const { data } = await axios.post(
      "https://oauth2.googleapis.com/token",
      qs.stringify({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        code,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token } = data;

    // 2. Get Google profile
    const { data: profile } = await axios.get(
      "https://www.googleapis.com/oauth2/v1/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    let user = await User.findOne({ email: profile.email });

    if (user) {
      user.isDeleted = false;

      if (user.authProvider === "form") {
        // Upgrade form user to form+google
        user.authProvider = "form+google";
        user.googleId = profile.id;
        await user.save();
      } else if (user.authProvider === "google" || user.authProvider === "form+google") {
        // Already Google or linked → just ensure googleId is set
        if (!user.googleId) {
          user.googleId = profile.id;
        }
        await user.save();
      }
    } else {
      // 3. Create new Google user
      const [fName, lName] = profile.name?.split(" ") || ["", ""];

      user = new User({
        firstName: fName,
        lastName: lName,
        email: profile.email,
        authProvider: "google",
        googleId: profile.id,
        password: fName + '@Sanjeev_Technians', // random since Google users don’t use it
      });

      const newuser = await user.save();
      await createMainScript(newuser);

      // Send welcome email
      try {
        const userName =
          `${newuser.firstName} ${newuser.lastName}`.trim() ||
          newuser.firstName ||
          "User";
        await sendEmail(
          newuser.email,
          "Welcome to URLPT! 🎉",
          welcomeEmailTemplate(userName, newuser.email)
        );
        console.log(`Welcome email sent to Google auth user: ${newuser.email}`);
      } catch (emailError) {
        console.error("Failed to send welcome email to Google auth user:", emailError);
      }
    }

    // 4. Log login history
    const ipData = await fetch("https://api.ipify.org?format=json");
    const convertIp = await ipData.json();
    const getDetails = await getIpDetails(convertIp?.ip);

    const loginPayload = {
      loginTime: moment().utc().format(),
      userId: user._id,
      ip: convertIp?.ip,
      authType: "Login",
      method: "Google",
      city: getDetails.city || "",
      state: getDetails.region_name || "",
      country: getDetails.country_name || "",
      postal: getDetails.postal || "",
    };
    await LoginHistory.create(loginPayload);

    // 5. Issue JWT
    const token = jwt.sign({ userId: user._id }, SECRET_KEY);
    res.redirect(`${process.env.FRONTEND_URL || 'https://app.mimz.com'}?token=` + token);
  } catch (error) {
    return next(error);
  }
};

exports.cookieConsent = async (req, res, next) => {
  try {
    const { infoShown, id, cookieContent } = req.body;

    console.log("User ID:", id);

    // Find user by ID
    const user = await User.findById(id);
    if (!user) {
      return res.status(400).json({ success: false, message: "No user found." });
    }

    // Build update object
    const updateData = { showCookiePopup: infoShown };

    // If cookieContent is provided, set it (will create if it doesn't exist)
    if (cookieContent !== undefined) {
      updateData.cookieContent = cookieContent;
    }

    await User.updateOne(
      { _id: id },
      { $set: updateData }
    );

    res.json({ success: true, message: "Consent updated successfully." });
  } catch (error) {
    console.error("Error in cookieConsent:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
};



exports.loginHistory = async (req, res, next) => {
  try {
    let { page, limit, ip, authType, city, email, method } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};

    if (ip) filter.ip = { $regex: ip, $options: "i" };
    if (authType) filter.authType = { $regex: authType, $options: "i" };
    if (city) filter.city = { $regex: city, $options: "i" };
    if (method) filter.method = { $regex: method, $options: "i" };

    let historyQuery = LoginHistory.find(filter)
      .populate({
        path: "userId",
        select: "_id firstName lastName email role",
        match: email ? { email: { $regex: email, $options: "i" } } : {},
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    let history = await historyQuery;

    history = history.filter((entry) => entry.userId !== null);

    const totalRecords = await LoginHistory.countDocuments(filter);

    res.json({
      success: true,
      data: history,
      total: totalRecords,
      pages: Math.ceil(totalRecords / limit),
    });
  } catch (error) {
    return next(error);
  }
};

exports.loginHistoryById = async (req, res, next) => {
  try {
    const { _id } = req.user;
    let { page, limit, ip, authType, city, email, method } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    let filter = { userId: _id };

    if (ip) filter.ip = { $regex: ip, $options: "i" };
    if (authType) filter.authType = { $regex: authType, $options: "i" };
    if (city) filter.city = { $regex: city, $options: "i" };
    if (method) filter.method = { $regex: method, $options: "i" };

    let historyQuery = LoginHistory.find(filter)
      .populate({
        path: "userId",
        select: "_id firstName lastName email role",
        match: email ? { email: { $regex: email, $options: "i" } } : {},
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    let history = await historyQuery;

    history = history.filter((entry) => entry.userId !== null);

    const totalRecords = await LoginHistory.countDocuments(filter);

    res.json({
      success: true,
      data: history,
      total: totalRecords,
      pages: Math.ceil(totalRecords / limit),
    });
  } catch (error) {
    return next(error);
  }
};


exports.googleAuth = async (req, res, next) => {
  try {
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&response_type=code&scope=profile email&access_type=offline`;
    res.redirect(url);
  } catch (error) {
    return next(error);
  }
};

exports.microsoftAuth = async (req, res, next) => {
  try {
    const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${process.env.MICROSOFT_REDIRECT_URI}&scope=openid profile email User.Read&response_mode=query`;
    res.redirect(url);
  } catch (error) {
    return next(error);
  }
};

exports.loginWithMicrosoftToken = async (req, res, next) => {
  try {
    const { accessToken, account } = req.body;

    if (!accessToken) {
      return next(new ErrorHandler("Access token is required.", 400));
    }

    // 1. Get Microsoft profile using the access token
    const { data: profile } = await axios.get(
      "https://graph.microsoft.com/v1.0/me",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    let email = profile.mail || profile.userPrincipalName;
    if (!email) {
      const { data: emailData } = await axios.get(
        "https://graph.microsoft.com/v1.0/me/messages?$select=from&$top=1",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      email = emailData.value[0]?.from?.emailAddress?.address;
    }

    if (!email) {
      return next(new ErrorHandler("Email not found in Microsoft profile.", 400));
    }

    let user = await User.findOne({ email: email });
    const convertIp = await getIpDetails(req.ip);

    if (user) {
      user.isDeleted = false;

      if (user.authProvider === "form") {
        // Upgrade form user to form+microsoft
        user.authProvider = "form+microsoft";
        user.microsoftId = profile.id;
        await user.save();
      } else if (user.authProvider === "microsoft" || user.authProvider === "form+microsoft") {
        // Already Microsoft or linked → just ensure microsoftId is set
        if (!user.microsoftId) {
          user.microsoftId = profile.id;
        }
        await user.save();
      } else if (user.authProvider === "google" || user.authProvider === "form+google") {
        // Upgrade Google user to google+microsoft (allow multiple providers)
        user.authProvider = "google+microsoft";
        user.microsoftId = profile.id;
        await user.save();
      }
    } else {
      // 3. Create new Microsoft user
      const [fName, lName] = profile.displayName?.split(" ") || [profile.givenName || "", profile.surname || ""];

      user = new User({
        firstName: fName,
        lastName: lName,
        email: email,
        authProvider: "microsoft",
        microsoftId: profile.id,
        password: fName + '@Sanjeev_Technians', // random since Microsoft users don't use it
      });

      const newuser = await user.save();

      // Send welcome email
      try {
        const userName = `${newuser.firstName} ${newuser.lastName}`;
        await sendEmail(
          process.env.EMAIL_USER,
          "Welcome to URLPT! 🎉",
          welcomeEmailTemplate(userName, newuser.email)
        );
        console.log(`Welcome email sent to Microsoft auth user: ${newuser.email}`);
      } catch (emailError) {
        console.error("Failed to send welcome email to Microsoft auth user:", emailError);
      }
    }

    // Create login history
    await LoginHistory.create({
      userId: user._id,
      ip: convertIp?.ip,
      authType: "Login",
      method: "Microsoft",
      city: convertIp.city || "",
      state: convertIp.region_name || "",
      country: convertIp.country_name || "",
    });

    const token = jwt.sign({ userId: user._id }, SECRET_KEY);
    
    res.status(200).json({
      success: true,
      token: token,
      user: createUserJSON(user),
    });
  } catch (error) {
    console.error("Microsoft token login error:", error);
    return next(error);
  }
};

exports.loginWithMicrosoft = async (req, res, next) => {
  const { code } = req.query;

  if (!code) {
    return next(new ErrorHandler("Authorization code not provided."));
  }

  try {
    // 1. Exchange code for tokens
    console.log('Exchanging Microsoft code for tokens...');
    console.log('Client ID:', process.env.MICROSOFT_CLIENT_ID);
    console.log('Redirect URI:', process.env.MICROSOFT_REDIRECT_URI);
    
    const { data } = await axios.post(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      qs.stringify({
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        code,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log('Microsoft token exchange successful:', data);

    const { access_token } = data;

    // 2. Get Microsoft profile
    const { data: profile } = await axios.get(
      "https://graph.microsoft.com/v1.0/me",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    // Get email from separate endpoint if not available in profile
    let email = profile.mail || profile.userPrincipalName;
    if (!email) {
      const { data: emailData } = await axios.get(
        "https://graph.microsoft.com/v1.0/me/messages?$select=from&$top=1",
        { headers: { Authorization: `Bearer ${access_token}` } }
      );
      email = emailData.value[0]?.from?.emailAddress?.address;
    }

    if (!email) {
      return next(new ErrorHandler("Email not found in Microsoft profile.", 400));
    }

    let user = await User.findOne({ email: email });

    if (user) {
      user.isDeleted = false;

      if (user.authProvider === "form") {
        // Upgrade form user to form+microsoft
        user.authProvider = "form+microsoft";
        user.microsoftId = profile.id;
        await user.save();
      } else if (user.authProvider === "microsoft" || user.authProvider === "form+microsoft") {
        // Already Microsoft or linked → just ensure microsoftId is set
        if (!user.microsoftId) {
          user.microsoftId = profile.id;
        }
        await user.save();
      } else if (user.authProvider === "google" || user.authProvider === "form+google") {
        // Upgrade Google user to google+microsoft (allow multiple providers)
        user.authProvider = "google+microsoft";
        user.microsoftId = profile.id;
        await user.save();
      }
    } else {
      // 3. Create new Microsoft user
      const [fName, lName] = profile.displayName?.split(" ") || [profile.givenName || "", profile.surname || ""];

      user = new User({
        firstName: fName,
        lastName: lName,
        email: email,
        authProvider: "microsoft",
        microsoftId: profile.id,
        password: fName + '@Sanjeev_Technians', // random since Microsoft users don't use it
      });

      const newuser = await user.save();
      await createMainScript(newuser);

      // Send welcome email
      try {
        const userName =
          `${newuser.firstName} ${newuser.lastName}`.trim() ||
          newuser.firstName ||
          "User";
        await sendEmail(
          newuser.email,
          "Welcome to URLPT! 🎉",
          welcomeEmailTemplate(userName, newuser.email)
        );
        console.log(`Welcome email sent to Microsoft auth user: ${newuser.email}`);
      } catch (emailError) {
        console.error("Failed to send welcome email to Microsoft auth user:", emailError);
      }
    }

    // 4. Log login history
    const ipData = await fetch("https://api.ipify.org?format=json");
    const convertIp = await ipData.json();
    const getDetails = await getIpDetails(convertIp?.ip);

    const loginPayload = {
      loginTime: moment().utc().format(),
      userId: user._id,
      ip: convertIp?.ip,
      authType: "Login",
      method: "Microsoft",
      city: getDetails.city || "",
      state: getDetails.region_name || "",
      country: getDetails.country_name || "",
      postal: getDetails.postal || "",
    };
    await LoginHistory.create(loginPayload);

    // 5. Issue JWT
    const token = jwt.sign({ userId: user._id }, SECRET_KEY);
    res.redirect(`${process.env.FRONTEND_URL || 'https://app.mimz.com'}?token=` + token);
  } catch (error) {
    console.error("Microsoft OAuth error:", error);
    if (error.response) {
      console.error("Error response data:", error.response.data);
      console.error("Error response status:", error.response.status);
      console.error("Error response headers:", error.response.headers);
    }
    return next(error);
  }
};




exports.updateUser = async (req, res, next) => {
  try {
    const { _id } = req.user;
    const user = await User.findById(_id);

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    let updateFields = { ...req.body };

    delete updateFields.email;
    delete updateFields.password;

    const updatedUser = await User.findByIdAndUpdate(_id, updateFields, { new: true });

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser
    });

  } catch (error) {
    return next(error);
  }
};



exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new ErrorHandler("Please provide an email address.", 400));

    const user = await User.findOne({ email });
    if (!user) return next(new ErrorHandler("User not found with this email.", 404));

    const resetToken = user.createResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    await sendEmail(user.email, "Password Reset Request", passwordResetTemplate((user.firstName + user.lastName), resetUrl));

    console.log(user?.email)

    res.status(200).json({
      success: true,
      message: "Please check the password reset link sent to your email.",
    });

  } catch (error) {
    return next(error);
  }
};


exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.query;
    const { newPassword } = req.body;

    if (!token) return next(new ErrorHandler("Invalid or expired token.", 400));
    if (!newPassword) return next(new ErrorHandler("Please provide a new password.", 400));

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetTokenExpires: { $gt: Date.now() }
    });


    if (!user) return next(new ErrorHandler("Invalid or expired token.", 400));

    user.password = newPassword;
    user.passwordChangeAt = Date.now();
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password reset successful. You can now log in."
    });

  } catch (error) {
    return next(error);
  }
};


// exports.getUserWebsites = async (req, res, next) => {
//   const { _id } = req.user;
//   const user = await User.findById(_id).select("websites");

//   if (!user) {
//     return next(new ErrorHandler("User not found", 404));
//   }

//   // Filter only active websites
//   const activeWebsites = user.websites.filter((site) => site.isActive);

//   res.status(200).json({
//     success: true,
//     websites: activeWebsites,
//   });
// };


exports.addWebsite = async (req, res, next) => {
  try {
    const { _id } = req.user;
    const { website, isPrimary, isActive } = req.body;

    if (!website) {
      return next(new ErrorHandler("Website URL is required", 400));
    }

    const user = await User.findById(_id).select("websites");

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Check if website already exists for this user (normalized comparison)
    const normalizeUrl = (url) => {
      let normalized = url.trim().toLowerCase();
      // Remove protocol
      normalized = normalized.replace(/^https?:\/\//, '');
      // Remove trailing slash
      normalized = normalized.replace(/\/$/, '');
      return normalized;
    };

    const normalizedNewWebsite = normalizeUrl(website);
    console.log('Checking for duplicate website:', {
      newWebsite: website,
      normalizedNewWebsite,
      existingWebsites: user.websites.map(w => ({ original: w.website, normalized: normalizeUrl(w.website) }))
    });

    const websiteExists = user.websites.some((w) => {
      const normalizedExisting = normalizeUrl(w.website);
      const isDuplicate = normalizedExisting === normalizedNewWebsite;
      if (isDuplicate) {
        console.log('Duplicate found:', { existing: w.website, new: website });
      }
      return isDuplicate;
    });

    if (websiteExists) {
      console.log('Rejecting duplicate website:', website);
      return next(new ErrorHandler("This website is already registered. Please enter a different website.", 400));
    }

    const updatedWebsites = user.websites.map((w) => ({
      ...w.toObject(),
      isPrimary: isPrimary ? false : w.isPrimary,
    }));

    updatedWebsites.push({
      website: website.trim(),
      isPrimary: isPrimary || false,
      isActive: isActive !== undefined ? isActive : true,
    });

    await User.updateOne({ _id }, { websites: updatedWebsites });

    res.status(200).json({
      success: true,
      message: "Website added successfully",
      websites: updatedWebsites,
    });
  } catch (error) {
    next(error);
  }
};

exports.pushNotificationForWebsite = async (req, res, next) => {
  try {
    const { websiteId, pushEnabled, message } = req.body;
    console.log(req.body)

    const { _id: userId } = req.user;
    if (!websiteId) {
      return next(new ErrorHandler("Website ID is required.", 400));
    }

    // Update nested website using $set
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, "websites._id": websiteId },
      {
        $set: {
          "websites.$.pushEnabled": pushEnabled ?? false,
          "websites.$.pushMessage": message
        }
      },
      { new: true }
    );

    if (!updatedUser) {
      return next(new ErrorHandler("Website not found in user's account.", 404));
    }

    const updatedWebsite = updatedUser.websites.find(w => w._id.toString() === websiteId);

    res.status(200).json({
      success: true,
      message: `Push notification ${pushEnabled ? "enabled" : "disabled"} successfully.`,
      website: updatedWebsite
    });
  } catch (error) {
    next(error);
  }
};

const PushSubscription = require("../models/PushSubscription.model");


exports.savePushSubscription = async (req, res, next) => {
  try {
    const { userId, websiteId, subscription, visitorId, domain } = req.body;

    // Basic validation
    if (!userId || !websiteId || !subscription || !visitorId) {
      return res.status(400).json({ message: "Missing required data" });
    }

    const { endpoint, keys } = subscription;

    // Upsert: if endpoint exists, update; else create new
    const saved = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        userId,
        websiteId,
        visitorId,   // associate subscription with visitor
        domain: domain || window.location.hostname,
        endpoint,
        keys,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true, subscription: saved });
  } catch (err) {
    next(err);
  }
};


const webpush = require("web-push");

// Passed per-call to sendNotification() below instead of via the
// module-level webpush.setVapidDetails() — that call sets shared,
// process-wide state in the web-push package itself, and
// pushNotification.service.js (the separate dashboard-reminder push
// feature) also calls it, with a different key pair. Whichever call runs
// last at require-time used to silently win for the whole process,
// breaking whichever feature didn't "win" with a 403 from the push
// service (signing with the wrong private key for a given subscription).
const vapidDetails = {
  subject: process.env.VISITOR_VAPID_SUBJECT,
  publicKey: process.env.VISITOR_VAPID_PUBLIC_KEY,
  privateKey: process.env.VISITOR_VAPID_PRIVATE_KEY,
};

exports.sendPushNotification = async (req, res, next) => {
  try {
    const { websiteId, filters = {}, payload } = req.body;
    // Validate required fields
    if (!websiteId || !payload || !payload.title || !payload.body) {
      return res.status(400).json({ 
        success: false, 
        message: "websiteId, payload, title, and body are required" 
      });
    }

    // Build MongoDB query for subscriptions
    const query = { websiteId };

    if (filters.visitorIds?.length) {
      query.visitorId = { $in: filters.visitorIds };
    }

    if (filters.fromDate || filters.toDate) {
      query.updatedAt = {};
      if (filters.fromDate) query.updatedAt.$gte = new Date(filters.fromDate);
      if (filters.toDate) query.updatedAt.$lte = new Date(filters.toDate);
    }

    // Fetch subscriptions6676
    const subscriptions = await PushSubscription.find(query);

    if (!subscriptions.length) {
      return res.status(404).json({ success: false, message: "No subscribers found" });
    }

    // Send notifications in parallel
    const results = await Promise.all(
      subscriptions.map(sub =>
        webpush.sendNotification(sub, JSON.stringify(payload), { vapidDetails })
          .then(() => ({ endpoint: sub.endpoint, success: true }))
          .catch(err => {
            console.error(`Failed for endpoint: ${sub.endpoint}`, err);
            return { endpoint: sub.endpoint, success: false, error: err.message };
          })
      )
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.status(200).json({
      success: true,
      message: `Push notifications sent. Success: ${successCount}, Failed: ${failureCount}`,
      totalSubscribers: subscriptions.length,
      results
    });

  } catch (err) {
    console.error("Push send error:", err);
    next(err);
  }
};

exports.makePrimaryWebsite = async (req, res, next) => {
  try {
    const { _id } = req.user;
    const { websiteId } = req.body;

    const user = await User.findById(_id);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    let isAlreadyPrimary = false;
    let primaryUpdated = false;

    const updatedWebsites = user.websites.map((site) => {
      if (site._id.toString() === websiteId) {
        if (site.isPrimary) {
          isAlreadyPrimary = true;
        } else {
          site.isPrimary = true;
          primaryUpdated = true;
        }
      } else {
        site.isPrimary = false;
      }
      return site;
    });

    if (isAlreadyPrimary) {
      return next(new ErrorHandler("Website is already primary", 400));
    }

    if (!primaryUpdated) {
      return next(new ErrorHandler("Website not found", 404));
    }

    await User.updateOne(
      { _id },
      { $set: { websites: updatedWebsites } }
    );

    res.status(200).json({
      success: true,
      message: "Primary website updated successfully",
      websites: updatedWebsites,
    });
  } catch (error) {
    next(error);
  }
};


exports.deactivateWebsite = async (req, res, next) => {
  try {
    const { _id } = req.user;
    const { websiteID } = req.body;

    const user = await User.findById(_id);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    const website = user.websites.find((site) => site?._id?.toString() === String(websiteID));
    if (!website) {
      return next(new ErrorHandler("Website not found", 404));
    }

    const updatedWebsites = user.websites.map((site) =>
      site._id.toString() === websiteID ? { ...site.toObject(), isActive: !site.isActive } : site
    );

    const updatedUser = await User.findOneAndUpdate({ _id }, { $set: { websites: updatedWebsites } }, { new: true });
    await updateMainScript(updatedUser)
    res.status(200).json({
      success: true,
      message: `Website ${website.isActive ? "activated" : "deactivated"} successfully`,
      websites: updatedWebsites,
    });
  } catch (error) {
    next(error);
  }
};


exports.deleteWebsite = async (req, res, next) => {
  try {
    const { _id } = req.user;
    const { websiteID } = req.body;

    const result = await User.updateOne(
      { _id },
      { $pull: { websites: { _id: websiteID } } }
    );

    if (result.modifiedCount === 0) {
      return next(new ErrorHandler("Website not found", 404));
    }

    res.status(200).json({
      success: true,
      message: "Website deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

exports.logoutHistory = async (req, res, next) => {

  try {
    const { _id } = req.user;
    const { IP, method } = req.body;

    const getDetails = await getIpDetails(IP);

    const loginPayload = {
      loginTime: moment().utc().format(),
      userId: _id,
      ip: IP,
      authType: 'Logout',
      method: method ? method : 'Manual',
      city: getDetails.city || "",
      state: getDetails.region_name || "",
      country: getDetails.country_name || "",
      postal: getDetails.postal || ""
    };
    await LoginHistory.create(loginPayload);
    return res.json({
      success: true,
      message: "Logout history created successfully",
    });

  } catch (error) {
    return next(error)
  }

}

exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?._id;

    if (!userId) return next(new ErrorHandler("Unauthorized access.", 400));
    if (!newPassword) return next(new ErrorHandler("New password is required.", 400));

    // Select password and authProvider for checking and updating
    const user = await User.findById(userId).select("+password +authProvider");

    if (!user) return next(new ErrorHandler("User not found.", 400));
    // Case 1 & 3: form or form+google or form+microsoft → require old password
    if (user.authProvider === "form" || user.authProvider === "form+google" || user.authProvider === "form+microsoft") {
      if (!oldPassword) {
        return next(new ErrorHandler("Old password is required.", 400));
      }

      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) return next(new ErrorHandler("Incorrect old password.", 400));

      user.password = newPassword; // set password only AFTER verifying old password
    }

    // Case 2: google-only → allow setting password, upgrade provider
    else if (user.authProvider === "google") {
      user.password = newPassword;       // set password first
      user.authProvider = "form+google"; // then upgrade provider
    }

    // Case 3: microsoft-only → allow setting password, upgrade provider
    else if (user.authProvider === "microsoft") {
      user.password = newPassword;       // set password first
      user.authProvider = "form+microsoft"; // then upgrade provider
    }

    // Set password change timestamp
    user.passwordChangeAt = new Date();

    // Save → triggers pre-save hook to hash password
    await user.save();

    return res.status(200).json({
      success: true,
      message:
        (user.authProvider === "form+google" || user.authProvider === "form+microsoft") && !oldPassword
          ? "Password set successfully. You can now login via email & your OAuth provider."
          : "Password updated successfully.",
    });

  } catch (error) {
    next(error);
  }
};


exports.deleteAccount = async (req, res, next) => {
  try {
    const { _id, role } = req.user;

    if (role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admins are not allowed to delete their accounts."
      });
    }

    let autoDeletedDays = 30;
    const autoDeletedAt = new Date(Date.now() + autoDeletedDays * 24 * 60 * 60 * 1000);

    const user = await User.findByIdAndUpdate(
      _id,
      { isDeleted: true, autoDeletedAt, autoDeletedDays },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: `Account marked as deleted. It will be permanently removed after ${autoDeletedDays} days.`,
      data: user
    });

  } catch (error) {
    next(error);
  }
};


// ==================== WhatsApp Configuration Endpoints ====================

const { validateWhatsAppCredentials } = require('../utils/whatsappHelper');
const whatsappLogger = require('../utils/whatsappLogger');

/**
 * Configure WhatsApp Business API credentials
 */
exports.configureWhatsApp = async (req, res, next) => {
  try {
    const { phoneNumberId, accessToken, businessAccountId } = req.body;
    const userId = req.user._id;

    whatsappLogger.info('CONFIGURE', 'WhatsApp configuration request received', {
      userId: userId.toString(),
      hasPhoneNumberId: !!phoneNumberId,
      hasAccessToken: !!accessToken,
      hasBusinessAccountId: !!businessAccountId
    });

    // Validate required fields
    if (!phoneNumberId || !accessToken) {
      whatsappLogger.error('CONFIGURE', 'Missing required fields', { userId: userId.toString() });
      return next(new ErrorHandler('Phone Number ID and Access Token are required', 400));
    }

    // Validate credentials with Meta API
    whatsappLogger.info('CONFIGURE', 'Validating credentials with Meta API');
    const validation = await validateWhatsAppCredentials({ phoneNumberId, accessToken });

    if (!validation.valid) {
      whatsappLogger.error('CONFIGURE', 'Credential validation failed', {
        userId: userId.toString(),
        error: validation.error
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid WhatsApp credentials: ' + validation.error
      });
    }

    whatsappLogger.success('CONFIGURE', 'Credentials validated successfully');

    // Extract details from validation response
    const details = validation.details || {};
    const displayNumber = details.display_phone_number || null;
    const verifiedName = details.verified_name || null;
    const qualityRating = details.quality_rating || null;

    // Debug logging to see what we're about to save
    whatsappLogger.info('CONFIGURE', 'Extracted WhatsApp details for storage', {
      displayNumber,
      verifiedName,
      qualityRating,
      hasDetails: !!details,
      detailsKeys: Object.keys(details)
    });

    // Update user with WhatsApp configuration (both old and new structures)
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          whatsapp: {
            phoneNumberId,
            accessToken,
            businessAccountId: businessAccountId || null,
            isConfigured: true,
            displayNumber: displayNumber,
            verifiedName: verifiedName,
            businessName: verifiedName || 'Not available',
            qualityRating: qualityRating,
            status: 'CONNECTED',
            setupDate: new Date(),
            lastUpdated: new Date()
          },
          whatsappConfig: {
            accessToken,
            businessAccountId: businessAccountId || null,
            phoneNumbers: [{
              id: phoneNumberId,
              display_phone_number: displayNumber,
              verified_name: verifiedName,
              quality_rating: qualityRating,
              status: 'CONNECTED'
            }],
            businessName: verifiedName || 'Not available',
            setupDate: new Date(),
            status: 'active'
          }
        }
      },
      { new: true }
    );

    if (!user) {
      whatsappLogger.error('CONFIGURE', 'User not found', { userId: userId.toString() });
      return next(new ErrorHandler('User not found', 404));
    }

    // Log what was actually saved to the database
    whatsappLogger.info('CONFIGURE', 'WhatsApp data saved to database', {
      userId: userId.toString(),
      savedData: {
        displayNumber: user.whatsapp.displayNumber,
        verifiedName: user.whatsapp.verifiedName,
        businessName: user.whatsapp.businessName,
        qualityRating: user.whatsapp.qualityRating,
        status: user.whatsapp.status,
        isConfigured: user.whatsapp.isConfigured
      }
    });

    whatsappLogger.configChange(userId.toString(), 'configured', {
      phoneNumberId: phoneNumberId.substring(0, 6) + '***',
      verifiedName: validation.details?.verified_name
    });

    return res.status(200).json({
      success: true,
      message: 'WhatsApp configured successfully',
      whatsappDetails: validation.details
    });

  } catch (error) {
    whatsappLogger.error('CONFIGURE', 'Configuration error', {
      userId: userId?.toString(),
      error: error.message
    });
    next(error);
  }
};

/**
 * Get WhatsApp configuration status
 */
exports.getWhatsAppConfig = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('whatsapp whatsappConfig');

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    // Return config without sensitive access token
    const config = {
      isConfigured: user.whatsapp?.isConfigured || false,
      phoneNumberId: user.whatsapp?.phoneNumberId || null,
      businessAccountId: user.whatsapp?.businessAccountId || null,
      // Don't send accessToken to frontend for security
    };

    // Return WhatsApp details from stored data
    const whatsappDetails = user.whatsapp?.isConfigured ? {
      id: user.whatsapp.phoneNumberId,
      display_phone_number: user.whatsapp.displayNumber,
      verified_name: user.whatsapp.verifiedName,
      businessName: user.whatsapp.businessName,
      businessAccountId: user.whatsapp.businessAccountId,
      quality_rating: user.whatsapp.qualityRating,
      status: user.whatsapp.status,
      defaultTemplates: user.whatsapp.defaultTemplates || [],
      approvedTemplates: user.whatsapp.approvedTemplates || [],
      testPhoneNumbers: user.whatsapp.testPhoneNumbers || [],
      setupDate: user.whatsapp.setupDate,
      lastUpdated: user.whatsapp.lastUpdated
    } : null;

    return res.status(200).json({
      success: true,
      config,
      whatsappDetails
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Send WhatsApp message for testing/review purposes
 * Used in Advanced Meta WhatsApp API Setup section
 */
exports.sendWhatsAppTestMessage = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { phoneNumber, templateName, templateLanguage } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!templateName) {
      return res.status(400).json({
        success: false,
        message: 'Template name is required'
      });
    }

    // Get user's WhatsApp configuration
    const user = await User.findById(userId).select('whatsapp whatsappConfig');

    if (!user || !user.whatsapp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured. Please configure WhatsApp first.'
      });
    }

    const phoneNumberId = user.whatsapp.phoneNumberId;
    // Check both locations for access token (whatsapp.accessToken is primary)
    const accessToken = user.whatsapp?.accessToken || user.whatsappConfig?.accessToken;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Access token not found. Please reconfigure WhatsApp.'
      });
    }

    // Clean phone number (remove +, spaces, dashes, etc.)
    const cleanPhoneNumber = phoneNumber.replace(/[^0-9]/g, '');

    // Prepare WhatsApp message payload
    const whatsappObject = {
      phoneNumberId: phoneNumberId,
      accessToken: accessToken,
      to: cleanPhoneNumber,
      templateName: templateName,
      templateLanguage: templateLanguage || 'en_US'
    };

    // Import sendWhatsApp helper
    const { sendWhatsApp } = require('../utils/whatsappHelper');

    // Send the message
    const result = await sendWhatsApp(whatsappObject);

    whatsappLogger.info('TEST_MESSAGE_SENT', 'Test WhatsApp message sent from settings', {
      userId: userId.toString(),
      phoneNumberId: phoneNumberId,
      to: cleanPhoneNumber.substring(0, 4) + '***' + cleanPhoneNumber.substring(-4),
      templateName: templateName,
      messageId: result.messageId
    });

    res.json({
      success: true,
      message: 'WhatsApp message sent successfully',
      messageId: result.messageId,
      data: result.data
    });

  } catch (error) {
    whatsappLogger.error('TEST_MESSAGE_ERROR', 'Failed to send test WhatsApp message', {
      userId: req.user?._id?.toString(),
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send WhatsApp message'
    });
  }
};

/**
 * Update WhatsApp data (templates, test numbers, etc.)
 */
exports.updateWhatsAppData = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { templates, testNumbers, businessDetails } = req.body;

    const updateData = {
      lastUpdated: new Date()
    };

    // Update templates if provided
    if (templates) {
      updateData['whatsapp.defaultTemplates'] = templates.defaultTemplates || [];
      updateData['whatsapp.approvedTemplates'] = templates.approvedTemplates || [];
    }

    // Update test numbers if provided
    if (testNumbers) {
      updateData['whatsapp.testPhoneNumbers'] = testNumbers;
    }

    // Update business details if provided
    if (businessDetails) {
      if (businessDetails.displayNumber) updateData['whatsapp.displayNumber'] = businessDetails.displayNumber;
      if (businessDetails.verifiedName) updateData['whatsapp.verifiedName'] = businessDetails.verifiedName;
      if (businessDetails.businessName) updateData['whatsapp.businessName'] = businessDetails.businessName;
      if (businessDetails.qualityRating) updateData['whatsapp.qualityRating'] = businessDetails.qualityRating;
      if (businessDetails.status) updateData['whatsapp.status'] = businessDetails.status;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    );

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    whatsappLogger.info('UPDATE_DATA', 'WhatsApp data updated successfully', {
      userId: userId.toString(),
      hasTemplates: !!templates,
      hasTestNumbers: !!testNumbers,
      hasBusinessDetails: !!businessDetails
    });

    res.json({
      success: true,
      message: 'WhatsApp data updated successfully'
    });

  } catch (error) {
    whatsappLogger.error('UPDATE_DATA', 'Failed to update WhatsApp data', {
      error: error.message
    });
    next(error);
  }
};

/**
 * Check if user can access guided setup
 */
exports.checkWhatsAppSetupAccess = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select('whatsapp');

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    // If WhatsApp is already configured, redirect to settings
    if (user.whatsapp?.isConfigured) {
      return res.json({
        success: false,
        message: 'WhatsApp is already configured',
        redirectTo: '/settings',
        isConfigured: true
      });
    }

    res.json({
      success: true,
      message: 'User can access guided setup',
      isConfigured: false
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Remove WhatsApp configuration
 */
exports.removeWhatsAppConfig = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
      userId,
      {
        whatsapp: {
          phoneNumberId: null,
          accessToken: null,
          businessAccountId: null,
          isConfigured: false
        }
      },
      { new: true }
    );

    if (!user) {
      whatsappLogger.error('REMOVE_CONFIG', 'User not found', { userId: userId.toString() });
      return next(new ErrorHandler('User not found', 404));
    }

    whatsappLogger.configChange(userId.toString(), 'removed', {});

    return res.status(200).json({
      success: true,
      message: 'WhatsApp configuration removed successfully'
    });

  } catch (error) {
    whatsappLogger.error('REMOVE_CONFIG', 'Error removing configuration', {
      userId: req.user?._id?.toString(),
      error: error.message
    });
    next(error);
  }
};

/**
 * Get WhatsApp logs for debugging
 */
exports.getWhatsAppLogs = async (req, res, next) => {
  try {
    const { lines = 100 } = req.query;
    const logs = whatsappLogger.readRecentLogs(parseInt(lines));

    return res.status(200).json({
      success: true,
      logs,
      count: logs.length
    });

  } catch (error) {
    next(error);
  }
};


exports.activeUser = async (req, res, next) => {
  try {
    const { _id, isDeleted } = req.body;

    const user = await User.findOneAndUpdate(
      { _id },
      { isDeleted: isDeleted },
      { new: true }
    );

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    res.status(200).json({
      success: true,
      message: `Account has been successfully ${isDeleted ? "deactivated" : "activated"}.`,
      user,
    });
  } catch (error) {
    next(error);
  }
};

exports.activationMail = async (req, res, next) => {
  try {
    const { email } = req.params;

    const user = await User.find({ email });

    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    await sendEmail(email, 'Account Activation Request', activationEmailTemplate(email));

    res.status(200).json({
      success: true,
      message: "Activation email sent successfully.",
    });

  } catch (error) {
    console.error("Activation Mail Error:", error);
    next(error);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    let { page, limit, firstName, email, role } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const skip = (page - 1) * limit;

    let filter = {};

    if (firstName) filter.firstName = { $regex: firstName, $options: "i" };
    if (email) filter.email = { $regex: email, $options: "i" };
    if (role) filter.role = { $regex: role, $options: "i" };

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: users,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.logoutTime = async (req, res, next) => {
  try {
    const { role } = req.user;
    const { time, packagePercentage } = req.body;

    const package = await packageModel.findOne()
    if (package && package._id) {
      if (package.percentage !== packagePercentage) {
        await packageModel.updateMany({ percentage: packagePercentage })
      }
    }



    if (role !== "admin") {
      return next(new ErrorHandler("Access denied. Only admin can set logout time.", 403));
    }
    const result = await User.updateMany({}, { logoutTime: time });

    res.status(200).json({
      success: true,
      message: "Logout time updated for all users by admin.",
      updatedCount: result.modifiedCount || result.nModified,
    });
  } catch (error) {
    next(error);
  }
};

exports.setAutoDeletedDays = async (req, res, next) => {
  try {
    const { autoDeletedDays } = req.body;
    const { role } = req.user;

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update this setting."
      });
    }

    if (!autoDeletedDays || autoDeletedDays < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid autoDeletedDays value."
      });
    }

    const autoDeletedAt = new Date(Date.now() + autoDeletedDays * 24 * 60 * 60 * 1000);

    const result = await User.updateMany(
      { isDeleted: true },
      { $set: { autoDeletedDays, autoDeletedAt } }
    );

    res.status(200).json({
      success: true,
      message: `Auto-deletion period updated to ${autoDeletedDays} days.`,
      data: result
    });

  } catch (error) {
    next(error);
  }
};

exports.getAutoDeleteDays = async (req, res, next) => {
  try {
    const result = await User.findOne({ isDeleted: true }).sort({ updatedAt: -1 });

    const autoDeletedDays = result?.autoDeletedDays ?? 30; // Default to 30 if not found

    res.status(200).json({
      success: true,
      autoDeletedDays,
      message: result ? "Auto-deletion setting found." : "Default auto-deletion days used.",
    });
  } catch (error) {
    next(error);
  }
};

//sanjeev code

exports.postEmailOtp = async (req, res, next) => {
  try {


    const { email, otp } = req.body;

    if (!email || !otp) {
      return next(new ErrorHandler("Please provide an email address and OTP.", 400));
    }

    const secretKey = 'OTPHashingBySanjeevTechnians$'; //same as frontend key

    const decryptotp = CryptoJS.AES.decrypt(otp, secretKey);
    const originalOTP = decryptotp.toString(CryptoJS.enc.Utf8);

    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ success: false, message: "Email is already Registered" });
    } else {
      const htmlContent = `
  <div style="max-width: 520px; margin: auto; background-color: #f9fafb; border-radius: 10px; font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e5e7eb;">
    
    <!-- Header -->
    <div style="text-align: center; padding-bottom: 20px;">
      <h1 style="margin: 0; font-size: 20px; color: #1e3a8a;">🔐 Email Verification</h1>
      <p style="margin: 5px 0 0; font-size: 14px; color: #6b7280;">Secure your account in just one step</p>
    </div>

    <!-- OTP Box -->
    <div style="background: linear-gradient(90deg, #1695b4, #0d7f9bff); color: white; text-align: center; padding: 18px; border-radius: 8px; font-size: 26px; font-weight: bold; letter-spacing: 6px; margin: 25px 0;">
      ${originalOTP}
    </div>

    <!-- Body Text -->
    <p style="font-size: 15px; color: #374151; margin-top: 0;">
      Dear User,
    </p>
    <p style="font-size: 15px; color: #374151;">
      Please use the above OTP to verify your email address. This code will expire in <strong>2 minutes</strong>.
    </p>

    <!-- Warning -->
    <p style="font-size: 13px; color: #ef4444; background-color: #fee2e2; padding: 10px; border-radius: 6px; margin: 20px 0 10px;">
      ⚠ Do not share this OTP with anyone for security reasons.
    </p>

    <!-- Footer -->
    <div style="margin-top: 25px; border-top: 1px solid #e5e7eb; padding-top: 15px; font-size: 13px; color: #9ca3af; text-align: center;">
      Regards,<br/>
      <span style="color: #2563eb; font-weight: bold;">Official Support Team</span>
    </div>
  </div>
`;



      await sendEmail(email, "Email Verification OTP", htmlContent);

      res.status(200).json({
        success: true,
        message: "OTP has been sent to your email address.",
      });
    }
  } catch (error) {
    console.error("Error in postEmailOtp:", error);
    return next(error);
  }
};

exports.completeOnboarding = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
      userId,
      { onboardingCompleted: true },
      { new: true }
    );

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      user
    });
  } catch (error) {
    return next(error);
  }
};

// 📱 Get Approved WhatsApp Templates from Meta
exports.getWhatsAppTemplates = async (req, res, next) => {
  try {
    const user = req.user;

    if (!user.whatsapp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp not configured. Please configure WhatsApp first."
      });
    }

    const { phoneNumberId, accessToken, businessAccountId } = user.whatsapp;

    if (!phoneNumberId || !accessToken || !businessAccountId) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp credentials incomplete. Please reconfigure WhatsApp."
      });
    }

    whatsappLogger.info('GET_TEMPLATES', 'Fetching approved templates from Meta', {
      phoneNumberId,
      businessAccountId
    });

    // Fetch templates from Meta Graph API
    const url = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`;
    const params = {
      access_token: accessToken,
      fields: 'name,status,language,components,quality_score'
    };

    whatsappLogger.apiRequest(url, params);

    const response = await axios.get(url, { params });

    whatsappLogger.apiResponse(url, response.data, 'success');

    // Filter only approved templates
    const approvedTemplates = response.data.data?.filter(template =>
      template.status === 'APPROVED'
    ) || [];

    whatsappLogger.info('GET_TEMPLATES', `Found ${approvedTemplates.length} approved templates`);

    return res.status(200).json({
      success: true,
      templates: approvedTemplates,
      count: approvedTemplates.length,
      message: approvedTemplates.length > 0
        ? `Found ${approvedTemplates.length} approved templates`
        : "No custom templates approved"
    });

  } catch (error) {
    whatsappLogger.error('GET_TEMPLATES', 'Failed to fetch templates', {
      error: error.message,
      response: error.response?.data
    });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch WhatsApp templates",
      error: error.response?.data?.error?.message || error.message
    });
  }
};

// 🚀 Meta WhatsApp Setup - Complete setup with token generation
exports.setupWhatsAppMeta = async (req, res, next) => {
  try {
    console.log('🚀 META_SETUP: Starting Meta WhatsApp setup');
    console.log('📋 META_SETUP: Request body:', {
      hasAppId: !!req.body.appId,
      hasAppSecret: !!req.body.appSecret,
      hasBusinessAccountId: !!req.body.businessAccountId,
      appIdLength: req.body.appId?.length || 0,
      appSecretLength: req.body.appSecret?.length || 0,
      businessAccountIdLength: req.body.businessAccountId?.length || 0
    });

    const { appId, appSecret, businessAccountId } = req.body;
    const userId = req.user._id;

    console.log('👤 META_SETUP: User ID:', userId);
    console.log('🔑 META_SETUP: Credentials check:', {
      appId: appId ? `${appId.substring(0, 8)}...` : 'MISSING',
      appSecret: appSecret ? 'PROVIDED' : 'MISSING',
      businessAccountId: businessAccountId || 'MISSING'
    });

    whatsappLogger.info('META_SETUP', 'Starting Meta WhatsApp setup', {
      userId,
      appId: appId ? `${appId.substring(0, 8)}...` : 'not provided',
      businessAccountId
    });

    // Validate required fields
    if (!appId || !appSecret || !businessAccountId) {
      console.log('❌ META_SETUP: Missing required fields:', {
        appId: !!appId,
        appSecret: !!appSecret,
        businessAccountId: !!businessAccountId
      });
      return res.status(400).json({
        success: false,
        message: "App ID, App Secret, and Business Account ID are required"
      });
    }

    console.log('✅ META_SETUP: All required fields provided');

    // Step 1: Generate App Access Token
    console.log('🔑 META_SETUP: Generating app access token...');
    whatsappLogger.info('META_SETUP', 'Generating app access token');

    const tokenResponse = await fetch('https://graph.facebook.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        grant_type: 'client_credentials'
      })
    });

    console.log('📡 META_SETUP: Token response status:', tokenResponse.status);
    console.log('📡 META_SETUP: Token response ok:', tokenResponse.ok);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.log('❌ META_SETUP: Token generation failed:', errorData);
      whatsappLogger.error('META_SETUP', 'Failed to generate access token', {
        error: errorData,
        status: tokenResponse.status
      });

      return res.status(400).json({
        success: false,
        message: "Invalid App ID or App Secret. Please check your credentials.",
        error: errorData.error?.message || "Authentication failed"
      });
    }

    const { access_token } = await tokenResponse.json();
    console.log('✅ META_SETUP: Access token generated successfully');
    whatsappLogger.info('META_SETUP', 'Access token generated successfully');

    // Step 2: Get Business Account Info
    whatsappLogger.info('META_SETUP', 'Fetching business account info');
    const businessResponse = await fetch(`https://graph.facebook.com/v18.0/${businessAccountId}`, {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!businessResponse.ok) {
      const errorData = await businessResponse.json();
      whatsappLogger.error('META_SETUP', 'Failed to fetch business account', {
        error: errorData,
        businessAccountId
      });

      return res.status(400).json({
        success: false,
        message: "Invalid Business Account ID. Please check your credentials.",
        error: errorData.error?.message || "Business account not found"
      });
    }

    const businessData = await businessResponse.json();
    whatsappLogger.info('META_SETUP', 'Business account info fetched', {
      businessName: businessData.name
    });

    // Step 3: Get Phone Numbers (with testing fallback)
    whatsappLogger.info('META_SETUP', 'Fetching phone numbers');
    console.log('📱 META_SETUP: Fetching phone numbers from:', `https://graph.facebook.com/v18.0/${businessAccountId}/phone_numbers`);

    // Try multiple endpoints to get phone numbers
    let phoneNumbersData = { data: [] };
    let isTestingMode = false;
    let phoneNumbersResponse;

    // Try 1: Get WhatsApp Business Account (WABA) first, then phone numbers
    try {
      console.log('📱 META_SETUP: Step 1 - Getting WhatsApp Business Account (WABA)...');
      console.log('📱 META_SETUP: Business Account ID:', businessAccountId);
      console.log('📱 META_SETUP: Access Token (first 20 chars):', access_token.substring(0, 20) + '...');

      // First, try to get WABA from the business account
      const wabaResponse = await fetch(`https://graph.facebook.com/v19.0/${businessAccountId}/whatsapp_business_accounts`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
      });

      console.log('📱 META_SETUP: WABA response status:', wabaResponse.status);
      console.log('📱 META_SETUP: WABA response ok:', wabaResponse.ok);

      if (wabaResponse.ok) {
        const wabaData = await wabaResponse.json();
        console.log('✅ META_SETUP: WABA data:', JSON.stringify(wabaData, null, 2));

        if (wabaData.data && wabaData.data.length > 0) {
          const wabaId = wabaData.data[0].id;
          console.log('📱 META_SETUP: Found WABA ID:', wabaId);

          // Now get phone numbers from WABA using the correct endpoint
          console.log('📱 META_SETUP: Step 2 - Getting phone numbers from WABA...');
          phoneNumbersResponse = await fetch(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
          });
          console.log('📱 META_SETUP: Phone numbers response status:', phoneNumbersResponse.status);
          console.log('📱 META_SETUP: Phone numbers response ok:', phoneNumbersResponse.ok);
        } else {
          console.log('❌ META_SETUP: No WABA found in response');
          phoneNumbersResponse = {
            ok: false,
            status: 404,
            json: async () => ({ error: { message: 'No WABA found' } })
          };
        }
      } else {
        const wabaErrorData = await wabaResponse.json();
        console.log('❌ META_SETUP: WABA API failed with error:', JSON.stringify(wabaErrorData, null, 2));
        console.log('❌ META_SETUP: Full error details:', {
          status: wabaResponse.status,
          statusText: wabaResponse.statusText,
          error: wabaErrorData
        });
        phoneNumbersResponse = {
          ok: false,
          status: wabaResponse.status,
          json: async () => wabaErrorData
        };
      }
    } catch (error) {
      console.log('❌ META_SETUP: WABA API error:', error.message);
      // Create a mock response object that won't cause .json() errors
      phoneNumbersResponse = {
        ok: false,
        status: 500,
        json: async () => ({ error: { message: error.message } })
      };
    }

    if (!phoneNumbersResponse || !phoneNumbersResponse.ok) {
      let errorData = {};
      if (phoneNumbersResponse && phoneNumbersResponse.json) {
        try {
          errorData = await phoneNumbersResponse.json();
        } catch (jsonError) {
          console.log('❌ META_SETUP: Could not parse error response:', jsonError.message);
          errorData = { error: { message: 'Phone numbers API failed' } };
        }
      } else {
        errorData = { error: { message: 'Phone numbers API not accessible' } };
      }

      console.log('❌ META_SETUP: Phone numbers API failed:', errorData);
      whatsappLogger.warn('META_SETUP', 'No phone numbers found, checking for testing mode', {
        error: errorData
      });

      // Try alternative approaches to get phone numbers
      console.log('🔄 META_SETUP: Trying alternative phone number endpoints...');

      // Try 2: Alternative approach - try to get phone numbers from different endpoints
      try {
        console.log('📱 META_SETUP: Trying alternative phone number endpoints...');

        // Try 2a: Use the Business Account ID directly as WABA ID (sometimes they're the same)
        console.log('📱 META_SETUP: Trying Business Account ID as WABA ID...');
        const directWabaResponse = await fetch(`https://graph.facebook.com/v19.0/${businessAccountId}/phone_numbers`, {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });

        console.log('📱 META_SETUP: Direct WABA response status:', directWabaResponse.status);

        if (directWabaResponse.ok) {
          const directWabaData = await directWabaResponse.json();
          console.log('✅ META_SETUP: Direct WABA response:', JSON.stringify(directWabaData, null, 2));

          if (directWabaData.data && directWabaData.data.length > 0) {
            phoneNumbersData = directWabaData;
            console.log('✅ META_SETUP: Found phone numbers from direct WABA:', phoneNumbersData);
          }
        } else {
          const errorData = await directWabaResponse.json();
          console.log('❌ META_SETUP: Direct WABA failed:', JSON.stringify(errorData, null, 2));
        }

        // Try 2b: If direct WABA failed, try with different API version
        if (!phoneNumbersData.data || phoneNumbersData.data.length === 0) {
          console.log('📱 META_SETUP: Trying with API v18.0...');
          const v18Response = await fetch(`https://graph.facebook.com/v18.0/${businessAccountId}/phone_numbers`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
          });

          if (v18Response.ok) {
            const v18Data = await v18Response.json();
            console.log('✅ META_SETUP: v18.0 response:', JSON.stringify(v18Data, null, 2));

            if (v18Data.data && v18Data.data.length > 0) {
              phoneNumbersData = v18Data;
              console.log('✅ META_SETUP: Found phone numbers from v18.0:', phoneNumbersData);
            }
          } else {
            const v18Error = await v18Response.json();
            console.log('❌ META_SETUP: v18.0 failed:', JSON.stringify(v18Error, null, 2));
          }
        }

        // Try 2c: If still no data, try with v17.0
        if (!phoneNumbersData.data || phoneNumbersData.data.length === 0) {
          console.log('📱 META_SETUP: Trying with API v17.0...');
          const v17Response = await fetch(`https://graph.facebook.com/v17.0/${businessAccountId}/phone_numbers`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
          });

          if (v17Response.ok) {
            const v17Data = await v17Response.json();
            console.log('✅ META_SETUP: v17.0 response:', JSON.stringify(v17Data, null, 2));

            if (v17Data.data && v17Data.data.length > 0) {
              phoneNumbersData = v17Data;
              console.log('✅ META_SETUP: Found phone numbers from v17.0:', phoneNumbersData);
            }
          } else {
            const v17Error = await v17Response.json();
            console.log('❌ META_SETUP: v17.0 failed:', JSON.stringify(v17Error, null, 2));
          }
        }

      } catch (directError) {
        console.log('❌ META_SETUP: Alternative phone numbers error:', directError.message);
      }

      // Try 3: Direct phone number lookup with different parameters
      if (!phoneNumbersData.data || phoneNumbersData.data.length === 0) {
        try {
          console.log('📱 META_SETUP: Trying direct phone number lookup...');
          const directPhoneResponse = await fetch(`https://graph.facebook.com/v18.0/${businessAccountId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status&limit=10`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
          });

          if (directPhoneResponse.ok) {
            const directPhoneData = await directPhoneResponse.json();
            console.log('✅ META_SETUP: Direct phone lookup response:', directPhoneData);

            if (directPhoneData.data && directPhoneData.data.length > 0) {
              phoneNumbersData = directPhoneData;
              console.log('✅ META_SETUP: Found phone numbers from direct lookup:', phoneNumbersData);
            }
          } else {
            const errorData = await directPhoneResponse.json();
            console.log('❌ META_SETUP: Direct phone lookup failed:', errorData);
          }
        } catch (directError) {
          console.log('❌ META_SETUP: Direct phone lookup error:', directError.message);
        }
      }

      // Fallback: Create mock data if no real phone numbers found
      if (!phoneNumbersData.data || phoneNumbersData.data.length === 0) {
        console.log('⚠️ META_SETUP: No phone numbers found, creating fallback data');

        // Check if this is a testing scenario - try to get test phone numbers
        try {
          const testPhoneResponse = await fetch(`https://graph.facebook.com/v18.0/${businessAccountId}`, {
            headers: { 'Authorization': `Bearer ${access_token}` }
          });

          if (testPhoneResponse.ok) {
            const businessInfo = await testPhoneResponse.json();
            whatsappLogger.info('META_SETUP', 'Business account accessible, setting up testing mode', {
              businessName: businessInfo.name
            });

            // Create mock phone number data
            phoneNumbersData = {
              data: [{
                id: 'test_phone_number',
                display_phone_number: '+1234567890',
                verified_name: businessInfo.name || 'Test Business',
                quality_rating: 'GREEN',
                status: 'CONNECTED',
                is_test_number: true
              }]
            };
            isTestingMode = true;
          } else {
            throw new Error('Business account not accessible');
          }
        } catch (testError) {
          whatsappLogger.error('META_SETUP', 'Failed to access business account for testing', {
            error: testError.message
          });

          return res.status(400).json({
            success: false,
            message: "No phone numbers found and unable to set up testing mode. Please add a phone number to your WhatsApp Business account first.",
            error: testError.message || "No phone numbers available",
            suggestion: "You can add a phone number in your Meta Business Manager or use a test number for development."
          });
        }
      }
    } else {
      phoneNumbersData = await phoneNumbersResponse.json();
      console.log('✅ META_SETUP: Phone numbers fetched successfully:', {
        count: phoneNumbersData.data?.length || 0,
        phoneNumbers: phoneNumbersData.data?.map(p => ({
          id: p.id,
          display_phone_number: p.display_phone_number,
          verified_name: p.verified_name
        }))
      });
      whatsappLogger.info('META_SETUP', 'Phone numbers fetched', {
        count: phoneNumbersData.data?.length || 0
      });
    }

    // Step 4: Get Templates (optional)
    let templates = [];
    try {
      if (phoneNumbersData.data && phoneNumbersData.data.length > 0) {
        const phoneNumberId = phoneNumbersData.data[0].id;
        const templatesResponse = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/message_templates`, {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });

        if (templatesResponse.ok) {
          const templatesData = await templatesResponse.json();
          templates = templatesData.data || [];
          whatsappLogger.info('META_SETUP', 'Templates fetched', {
            count: templates.length
          });
        }
      }
    } catch (templateError) {
      whatsappLogger.warn('META_SETUP', 'Failed to fetch templates (non-critical)', {
        error: templateError.message
      });
    }

    // Step 5: Save configuration to user
    const whatsappConfig = {
      metaAppId: appId,
      metaAppSecret: appSecret, // Note: In production, encrypt this
      businessAccountId: businessAccountId,
      accessToken: access_token,
      phoneNumbers: phoneNumbersData.data || [],
      templates: templates,
      businessName: businessData.name,
      setupDate: new Date(),
      status: 'active',
      isTestingMode: isTestingMode
    };

    // Update both whatsappConfig (new structure) and whatsapp (legacy structure)
    const updateData = {
      $set: {
        whatsappConfig,
        whatsapp: {
          phoneNumberId: phoneNumbersData.data?.[0]?.id || 'test_phone_number',
          accessToken: access_token,
          businessAccountId: businessAccountId,
          isConfigured: true
        }
      }
    };

    await User.findByIdAndUpdate(userId, updateData);

    whatsappLogger.info('META_SETUP', 'WhatsApp configuration saved successfully', {
      userId,
      phoneNumbersCount: phoneNumbersData.data?.length || 0,
      phoneNumberId: phoneNumbersData.data?.[0]?.id,
      phoneNumberDisplay: phoneNumbersData.data?.[0]?.display_phone_number,
      templatesCount: templates.length,
      isTestingMode
    });

    const successMessage = isTestingMode
      ? "WhatsApp Meta setup completed successfully! (Testing Mode - Add a real phone number for production use)"
      : "WhatsApp Meta setup completed successfully!";

    res.json({
      success: true,
      message: successMessage,
      data: {
        accessToken: access_token,
        phoneNumbers: phoneNumbersData.data || [],
        templates: templates,
        businessName: businessData.name,
        setupComplete: true,
        isTestingMode: isTestingMode,
        testingInfo: isTestingMode ? {
          note: "You're in testing mode. To send messages to real numbers, add a verified phone number to your WhatsApp Business account.",
          testNumber: phoneNumbersData.data[0]?.display_phone_number,
          nextSteps: [
            "Add a verified phone number in Meta Business Manager",
            "Verify your business account",
            "Submit for WhatsApp Business API review"
          ]
        } : null
      }
    });

  } catch (error) {
    console.log('💥 META_SETUP: Unexpected error occurred:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    whatsappLogger.error('META_SETUP', 'Meta setup failed', {
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: "WhatsApp setup failed. Please try again.",
      error: error.message,
      debug: {
        errorType: error.name,
        errorMessage: error.message
      }
    });
  }
};

// 🚀 Get WhatsApp Templates - Enhanced version
exports.getWhatsAppTemplatesEnhanced = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    // Debug: Log user configuration
    console.log('🔍 Templates Debug - User ID:', userId);
    console.log('🔍 Templates Debug - User whatsapp:', user.whatsapp);
    console.log('🔍 Templates Debug - User whatsappConfig:', user.whatsappConfig);

    // Check both new and old WhatsApp configuration structures
    const hasNewConfig = user.whatsappConfig && user.whatsappConfig.accessToken;
    const hasOldConfig = user.whatsapp && user.whatsapp.isConfigured && user.whatsapp.accessToken;

    if (!hasNewConfig && !hasOldConfig) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp not configured. Please complete setup first."
      });
    }

    // Use new config if available, otherwise fall back to old config
    const config = hasNewConfig ? user.whatsappConfig : {
      accessToken: user.whatsapp.accessToken,
      phoneNumbers: [{
        id: user.whatsapp.phoneNumberId,
        display_phone_number: 'Not available',
        verified_name: 'Not available',
        quality_rating: 'UNKNOWN',
        status: 'CONNECTED'
      }]
    };

    const { accessToken, phoneNumbers } = config;

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No phone numbers configured. Please add a phone number to your WhatsApp Business account."
      });
    }

    // Get templates from Business Account (not phone number)
    const businessAccountId = config.businessAccountId || user.whatsapp?.businessAccountId;

    console.log('🔍 Templates Debug - Business Account ID:', businessAccountId);
    console.log('🔍 Templates Debug - Config businessAccountId:', config.businessAccountId);
    console.log('🔍 Templates Debug - User whatsapp businessAccountId:', user.whatsapp?.businessAccountId);

    if (!businessAccountId) {
      return res.status(400).json({
        success: false,
        message: "Business Account ID not found. Please reconfigure WhatsApp."
      });
    }

    const response = await fetch(`https://graph.facebook.com/v18.0/${businessAccountId}/message_templates`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const errorData = await response.json();
      whatsappLogger.error('GET_TEMPLATES_ENHANCED', 'Failed to fetch templates', {
        error: errorData,
        businessAccountId
      });

      return res.status(400).json({
        success: false,
        message: "Failed to fetch templates from Meta",
        error: errorData.error?.message || "API request failed"
      });
    }

    const templatesData = await response.json();
    const templates = templatesData.data || [];

    whatsappLogger.info('GET_TEMPLATES_ENHANCED', 'Templates fetched successfully', {
      userId,
      count: templates.length,
      businessAccountId
    });

    res.json({
      success: true,
      templates: templates,
      count: templates.length,
      message: templates.length > 0
        ? `Found ${templates.length} approved templates`
        : "No custom templates approved"
    });

  } catch (error) {
    whatsappLogger.error('GET_TEMPLATES_ENHANCED', 'Failed to fetch templates', {
      error: error.message,
      response: error.response?.data
    });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch WhatsApp templates",
      error: error.response?.data?.error?.message || error.message
    });
  }
};

// Get WhatsApp recipient phone numbers for testing
exports.getWhatsAppRecipients = async (req, res, next) => {
  try {
    const user = req.user;

    // Get user's WhatsApp configuration
    const userDoc = await User.findById(user._id);

    // Debug: Log user configuration
    console.log('🔍 Recipients Debug - User ID:', user._id);
    console.log('🔍 Recipients Debug - User whatsapp:', userDoc.whatsapp);
    console.log('🔍 Recipients Debug - User whatsappConfig:', userDoc.whatsappConfig);

    // Check both new and old WhatsApp configuration structures
    const hasNewConfig = userDoc.whatsappConfig && userDoc.whatsappConfig.accessToken;
    const hasOldConfig = userDoc.whatsapp && userDoc.whatsapp.isConfigured && userDoc.whatsapp.accessToken;

    if (!hasNewConfig && !hasOldConfig) {
      return res.status(404).json({
        success: false,
        message: "WhatsApp not configured. Please set up WhatsApp first."
      });
    }

    // Use new config if available, otherwise fall back to old config
    const config = hasNewConfig ? userDoc.whatsappConfig : {
      accessToken: userDoc.whatsapp.accessToken,
      businessAccountId: userDoc.whatsapp.businessAccountId
    };

    const { accessToken, businessAccountId } = config;

    if (!accessToken || !businessAccountId) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp configuration incomplete. Please reconfigure."
      });
    }

    // Get test recipients from Meta (if available)
    try {
      const recipientsResponse = await fetch(`https://graph.facebook.com/v18.0/${businessAccountId}/test_phone_numbers`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      let recipients = [];
      if (recipientsResponse.ok) {
        const recipientsData = await recipientsResponse.json();
        recipients = recipientsData.data || [];
      }

      // Add common test numbers if no recipients found
      if (recipients.length === 0) {
        recipients = [
          {
            phone_number: "+91 99532 90444", // Your registered test number
            name: "Test Recipient 1",
            is_test: true
          },
          {
            phone_number: "+1 555 153 0461", // Meta test number
            name: "Meta Test Number",
            is_test: true
          }
        ];
      }

      res.json({
        success: true,
        recipients: recipients,
        message: "Recipient phone numbers retrieved successfully"
      });

    } catch (error) {
      console.error('Error fetching recipients:', error);

      // Return default test numbers
      res.json({
        success: true,
        recipients: [
          {
            phone_number: "+91 99532 90444",
            name: "Your Test Number",
            is_test: true
          },
          {
            phone_number: "+1 555 153 0461",
            name: "Meta Test Number",
            is_test: true
          }
        ],
        message: "Using default test numbers"
      });
    }

  } catch (error) {
    console.error('Error in getWhatsAppRecipients:', error);
    return next(error);
  }
};

// Generate new WhatsApp access token
exports.generateWhatsAppToken = async (req, res, next) => {
  try {
    const user = req.user;

    // Get user's WhatsApp configuration
    const userDoc = await User.findById(user._id);
    if (!userDoc || !userDoc.whatsappConfig) {
      return res.status(404).json({
        success: false,
        message: "WhatsApp not configured. Please set up WhatsApp first."
      });
    }

    const { metaAppId, metaAppSecret } = userDoc.whatsappConfig;

    if (!metaAppId || !metaAppSecret) {
      return res.status(400).json({
        success: false,
        message: "WhatsApp configuration incomplete. Please reconfigure with App ID and App Secret."
      });
    }

    // Generate new access token
    const tokenResponse = await fetch('https://graph.facebook.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: metaAppId,
        client_secret: metaAppSecret,
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      return res.status(400).json({
        success: false,
        message: "Failed to generate access token. Please check your App ID and App Secret.",
        error: errorData.error?.message || "Token generation failed"
      });
    }

    const { access_token } = await tokenResponse.json();

    // Update user's access token
    await User.findByIdAndUpdate(user._id, {
      $set: {
        'whatsappConfig.accessToken': access_token,
        'whatsapp.accessToken': access_token
      }
    });

    whatsappLogger.info('GENERATE_TOKEN', 'New access token generated successfully', {
      userId: user._id,
      tokenLength: access_token.length
    });

    res.json({
      success: true,
      message: "New access token generated successfully",
      data: {
        accessToken: access_token
      }
    });

  } catch (error) {
    console.error('Error in generateWhatsAppToken:', error);
    whatsappLogger.error('GENERATE_TOKEN', 'Failed to generate access token', {
      error: error.message,
      userId: req.user._id
    });
    return next(error);
  }
};

// ==================== Template Management Endpoints ====================

/**
 * Create and submit a new WhatsApp message template for approval
 */
exports.createWhatsAppTemplate = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, language, category, components } = req.body;

    whatsappLogger.info('CREATE_TEMPLATE', 'Creating new WhatsApp template', {
      userId: userId.toString(),
      templateName: name,
      language,
      category
    });

    // Validate required fields
    if (!name || !language || !category || !components) {
      return res.status(400).json({
        success: false,
        message: 'Template name, language, category, and components are required'
      });
    }

    // Get user's WhatsApp configuration
    const user = await User.findById(userId).select('whatsapp');
    if (!user || !user.whatsapp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured. Please configure WhatsApp first.'
      });
    }

    const { businessAccountId, accessToken } = user.whatsapp;

    // Create template via Meta API
    const url = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`;

    const templateData = {
      name,
      language,
      category,
      components
    };

    whatsappLogger.apiRequest(url, templateData);

    const response = await axios.post(url, templateData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    whatsappLogger.success('CREATE_TEMPLATE', 'Template created and submitted for approval', {
      userId: userId.toString(),
      templateId: response.data.id,
      templateName: name,
      status: response.data.status
    });

    whatsappLogger.apiResponse(url, response.data, 'success');

    res.json({
      success: true,
      message: 'Template submitted for approval successfully',
      data: response.data
    });

  } catch (error) {
    whatsappLogger.error('CREATE_TEMPLATE', 'Failed to create template', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString()
    });

    const errorMessage = error.response?.data?.error?.message || error.message;
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to create template',
      error: errorMessage
    });
  }
};

/**
 * Get all message templates for the user's WhatsApp Business Account
 */
exports.getWhatsAppTemplatesList = async (req, res, next) => {
  try {
    const userId = req.user._id;

    whatsappLogger.info('GET_TEMPLATES_LIST', 'Fetching templates list', {
      userId: userId.toString()
    });

    // Get user's WhatsApp configuration
    const user = await User.findById(userId).select('whatsapp');
    if (!user || !user.whatsapp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured. Please configure WhatsApp first.'
      });
    }

    const { businessAccountId, accessToken } = user.whatsapp;

    // Get templates from Meta API
    const url = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        fields: 'name,status,category,language,components,rejected_reason,id'
      }
    });

    whatsappLogger.success('GET_TEMPLATES_LIST', 'Templates list fetched successfully', {
      userId: userId.toString(),
      count: response.data.data?.length || 0
    });

    res.json({
      success: true,
      templates: response.data.data || [],
      count: response.data.data?.length || 0
    });

  } catch (error) {
    whatsappLogger.error('GET_TEMPLATES_LIST', 'Failed to fetch templates list', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString()
    });

    const errorMessage = error.response?.data?.error?.message || error.message;
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: errorMessage
    });
  }
};

/**
 * Delete a WhatsApp message template
 */
exports.deleteWhatsAppTemplate = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { templateName } = req.params;

    whatsappLogger.info('DELETE_TEMPLATE', 'Deleting template', {
      userId: userId.toString(),
      templateName
    });

    // Get user's WhatsApp configuration
    const user = await User.findById(userId).select('whatsapp');
    if (!user || !user.whatsapp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured. Please configure WhatsApp first.'
      });
    }

    const { businessAccountId, accessToken } = user.whatsapp;

    // Delete template via Meta API
    const url = `https://graph.facebook.com/v22.0/${businessAccountId}/message_templates`;

    const response = await axios.delete(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        name: templateName
      }
    });

    whatsappLogger.success('DELETE_TEMPLATE', 'Template deleted successfully', {
      userId: userId.toString(),
      templateName
    });

    res.json({
      success: true,
      message: 'Template deleted successfully',
      data: response.data
    });

  } catch (error) {
    whatsappLogger.error('DELETE_TEMPLATE', 'Failed to delete template', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString(),
      templateName: req.params.templateName
    });

    const errorMessage = error.response?.data?.error?.message || error.message;
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to delete template',
      error: errorMessage
    });
  }
};

// ==================== Phone Number Management Endpoints ====================

/**
 * Add a new phone number to WhatsApp Business Account
 */
exports.addWhatsAppPhoneNumber = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { phoneNumber, verifiedName } = req.body;

    whatsappLogger.info('ADD_PHONE_NUMBER', 'Adding new phone number', {
      userId: userId.toString(),
      phoneNumber: phoneNumber ? phoneNumber.substring(0, 4) + '***' : null
    });

    // Validate required fields
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Get user's WhatsApp configuration
    const user = await User.findById(userId).select('whatsapp');
    if (!user || !user.whatsapp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured. Please configure WhatsApp first.'
      });
    }

    const { businessAccountId, accessToken } = user.whatsapp;

    // Parse phone number - expecting format like "19876543210" (country code + number)
    // Extract country code (1-3 digits) and phone number (rest)
    let cc, phone;

    // Common country code lengths: 1 digit (US/Canada), 2 digits (most countries), 3 digits (some countries)
    if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
      // US/Canada format: 1 + 10 digits
      cc = phoneNumber.substring(0, 1);
      phone = phoneNumber.substring(1);
    } else if (phoneNumber.length === 12 && (phoneNumber.startsWith('91') || phoneNumber.startsWith('44'))) {
      // India/UK format: 2 digits + 10 digits
      cc = phoneNumber.substring(0, 2);
      phone = phoneNumber.substring(2);
    } else if (phoneNumber.length === 13 && phoneNumber.startsWith('971')) {
      // UAE format: 3 digits + 9-10 digits
      cc = phoneNumber.substring(0, 3);
      phone = phoneNumber.substring(3);
    } else {
      // Default: last 10 digits are phone, rest is country code
      cc = phoneNumber.substring(0, phoneNumber.length - 10);
      phone = phoneNumber.substring(phoneNumber.length - 10);
    }

    // Add phone number via Meta API
    const url = `https://graph.facebook.com/v22.0/${businessAccountId}/phone_numbers`;

    const phoneData = {
      cc: cc,
      phone_number: phone,
      verified_name: verifiedName || 'Business'
    };

    whatsappLogger.info('ADD_PHONE_NUMBER', 'Parsed phone number', {
      userId: userId.toString(),
      originalLength: phoneNumber.length,
      cc: cc,
      phoneLength: phone.length,
      maskedPhone: phone.substring(0, 3) + '***' + phone.substring(phone.length - 3)
    });

    whatsappLogger.apiRequest(url, { ...phoneData, phone_number: '***' + phone.substring(phone.length - 4) });

    const response = await axios.post(url, phoneData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    whatsappLogger.success('ADD_PHONE_NUMBER', 'Phone number added successfully', {
      userId: userId.toString(),
      phoneNumberId: response.data.id
    });

    res.json({
      success: true,
      message: 'Phone number added successfully. Please verify it.',
      data: response.data
    });

  } catch (error) {
    // Log detailed error information
    whatsappLogger.error('ADD_PHONE_NUMBER', 'Failed to add phone number', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString(),
      statusCode: error.response?.status,
      errorDetails: JSON.stringify(error.response?.data)
    });

    // Extract detailed error message
    let errorMessage = 'Failed to add phone number';
    if (error.response?.data?.error) {
      const metaError = error.response.data.error;
      errorMessage = metaError.message || metaError.error_user_msg || errorMessage;

      // Log Meta API specific error
      whatsappLogger.error('META_API_ERROR', 'Meta API returned error for phone number addition', {
        code: metaError.code,
        type: metaError.type,
        message: metaError.message,
        fbtrace_id: metaError.fbtrace_id,
        error_subcode: metaError.error_subcode
      });
    }

    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to add phone number',
      error: errorMessage,
      details: error.response?.data?.error || error.message
    });
  }
};

/**
 * Request verification code for a phone number
 */
exports.requestPhoneVerificationCode = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { phoneNumberId, method } = req.body; // method: 'SMS' or 'VOICE'

    whatsappLogger.info('REQUEST_VERIFICATION_CODE', 'Requesting verification code', {
      userId: userId.toString(),
      phoneNumberId: phoneNumberId ? phoneNumberId.substring(0, 6) + '***' : null,
      method
    });

    // Get user's WhatsApp configuration
    const user = await User.findById(userId).select('whatsapp');
    if (!user || !user.whatsapp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured. Please configure WhatsApp first.'
      });
    }

    const { accessToken } = user.whatsapp;

    // Request verification code via Meta API
    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/request_code`;

    const response = await axios.post(url, {
      code_method: method || 'SMS'
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    whatsappLogger.success('REQUEST_VERIFICATION_CODE', 'Verification code sent successfully', {
      userId: userId.toString(),
      phoneNumberId: phoneNumberId ? phoneNumberId.substring(0, 6) + '***' : null
    });

    res.json({
      success: true,
      message: `Verification code sent via ${method || 'SMS'}`,
      data: response.data
    });

  } catch (error) {
    whatsappLogger.error('REQUEST_VERIFICATION_CODE', 'Failed to request verification code', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString()
    });

    const errorMessage = error.response?.data?.error?.message || error.message;
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to request verification code',
      error: errorMessage
    });
  }
};

/**
 * Verify a phone number with the received code
 */
exports.verifyPhoneNumber = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { phoneNumberId, code } = req.body;

    whatsappLogger.info('VERIFY_PHONE_NUMBER', 'Verifying phone number', {
      userId: userId.toString(),
      phoneNumberId: phoneNumberId ? phoneNumberId.substring(0, 6) + '***' : null
    });

    // Get user's WhatsApp configuration
    const user = await User.findById(userId).select('whatsapp');
    if (!user || !user.whatsapp?.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'WhatsApp not configured. Please configure WhatsApp first.'
      });
    }

    const { accessToken } = user.whatsapp;

    // Verify phone number via Meta API
    const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/verify_code`;

    const response = await axios.post(url, {
      code
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    whatsappLogger.success('VERIFY_PHONE_NUMBER', 'Phone number verified successfully', {
      userId: userId.toString(),
      phoneNumberId: phoneNumberId ? phoneNumberId.substring(0, 6) + '***' : null
    });

    res.json({
      success: true,
      message: 'Phone number verified successfully',
      data: response.data
    });

  } catch (error) {
    whatsappLogger.error('VERIFY_PHONE_NUMBER', 'Failed to verify phone number', {
      error: error.response?.data || error.message,
      userId: req.user._id.toString()
    });

    const errorMessage = error.response?.data?.error?.message || error.message;
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Failed to verify phone number',
      error: errorMessage
    });
  }
};