const { validationResult, param } = require('express-validator');
const ApiProblem = require('../core/ApiProblem');

function checkInput(req, res, next) {
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    const details = result.array().map((issue) => ({ field: issue.path, message: issue.msg }));
    next(new ApiProblem(422, 'Some fields are invalid', details));
}

const mongoIdParam = (name = 'id') => param(name).isMongoId().withMessage('Invalid id in URL');

module.exports = { checkInput, mongoIdParam };
