const crypto = require('crypto');
const EmiInstallment = require('../models/EmiInstallment');
const Payment = require('../models/Payment');
const ApiProblem = require('../core/ApiProblem');
const { buildSchedule, round2 } = require('../core/emi');
const { LOAN_STATUS } = require('../core/constants');
const { addHistory } = require('./history');

async function createSchedule(loan, startDate = new Date()) {
    await EmiInstallment.deleteMany({ loan: loan._id });

    const rows = buildSchedule(loan.amount, loan.interestRate, loan.tenureMonths, startDate);
    await EmiInstallment.insertMany(rows.map((row) => ({ ...row, loan: loan._id })));

    const totalPayable = round2(rows.reduce((sum, row) => sum + row.amount, 0));
    loan.emi = rows[0].amount;
    loan.totalPayable = totalPayable;
    loan.totalInterest = round2(totalPayable - loan.amount);
    loan.amountPaid = 0;
    loan.outstanding = totalPayable;

    return rows;
}

const newTxnRef = () => `TXN${Date.now()}${crypto.randomInt(100, 999)}`;

async function takePayment(loan, payer, { count = 1, mode, settleAll = false }) {
    if (loan.status !== LOAN_STATUS.APPROVED) {
        throw ApiProblem.badInput('Repayment is only possible on an approved, running loan');
    }

    const dues = await EmiInstallment.find({ loan: loan._id, status: 'due' }).sort({ installmentNo: 1 });
    if (!dues.length) throw ApiProblem.badInput('Nothing is due on this loan');

    let picked;
    let amount;
    let kind = 'emi';

    if (settleAll) {
        picked = dues;
        amount = round2(dues[0].openingBalance + dues[0].interestPart);
        kind = 'foreclosure';
    } else {
        if (count > dues.length) {
            throw ApiProblem.badInput(`Only ${dues.length} instalment(s) are left to pay`);
        }
        picked = dues.slice(0, count);
        amount = round2(picked.reduce((sum, row) => sum + row.amount, 0));
    }

    const payment = await Payment.create({
        loan: loan._id,
        payer: payer._id,
        amount,
        mode,
        kind,
        installments: picked.map((row) => row.installmentNo),
        txnRef: newTxnRef()
    });

    const [first, ...rest] = picked;
    const markFirst = { status: 'paid', paidAt: payment.paidAt, payment: payment._id };
    const markRest = { status: settleAll ? 'foreclosed' : 'paid', paidAt: payment.paidAt, payment: payment._id };
    await EmiInstallment.updateOne({ _id: first._id }, { $set: markFirst });
    if (rest.length) {
        await EmiInstallment.updateMany({ _id: { $in: rest.map((row) => row._id) } }, { $set: markRest });
    }

    const stillDue = dues.slice(picked.length);
    const fromStatus = loan.status;

    loan.amountPaid = round2(loan.amountPaid + amount);
    loan.outstanding = round2(stillDue.reduce((sum, row) => sum + row.amount, 0));
    if (!stillDue.length) {
        loan.status = LOAN_STATUS.CLOSED;
        loan.closedAt = new Date();
    }
    await loan.save();

    const label = settleAll ? 'Foreclosure' : `EMI #${payment.installments.join(', #')}`;
    await addHistory(loan._id, 'PAYMENT', payer._id, { note: `${label} paid via ${mode} (${payment.txnRef})` });
    if (loan.status === LOAN_STATUS.CLOSED) {
        await addHistory(loan._id, 'CLOSED', payer._id, { from: fromStatus, to: LOAN_STATUS.CLOSED, note: 'All dues cleared' });
    }

    return { payment, loan };
}

module.exports = { createSchedule, takePayment };
