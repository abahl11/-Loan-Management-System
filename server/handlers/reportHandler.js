const User = require('../models/User');
const Role = require('../models/Role');
const LoanType = require('../models/LoanType');
const LoanApplication = require('../models/LoanApplication');
const Payment = require('../models/Payment');
const safely = require('../core/safely');
const reply = require('../core/reply');
const { round2 } = require('../core/emi');
const { LOAN_STATUS } = require('../core/constants');
const { withType, withCustomer } = require('../services/loanAccess');

const NOT_DELETED = { isDeleted: { $ne: true } };
const DISBURSED = [LOAN_STATUS.APPROVED, LOAN_STATUS.CLOSED];

const summary = safely(async (req, res) => {
    const [usersByRole, loansByStatus, byType, paid] = await Promise.all([
        User.aggregate([
            { $match: NOT_DELETED },
            { $lookup: { from: Role.collection.name, localField: 'role', foreignField: '_id', as: 'r' } },
            { $unwind: '$r' },
            { $group: { _id: '$r.name', count: { $sum: 1 } } }
        ]),
        LoanApplication.aggregate([
            { $match: NOT_DELETED },
            { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' }, outstanding: { $sum: '$outstanding' } } }
        ]),
        LoanApplication.aggregate([
            { $match: NOT_DELETED },
            {
                $group: {
                    _id: '$loanType',
                    applications: { $sum: 1 },
                    requested: { $sum: '$amount' },
                    approved: { $sum: { $cond: [{ $in: ['$status', DISBURSED] }, 1, 0] } },
                    disbursed: { $sum: { $cond: [{ $in: ['$status', DISBURSED] }, '$amount', 0] } }
                }
            },
            { $lookup: { from: LoanType.collection.name, localField: '_id', foreignField: '_id', as: 't' } },
            { $unwind: '$t' },
            { $project: { _id: 0, name: '$t.name', code: '$t.code', applications: 1, requested: 1, approved: 1, disbursed: 1 } },
            { $sort: { applications: -1 } }
        ]),
        Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }])
    ]);

    const statusMap = {};
    Object.values(LOAN_STATUS).forEach((s) => { statusMap[s] = { count: 0, amount: 0 }; });
    loansByStatus.forEach((row) => { statusMap[row._id] = { count: row.count, amount: row.amount }; });

    const running = loansByStatus.find((row) => row._id === LOAN_STATUS.APPROVED);
    const disbursed = loansByStatus.filter((row) => DISBURSED.includes(row._id)).reduce((sum, row) => sum + row.amount, 0);

    reply(res, {
        users: Object.fromEntries(usersByRole.map((row) => [row._id, row.count])),
        loansByStatus: statusMap,
        byLoanType: byType,
        totals: {
            applications: loansByStatus.reduce((sum, row) => sum + row.count, 0),
            disbursed: round2(disbursed),
            collected: round2(paid[0] ? paid[0].total : 0),
            payments: paid[0] ? paid[0].count : 0,
            outstanding: round2(running ? running.outstanding : 0)
        }
    });
});

const csvCell = (value) => {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const exportLoansCsv = safely(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
        filter.createdAt = {};
        if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
        if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999`);
    }

    const loans = await LoanApplication.find(filter).populate(withType).populate(withCustomer).sort({ createdAt: -1 });

    const header = ['Reference', 'Customer', 'Email', 'Loan Type', 'Amount', 'Tenure (m)', 'Rate %', 'EMI', 'Status', 'Paid', 'Outstanding', 'Applied On'];
    const lines = loans.map((l) => [
        l.refNo,
        l.customer ? l.customer.fullName : '',
        l.customer ? l.customer.email : '',
        l.loanType ? l.loanType.name : '',
        l.amount,
        l.tenureMonths,
        l.interestRate,
        l.emi,
        l.status,
        l.amountPaid,
        l.outstanding,
        l.createdAt.toISOString().slice(0, 10)
    ].map(csvCell).join(','));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="loans-report-${Date.now()}.csv"`);
    res.send([header.join(','), ...lines].join('\n'));
});

module.exports = { summary, exportLoansCsv };
