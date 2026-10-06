const router = require('express').Router();
const { query } = require('express-validator');
const { checkInput } = require('../guards/checkInput');
const { requireLogin, allowRoles } = require('../guards/auth');
const { ROLES, LOAN_STATUS } = require('../core/constants');
const reports = require('../handlers/reportHandler');

router.use(requireLogin, allowRoles(ROLES.ADMIN));

router.get('/summary', reports.summary);
router.get(
    '/loans.csv',
    query('status').optional().isIn(Object.values(LOAN_STATUS)),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    checkInput,
    reports.exportLoansCsv
);

module.exports = router;
