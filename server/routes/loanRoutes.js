const router = require('express').Router();
const { body, query } = require('express-validator');
const { checkInput, mongoIdParam } = require('../guards/checkInput');
const { requireLogin, allowRoles } = require('../guards/auth');
const { singleFile } = require('../guards/upload');
const { ROLES, STAFF_ROLES, LOAN_STATUS, EMPLOYMENT_KINDS, PAYMENT_MODES } = require('../core/constants');
const loans = require('../handlers/loanHandler');
const docs = require('../handlers/documentHandler');
const payments = require('../handlers/paymentHandler');
const { downloadStatement } = require('../handlers/statementHandler');

const staffOnly = allowRoles(...STAFF_ROLES);
const customerOnly = allowRoles(ROLES.CUSTOMER);
const idCheck = [mongoIdParam(), checkInput];

const listRules = [
    query('status').optional().isIn(Object.values(LOAN_STATUS)).withMessage('Unknown status'),
    query('loanType').optional().isMongoId().withMessage('Invalid loan type id'),
    query('minAmount').optional().isFloat({ min: 0 }),
    query('maxAmount').optional().isFloat({ min: 0 }),
    query('from').optional().isISO8601().withMessage('from must be a date (YYYY-MM-DD)'),
    query('to').optional().isISO8601().withMessage('to must be a date (YYYY-MM-DD)'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
];

const applyRules = [
    body('loanTypeId').isMongoId().withMessage('Choose a loan type'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number').toFloat(),
    body('tenureMonths').isInt({ min: 1, max: 480 }).withMessage('Tenure must be 1-480 months').toInt(),
    body('purpose').optional().trim().isLength({ max: 300 }),
    body('monthlyIncome').optional().isFloat({ min: 0 }).toFloat(),
    body('employmentType').optional().isIn(EMPLOYMENT_KINDS).withMessage('Unknown employment type')
];

const editRules = [
    body('amount').optional().isFloat({ min: 1 }).toFloat(),
    body('tenureMonths').optional().isInt({ min: 1, max: 480 }).toInt(),
    body('interestRate').optional().isFloat({ min: 0, max: 50 }).toFloat(),
    body('purpose').optional().trim().isLength({ max: 300 })
];

router.use(requireLogin);

router.get('/', listRules, checkInput, loans.listLoans);
router.post('/', customerOnly, applyRules, checkInput, loans.applyForLoan);
router.get('/:id', idCheck, loans.getLoan);

router.put('/:id', staffOnly, mongoIdParam(), editRules, checkInput, loans.updateLoan);
router.delete('/:id', staffOnly, idCheck, loans.removeLoan);
router.patch('/:id/review', staffOnly, idCheck, loans.startReview);
router.post(
    '/:id/decision',
    staffOnly,
    mongoIdParam(),
    body('decision').isIn(['approve', 'reject']).withMessage('decision must be approve or reject'),
    body('remark').optional().trim().isLength({ max: 500 }),
    checkInput,
    loans.decideLoan
);
router.post(
    '/:id/remarks',
    staffOnly,
    mongoIdParam(),
    body('note').trim().isLength({ min: 1, max: 500 }).withMessage('Remark should be 1-500 characters'),
    checkInput,
    loans.addRemark
);

router.get('/:id/documents', idCheck, docs.listDocuments);
router.post('/:id/documents', idCheck, singleFile, docs.uploadDocument);

router.get('/:id/schedule', idCheck, payments.getSchedule);
router.get('/:id/payments', idCheck, payments.listPayments);
router.post(
    '/:id/repayments',
    customerOnly,
    mongoIdParam(),
    body('mode').isIn(PAYMENT_MODES).withMessage(`mode must be one of: ${PAYMENT_MODES.join(', ')}`),
    body('installments').optional().isInt({ min: 1, max: 480 }).toInt(),
    body('settleAll').optional().isBoolean().toBoolean(),
    checkInput,
    payments.repayLoan
);
router.get('/:id/statement', idCheck, downloadStatement);

module.exports = router;
