class ApiProblem extends Error {
    constructor(statusCode, message, details) {
        super(message);
        this.name = 'ApiProblem';
        this.statusCode = statusCode;
        this.details = details;
    }

    static badInput(message, details) {
        return new ApiProblem(400, message, details);
    }

    static unauthorized(message = 'Please log in to continue') {
        return new ApiProblem(401, message);
    }

    static forbidden(message = 'You are not allowed to do this') {
        return new ApiProblem(403, message);
    }

    static notFound(message = 'Resource not found') {
        return new ApiProblem(404, message);
    }

    static conflict(message) {
        return new ApiProblem(409, message);
    }
}

module.exports = ApiProblem;
