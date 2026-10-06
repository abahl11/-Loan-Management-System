const multer = require('multer');
const ApiProblem = require('../core/ApiProblem');
const logger = require('../core/logger');
const settings = require('../config/settings');

function unknownRoute(req, res, next) {
    next(ApiProblem.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

function handleErrors(err, req, res, next) {
    let status = err.statusCode || 500;
    let message = err.message;
    let details = err.details;

    if (err.name === 'ValidationError') {
        status = 422;
        message = 'Validation failed';
        details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    } else if (err.name === 'CastError') {
        status = 400;
        message = `Invalid value for ${err.path}`;
    } else if (err.code === 11000) {
        status = 409;
        message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(', ') || 'a unique field'}`;
    } else if (err instanceof multer.MulterError) {
        status = 400;
        message = err.code === 'LIMIT_FILE_SIZE' ? `File is larger than ${settings.maxUploadMb} MB` : err.message;
    } else if (err.type === 'entity.parse.failed') {
        status = 400;
        message = 'Request body is not valid JSON';
    } else if (err instanceof RangeError) {
        status = 400;
    }

    if (status >= 500) {
        logger.error(`${req.method} ${req.originalUrl} crashed`, { message: err.message, stack: err.stack });
        message = 'Something went wrong on our side';
    } else {
        logger.debug(`${req.method} ${req.originalUrl} -> ${status} ${message}`);
    }

    const body = { success: false, message };
    if (details) body.details = details;
    res.status(status).json(body);
}

module.exports = { unknownRoute, handleErrors };
