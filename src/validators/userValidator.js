const { body, validationResult } = require('express-validator');
const validationError = require('./validators');

const userValidator = [
    body('firstName')
    .notEmpty().withMessage('First name is required.')
    .trim()
    .isLength({ min: 1 }).withMessage('First name must be a valid string.')
    .matches(/^[A-Za-z\s]+$/).withMessage('First name must contain only letters and spaces.'),

  body('lastName')
    .notEmpty().withMessage('Last name is required.')
    .trim()
    .isLength({ min: 1 }).withMessage('Last name must be a valid string.')
    .matches(/^[A-Za-z\s]+$/).withMessage('Last name must contain only letters and spaces.'),
  
//   body('websites')
//     .isArray({ min: 1 }).withMessage('At least one website is required.')
//     .custom((websites) => {
//       if (!websites.every(url => typeof url === 'string')) {
//         throw new Error('All websites must be valid URLs.');
//       }
//       return true;
//     }),

  body('email')
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email.'),

  body('mobileNumber')
    .optional()
    .isMobilePhone().withMessage('Please provide a valid mobile number.'),

  body('address1')
    .optional()
    .isString().withMessage('Address1 must be a string.'),

  body('address2')
    .optional()
    .isString().withMessage('Address2 must be a string.'),

  body('city')
    .optional()
    .isString().withMessage('City must be a string.'),

  body('state')
    .optional()
    .isString().withMessage('State must be a string.'),

  body('country')
    .optional()
    .isString().withMessage('Country must be a string.'),

  body('pinCode')
    .optional()
    .isNumeric().withMessage('Pin code must be a number.'),

  body('role')
    .optional()
    .isIn(['user', 'admin', 'template_manager']).withMessage('Role must be either user, admin, or template_manager.'),

  (req, res, next) => {
    const errors = validationResult(req);
    validationError(errors, next);
    next();
  }
];

module.exports = { userValidator };
