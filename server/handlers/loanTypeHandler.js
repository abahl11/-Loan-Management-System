const LoanType = require('../models/LoanType');
const ApiProblem = require('../core/ApiProblem');
const safely = require('../core/safely');
const reply = require('../core/reply');
const { ROLES } = require('../core/constants');

const EDITABLE = ['name', 'code', 'description', 'minAmount', 'maxAmount', 'minTenure', 'maxTenure', 'requiredDocuments', 'isActive'];

function pickEditable(body) {
    const picked = {};
    EDITABLE.forEach((key) => {
        if (body[key] !== undefined) picked[key] = body[key];
    });
    return picked;
}

function checkRanges(type) {
    if (type.minAmount > type.maxAmount) throw ApiProblem.badInput('Minimum amount cannot be more than maximum amount');
    if (type.minTenure > type.maxTenure) throw ApiProblem.badInput('Minimum tenure cannot be more than maximum tenure');
}

const listTypes = safely(async (req, res) => {
    const filter = {};
    if (!(req.query.all === 'true' && req.role === ROLES.ADMIN)) filter.isActive = true;

    const types = await LoanType.find(filter).sort({ name: 1 });
    reply(res, types);
});

const getType = safely(async (req, res) => {
    const type = await LoanType.findById(req.params.id).populate('rateHistory.changedBy', 'fullName');
    if (!type) throw ApiProblem.notFound('Loan type not found');
    reply(res, type);
});

const createType = safely(async (req, res) => {
    const type = new LoanType({
        ...pickEditable(req.body),
        annualRate: req.body.annualRate,
        rateHistory: [{ rate: req.body.annualRate, changedBy: req.user._id }]
    });
    checkRanges(type);
    await type.save();
    reply(res, type, 201);
});

const updateType = safely(async (req, res) => {
    const type = await LoanType.findById(req.params.id);
    if (!type) throw ApiProblem.notFound('Loan type not found');

    type.set(pickEditable(req.body));
    checkRanges(type);
    await type.save();
    reply(res, type);
});

const setRate = safely(async (req, res) => {
    const type = await LoanType.findById(req.params.id);
    if (!type) throw ApiProblem.notFound('Loan type not found');

    type.annualRate = req.body.annualRate;
    type.rateHistory.push({ rate: req.body.annualRate, changedBy: req.user._id });
    await type.save();
    reply(res, type);
});

const removeType = safely(async (req, res) => {
    const type = await LoanType.findById(req.params.id);
    if (!type) throw ApiProblem.notFound('Loan type not found');

    type.isActive = false;
    await type.moveToTrash(req.user._id);
    reply(res, { id: type._id, deleted: true });
});

module.exports = { listTypes, getType, createType, updateType, setRate, removeType };
