const express = require("express");
const { isValidate } = require("../validators/registerValidation");
const { register, login, logOut,getAllUsers, updateUserInfo, getAllUsersLoginHistory, getSingleUser,ForgotPasswordRequest,resetPassword } = require("../controllers/user.controller");
const { isAuthenticate } = require("../middlewares/auth");
const router = express.Router();

router.route("/register").post(isValidate, register);
router.route("/login").post(login);
router.route("/logout").post(logOut);
router.route("/userdata").get(getAllUsers);
router.route("/singleuser/:id").get(getSingleUser);

router.route("/update/:id").put(updateUserInfo);
router.route("/loginhistory").get(getAllUsersLoginHistory);

router.route('/forgotPassword').post(ForgotPasswordRequest);
router.route('/resetPassword/:token').patch(resetPassword);

module.exports=router; 