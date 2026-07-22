const {body, validationResult } = require('express-validator')
const ErrorHandler = require('../utils/errorHandler')
const validationError = require('./validators')

const createOrderValidator = [
    body('amount').notEmpty().withMessage('Amount is required.').isNumeric().withMessage('Please Provide valid amount'),
    body('currency').notEmpty().withMessage('Currency is required').isString().withMessage('Please provide a valid currency.'),
    body('name').notEmpty().withMessage('Name is required').isString().withMessage('Please provide a valid name.'),
    (req, res, next)=>{
        const errors = validationResult(req)
        console.log('errors: ', errors);
        validationError(errors, next)
        next()
    }
]


module.exports = { createOrderValidator }