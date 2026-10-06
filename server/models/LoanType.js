const { Schema, model } = require('mongoose');
const softDelete = require('../plugins/softDelete');

const rateChangeSchema = new Schema(
    {
        rate: { type: Number, required: true },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const loanTypeSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        code: { type: String, required: true, uppercase: true, trim: true, unique: true },
        description: { type: String, default: '' },
        annualRate: { type: Number, required: true, min: 0, max: 50 },
        minAmount: { type: Number, required: true, min: 1 },
        maxAmount: { type: Number, required: true },
        minTenure: { type: Number, required: true, min: 1 },
        maxTenure: { type: Number, required: true },
        requiredDocuments: { type: [String], default: [] },
        isActive: { type: Boolean, default: true },
        rateHistory: { type: [rateChangeSchema], default: [] }
    },
    { timestamps: true }
);

loanTypeSchema.plugin(softDelete);

module.exports = model('LoanType', loanTypeSchema);
