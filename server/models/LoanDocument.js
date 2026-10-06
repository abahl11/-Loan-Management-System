const { Schema, model } = require('mongoose');
const softDelete = require('../plugins/softDelete');

const loanDocumentSchema = new Schema(
    {
        loan: { type: Schema.Types.ObjectId, ref: 'LoanApplication', required: true, index: true },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        docType: { type: String, required: true, trim: true },
        originalName: { type: String, required: true },
        storedName: { type: String, required: true },
        mimeType: { type: String, required: true },
        sizeBytes: { type: Number, required: true }
    },
    { timestamps: true }
);

loanDocumentSchema.plugin(softDelete);

loanDocumentSchema.set('toJSON', {
    transform(doc, out) {
        delete out.storedName;
        delete out.__v;
        return out;
    }
});

module.exports = model('LoanDocument', loanDocumentSchema);
