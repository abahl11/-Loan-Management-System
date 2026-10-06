const { Schema, model } = require('mongoose');

const loanHistorySchema = new Schema(
    {
        loan: { type: Schema.Types.ObjectId, ref: 'LoanApplication', required: true, index: true },
        action: { type: String, required: true },
        fromStatus: { type: String, default: null },
        toStatus: { type: String, default: null },
        actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        note: { type: String, default: '' }
    },
    { timestamps: { createdAt: true, updatedAt: false }, collection: 'loan_history' }
);

module.exports = model('LoanHistory', loanHistorySchema);
