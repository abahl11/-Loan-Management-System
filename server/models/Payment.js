const { Schema, model } = require('mongoose');
const { PAYMENT_MODES } = require('../core/constants');

const paymentSchema = new Schema(
    {
        loan: { type: Schema.Types.ObjectId, ref: 'LoanApplication', required: true, index: true },
        payer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        amount: { type: Number, required: true, min: 0 },
        mode: { type: String, enum: PAYMENT_MODES, required: true },
        kind: { type: String, enum: ['emi', 'foreclosure'], default: 'emi' },
        installments: { type: [Number], default: [] },
        txnRef: { type: String, required: true, unique: true },
        paidAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

module.exports = model('Payment', paymentSchema);
