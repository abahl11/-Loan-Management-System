const router = require('express').Router();
const { body } = require('express-validator');
const { checkInput, mongoIdParam } = require('../guards/checkInput');
const { requireLogin, allowRoles } = require('../guards/auth');
const { ROLES } = require('../core/constants');
const types = require('../handlers/loanTypeHandler');

function typeRules(isNew) {
    const field = (name) => (isNew ? body(name) : body(name).optional());
    return [
        field('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name should be 2-60 characters'),
        field('code').trim().isAlphanumeric().isLength({ min: 2, max: 12 }).withMessage('Code should be 2-12 letters/numbers'),
        body('description').optional().trim().isLength({ max: 300 }),
        field('minAmount').isFloat({ min: 1 }).withMessage('minAmount must be a positive number').toFloat(),
        field('maxAmount').isFloat({ min: 1 }).withMessage('maxAmount must be a positive number').toFloat(),
        field('minTenure').isInt({ min: 1, max: 480 }).withMessage('minTenure must be 1-480 months').toInt(),
        field('maxTenure').isInt({ min: 1, max: 480 }).withMessage('maxTenure must be 1-480 months').toInt(),
        body('requiredDocuments').optional().isArray().withMessage('requiredDocuments must be a list'),
        body('requiredDocuments.*').optional().trim().notEmpty(),
        body('isActive').optional().isBoolean().toBoolean()
    ];
}

const rateRule = body('annualRate').isFloat({ min: 0, max: 50 }).withMessage('Rate must be between 0 and 50').toFloat();

router.use(requireLogin);

router.get('/', types.listTypes);
router.get('/:id', mongoIdParam(), checkInput, types.getType);

router.post('/', allowRoles(ROLES.ADMIN), [...typeRules(true), rateRule], checkInput, types.createType);
router.put('/:id', allowRoles(ROLES.ADMIN), mongoIdParam(), typeRules(false), checkInput, types.updateType);
router.patch('/:id/rate', allowRoles(ROLES.ADMIN), mongoIdParam(), rateRule, checkInput, types.setRate);
router.delete('/:id', allowRoles(ROLES.ADMIN), mongoIdParam(), checkInput, types.removeType);

module.exports = router;
