const router = require('express').Router();
const { body } = require('express-validator');
const { checkInput } = require('../guards/checkInput');
const { requireLogin } = require('../guards/auth');
const { register, login, whoAmI } = require('../handlers/authHandler');

const emailRule = body('email').trim().isEmail().withMessage('Enter a valid email').toLowerCase();

router.post(
    '/register',
    [
        body('fullName').trim().isLength({ min: 2, max: 80 }).withMessage('Name should be 2-80 characters'),
        emailRule,
        body('password').isLength({ min: 6, max: 64 }).withMessage('Password should be at least 6 characters'),
        body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\- ]{7,15}$/).withMessage('Enter a valid phone number')
    ],
    checkInput,
    register
);

router.post(
    '/login',
    [emailRule, body('password').notEmpty().withMessage('Password is required')],
    checkInput,
    login
);

router.get('/me', requireLogin, whoAmI);

module.exports = router;
