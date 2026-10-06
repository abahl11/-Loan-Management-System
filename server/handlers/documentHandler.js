const fs = require('fs');
const path = require('path');
const LoanDocument = require('../models/LoanDocument');
const ApiProblem = require('../core/ApiProblem');
const safely = require('../core/safely');
const reply = require('../core/reply');
const settings = require('../config/settings');
const { ROLES, OPEN_STATUSES } = require('../core/constants');
const { addHistory } = require('../services/history');
const { fetchLoanForViewer } = require('../services/loanAccess');

const forgetFile = (file) => {
    if (file) fs.unlink(file.path, () => {});
};

const uploadDocument = safely(async (req, res) => {
    if (!req.file) throw ApiProblem.badInput('Attach a file in the "file" field');

    try {
        const docType = String(req.body.docType || '').trim();
        if (!docType) throw ApiProblem.badInput('docType is required (for example "ID Proof")');

        const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });
        if (req.role === ROLES.CUSTOMER && !OPEN_STATUSES.includes(loan.status)) {
            throw ApiProblem.badInput('Documents can only be added while the application is open');
        }

        const saved = await LoanDocument.create({
            loan: loan._id,
            uploadedBy: req.user._id,
            docType,
            originalName: req.file.originalname,
            storedName: req.file.filename,
            mimeType: req.file.mimetype,
            sizeBytes: req.file.size
        });

        await addHistory(loan._id, 'DOCUMENT_UPLOADED', req.user._id, { note: `${docType}: ${req.file.originalname}` });
        reply(res, saved, 201);
    } catch (err) {
        forgetFile(req.file);
        throw err;
    }
});

const listDocuments = safely(async (req, res) => {
    const loan = await fetchLoanForViewer(req.params.id, req, { populate: false });
    const documents = await LoanDocument.find({ loan: loan._id }).sort({ createdAt: -1 });
    reply(res, documents);
});

async function loadDocument(req) {
    const doc = await LoanDocument.findById(req.params.docId);
    if (!doc) throw ApiProblem.notFound('Document not found');
    const loan = await fetchLoanForViewer(doc.loan, req, { populate: false });
    return { doc, loan };
}

const downloadDocument = safely(async (req, res) => {
    const { doc } = await loadDocument(req);

    const filePath = path.join(settings.uploadDir, doc.storedName);
    if (!fs.existsSync(filePath)) throw ApiProblem.notFound('The file is no longer on the server');

    res.download(filePath, doc.originalName);
});

const removeDocument = safely(async (req, res) => {
    const { doc, loan } = await loadDocument(req);

    if (req.role === ROLES.CUSTOMER && !OPEN_STATUSES.includes(loan.status)) {
        throw ApiProblem.badInput('Documents of a decided application cannot be removed');
    }

    await doc.moveToTrash(req.user._id);
    await addHistory(loan._id, 'DOCUMENT_REMOVED', req.user._id, { note: doc.docType });
    reply(res, { id: doc._id, deleted: true });
});

module.exports = { uploadDocument, listDocuments, downloadDocument, removeDocument };
