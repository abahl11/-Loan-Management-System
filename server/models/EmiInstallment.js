const { Schema, model } = require('mongoose');

const emiInstallmentSchema = new Schema(
    {
        loan: { type: Schema.Types.ObjectId, ref: 'LoanApplication', required: true },
        installmentNo: { type: Number, required: true },
        dueDate: { type: Date, required: true },
        amount: { type: Number, required: true },
        principalPart: { type: Number, required: true },
        interestPart: { type: Number, required: true },
        openingBalance: { type: Number, required: true },
        closingBalance: { type: Number, required: true },
        status: { type: String, enum: ['due', 'paid', 'foreclosed'], default: 'due' },
        paidAt: { type: Date, default: null },
        payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null }
    },
    { timestamps: true, collection: 'emi_schedules' }
);

emiInstallmentSchema.index({ loan: 1, installmentNo: 1 }, { unique: true });

module.exports = model('EmiInstallment', emiInstallmentSchema);
