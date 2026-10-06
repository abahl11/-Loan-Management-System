const router = require('express').Router();
const { body } = require('express-validator');
const { checkInput } = require('../guards/checkInput');
const { requireLogin } = require('../guards/auth');
const { calculate } = require('../handlers/emiHandler');

router.post(
    '/calculate',
    requireLogin,
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number').toFloat(),
    body('annualRate').isFloat({ min: 0, max: 50 }).withMessage('Rate must be between 0 and 50').toFloat(),
    body('tenureMonths').isInt({ min: 1, max: 480 }).withMessage('Tenure must be 1-480 months').toInt(),
    body('includeSchedule').optional().isBoolean().toBoolean(),
    checkInput,
    calculate
);

module.exports = router;
