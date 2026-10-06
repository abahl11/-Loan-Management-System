const router = require('express').Router();
const { body, query } = require('express-validator');
const { checkInput, mongoIdParam } = require('../guards/checkInput');
const { requireLogin, allowRoles } = require('../guards/auth');
const { ROLES } = require('../core/constants');
const users = require('../handlers/userHandler');

const roleNames = Object.values(ROLES);

router.use(requireLogin, allowRoles(ROLES.ADMIN));

router.get('/roles', users.listRoles);

router.get(
    '/',
    query('role').optional().isIn(roleNames),
    query('deleted').optional().isIn(['include', 'only']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    checkInput,
    users.listUsers
);

router.post(
    '/',
    [
        body('fullName').trim().isLength({ min: 2, max: 80 }).withMessage('Name should be 2-80 characters'),
        body('email').trim().isEmail().withMessage('Enter a valid email').toLowerCase(),
        body('password').isLength({ min: 6, max: 64 }).withMessage('Password should be at least 6 characters'),
        body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\- ]{7,15}$/).withMessage('Enter a valid phone number'),
        body('role').isIn(roleNames).withMessage(`role must be one of: ${roleNames.join(', ')}`)
    ],
    checkInput,
    users.createUser
);

router.put(
    '/:id',
    mongoIdParam(),
    [
        body('fullName').optional().trim().isLength({ min: 2, max: 80 }),
        body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\- ]{7,15}$/).withMessage('Enter a valid phone number'),
        body('role').optional().isIn(roleNames),
        body('isActive').optional().isBoolean().toBoolean(),
        body('password').optional({ values: 'falsy' }).isLength({ min: 6, max: 64 })
    ],
    checkInput,
    users.updateUser
);

router.delete('/:id', mongoIdParam(), checkInput, users.removeUser);
router.patch('/:id/restore', mongoIdParam(), checkInput, users.restoreUser);

module.exports = router;
