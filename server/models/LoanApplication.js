const { Schema, model } = require('mongoose');
const softDelete = require('../plugins/softDelete');
const { LOAN_STATUS, EMPLOYMENT_KINDS, ROLES } = require('../core/constants');

const remarkSchema = new Schema(
    {
        note: { type: String, required: true, trim: true },
        author: { type: Schema.Types.ObjectId, ref: 'User' },
        authorName: String,
        authorRole: { type: String, enum: Object.values(ROLES) },
        createdAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const loanApplicationSchema = new Schema(
    {
        refNo: { type: String, required: true, unique: true },
        customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        loanType: { type: Schema.Types.ObjectId, ref: 'LoanType', required: true },

        amount: { type: Number, required: true, min: 1 },
        tenureMonths: { type: Number, required: true, min: 1 },
        interestRate: { type: Number, required: true },
        emi: { type: Number, required: true },
        totalPayable: { type: Number, required: true },
        totalInterest: { type: Number, required: true },

        purpose: { type: String, trim: true, default: '' },
        monthlyIncome: { type: Number, default: 0 },
        employmentType: { type: String, enum: EMPLOYMENT_KINDS, default: 'salaried' },

        status: { type: String, enum: Object.values(LOAN_STATUS), default: LOAN_STATUS.PENDING, index: true },
        remarks: { type: [remarkSchema], default: [] },
        reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        decidedAt: { type: Date, default: null },
        closedAt: { type: Date, default: null },

        amountPaid: { type: Number, default: 0 },
        outstanding: { type: Number, default: 0 }
    },
    { timestamps: true }
);

loanApplicationSchema.plugin(softDelete);

loanApplicationSchema.statics.makeRefNo = function () {
    const stamp = Date.now().toString(36).toUpperCase();
    const tail = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `LN-${stamp}${tail}`;
};

module.exports = model('LoanApplication', loanApplicationSchema);
