const EmiInstallment = require('../models/EmiInstallment');
const Payment = require('../models/Payment');
const safely = require('../core/safely');
const reply = require('../core/reply');
const { readPaging, pageMeta } = require('../core/paging');
const { fetchLoanForViewer } = require('../services/loanAccess');
const { takePayment } = require('../services/repayment');

const getSchedule = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });
    const rows = await EmiInstallment.find({ loan: loan._id }).sort({ installmentNo: 1 });

    reply(res, {
        loanId: loan._id,
        status: loan.status,
        emi: loan.emi,
        paidCount: rows.filter((row) => row.status !== 'due').length,
        rows
    });
});

const repayLoan = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });

    const result = await takePayment(loan, req.user, {
        count: req.body.installments || 1,
        mode: req.body.mode,
        settleAll: Boolean(req.body.settleAll)
    });

    reply(res, result, 201);
});

const listPayments = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });
    const paging = readPaging(req.query);

    const [payments, total] = await Promise.all([
        Payment.find({ loan: loan._id }).sort({ paidAt: -1 }).skip(paging.skip).limit(paging.limit),
        Payment.countDocuments({ loan: loan._id })
    ]);

    reply(res, payments, 200, pageMeta(total, paging));
});

module.exports = { getSchedule, repayLoan, listPayments };
