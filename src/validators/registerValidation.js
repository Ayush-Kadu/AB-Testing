const { validationResult, check } = require("express-validator");

exports.isValidate = [

  check("email")
    .not()
    .isEmpty()
    .withMessage("Please enter your email id")
    .exists()
    .isEmail()
    .withMessage("Invalid email address found")
    .trim(),
  check("password")
    .not()
    .isEmpty()
    .withMessage("Password should not be blank")
    .isLength({ min: 8, max: 30 })
    .withMessage("Password should be more than 8 and less than 30 character")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/, "i")
    .withMessage("Please enter a strong password.")
    .trim(),
  function (req, res, next) {
    var errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        title: "An error occured",
        error: errors.array()
      });
    }
    next();
  },
];