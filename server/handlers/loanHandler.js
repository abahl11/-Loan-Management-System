const LoanApplication = require('../models/LoanApplication');
const LoanType = require('../models/LoanType');
const LoanDocument = require('../models/LoanDocument');
const LoanHistory = require('../models/LoanHistory');
const User = require('../models/User');
const ApiProblem = require('../core/ApiProblem');
const safely = require('../core/safely');
const reply = require('../core/reply');
const { summarise } = require('../core/emi');
const { readPaging, pageMeta, escapeForRegex } = require('../core/paging');
const { ROLES, LOAN_STATUS, OPEN_STATUSES } = require('../core/constants');
const { addHistory } = require('../services/history');
const { createSchedule } = require('../services/repayment');
const { fetchLoanForViewer, withType, withCustomer, ANY_STATE } = require('../services/loanAccess');

function checkLimits(type, amount, tenureMonths) {
    if (amount < type.minAmount || amount > type.maxAmount) {
        throw ApiProblem.badInput(`${type.name}: amount must be between ${type.minAmount} and ${type.maxAmount}`);
    }
    if (tenureMonths < type.minTenure || tenureMonths > type.maxTenure) {
        throw ApiProblem.badInput(`${type.name}: tenure must be between ${type.minTenure} and ${type.maxTenure} months`);
    }
}

function makeRemark(req, note) {
    return { note, author: req.user._id, authorName: req.user.fullName, authorRole: req.role };
}

const applyForLoan = safely(async (req, res) => {
    const { loanTypeId, amount, tenureMonths, purpose, monthlyIncome, employmentType } = req.body;

    const type = await LoanType.findOne({ _id: loanTypeId, isActive: true });
    if (!type) throw ApiProblem.notFound('This loan type is not available');
    checkLimits(type, amount, tenureMonths);

    const figures = summarise(amount, type.annualRate, tenureMonths);
    const loan = await LoanApplication.create({
        refNo: LoanApplication.makeRefNo(),
        customer: req.user._id,
        loanType: type._id,
        amount,
        tenureMonths,
        interestRate: type.annualRate,
        ...figures,
        purpose,
        monthlyIncome,
        employmentType
    });

    await addHistory(loan._id, 'APPLIED', req.user._id, {
        to: LOAN_STATUS.PENDING,
        note: `${type.name} of ${amount} for ${tenureMonths} months`
    });
    reply(res, loan, 201);
});

async function buildFilter(query, req) {
    const filter = {};
    const isCustomer = req.role === ROLES.CUSTOMER;

    if (isCustomer) filter.customer = req.user._id;
    if (query.status) filter.status = query.status;
    if (query.loanType) filter.loanType = query.loanType;

    if (query.minAmount || query.maxAmount) {
        filter.amount = {};
        if (query.minAmount) filter.amount.$gte = Number(query.minAmount);
        if (query.maxAmount) filter.amount.$lte = Number(query.maxAmount);
    }

    if (query.from || query.to) {
        filter.createdAt = {};
        if (query.from) filter.createdAt.$gte = new Date(query.from);
        if (query.to) {
            const end = new Date(query.to);
            end.setHours(23, 59, 59, 999);
            filter.createdAt.$lte = end;
        }
    }

    if (query.search && query.search.trim()) {
        const pattern = new RegExp(escapeForRegex(query.search.trim()), 'i');
        const anyOf = [{ refNo: pattern }, { purpose: pattern }];

        if (!isCustomer) {
            const people = await User.find({ $or: [{ fullName: pattern }, { email: pattern }] })
                .select('_id')
                .setOptions({ withDeleted: true });
            anyOf.push({ customer: { $in: people.map((p) => p._id) } });
        }
        filter.$or = anyOf;
    }

    return filter;
}

const SORTABLE = ['createdAt', 'amount', 'status', 'tenureMonths'];

const listLoans = safely(async (req, res) => {
    const paging = readPaging(req.query);
    const filter = await buildFilter(req.query, req);

    const sortField = SORTABLE.includes(req.query.sortBy) ? req.query.sortBy : 'createdAt';
    const direction = req.query.order === 'asc' ? 1 : -1;

    const [loans, total] = await Promise.all([
        LoanApplication.find(filter)
            .populate(withType)
            .populate(withCustomer)
            .sort({ [sortField]: direction })
            .skip(paging.skip)
            .limit(paging.limit),
        LoanApplication.countDocuments(filter)
    ]);

    reply(res, loans, 200, pageMeta(total, paging));
});

const getLoan = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req);

    const [documents, history] = await Promise.all([
        LoanDocument.find({ loan: loan._id }).sort({ createdAt: -1 }),
        LoanHistory.find({ loan: loan._id })
            .populate({ path: 'actor', select: 'fullName', match: ANY_STATE })
            .sort({ createdAt: -1 })
    ]);

    reply(res, { loan, documents, history });
});

const startReview = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });
    if (loan.status !== LOAN_STATUS.PENDING) throw ApiProblem.badInput('Only pending applications can be moved to review');

    loan.status = LOAN_STATUS.IN_REVIEW;
    loan.reviewedBy = req.user._id;
    await loan.save();

    await addHistory(loan._id, 'REVIEW_STARTED', req.user._id, { from: LOAN_STATUS.PENDING, to: LOAN_STATUS.IN_REVIEW });
    reply(res, loan);
});

const decideLoan = safely(async (req, res) => {
    const { decision, remark } = req.body;
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });

    if (!OPEN_STATUSES.includes(loan.status)) throw ApiProblem.badInput('This application has already been decided');
    if (decision === 'reject' && !remark) throw ApiProblem.badInput('Please give a reason when rejecting');

    const fromStatus = loan.status;
    if (remark) loan.remarks.push(makeRemark(req, remark));
    loan.reviewedBy = req.user._id;
    loan.decidedAt = new Date();

    if (decision === 'approve') {
        loan.status = LOAN_STATUS.APPROVED;
        await createSchedule(loan);
    } else {
        loan.status = LOAN_STATUS.REJECTED;
    }
    await loan.save();

    await addHistory(loan._id, decision === 'approve' ? 'APPROVED' : 'REJECTED', req.user._id, {
        from: fromStatus,
        to: loan.status,
        note: remark || ''
    });
    reply(res, loan);
});

const addRemark = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });

    loan.remarks.push(makeRemark(req, req.body.note));
    await loan.save();

    await addHistory(loan._id, 'REMARK_ADDED', req.user._id, { note: req.body.note });
    reply(res, loan.remarks, 201);
});

const updateLoan = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });
    if (!OPEN_STATUSES.includes(loan.status)) throw ApiProblem.badInput('Only open applications can be edited');

    const type = await LoanType.findOne({ _id: loan.loanType, ...ANY_STATE });
    const amount = req.body.amount ?? loan.amount;
    const tenureMonths = req.body.tenureMonths ?? loan.tenureMonths;
    const interestRate = req.body.interestRate ?? loan.interestRate;
    if (type) checkLimits(type, amount, tenureMonths);

    Object.assign(loan, { amount, tenureMonths, interestRate }, summarise(amount, interestRate, tenureMonths));
    if (req.body.purpose !== undefined) loan.purpose = req.body.purpose;
    await loan.save();

    await addHistory(loan._id, 'UPDATED', req.user._id, {
        note: `amount ${amount}, tenure ${tenureMonths}m, rate ${interestRate}%`
    });
    reply(res, loan);
});

const removeLoan = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });
    if (loan.status === LOAN_STATUS.APPROVED) {
        throw ApiProblem.badInput('A running loan cannot be deleted. It must be closed first.');
    }

    await loan.moveToTrash(req.user._id);
    await addHistory(loan._id, 'DELETED', req.user._id, { from: loan.status });
    reply(res, { id: loan._id, deleted: true });
});

module.exports = {
    applyForLoan,
    listLoans,
    getLoan,
    startReview,
    decideLoan,
    addRemark,
    updateLoan,
    removeLoan
};
