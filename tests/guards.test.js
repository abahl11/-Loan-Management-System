const { body } = require('express-validator');
const { allowRoles } = require('../server/guards/auth');
const { checkInput } = require('../server/guards/checkInput');
const { handleErrors } = require('../server/guards/errors');
const ApiProblem = require('../server/core/ApiProblem');

function fakeRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

describe('allowRoles', () => {
    test('lets a matching role through', () => {
        const next = jest.fn();
        allowRoles('admin', 'officer')({ role: 'officer' }, {}, next);
        expect(next).toHaveBeenCalledWith();
    });

    test('blocks other roles with 403', () => {
        const next = jest.fn();
        allowRoles('admin')({ role: 'customer' }, {}, next);
        expect(next.mock.calls[0][0]).toBeInstanceOf(ApiProblem);
        expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    test('asks for login when no role is set', () => {
        const next = jest.fn();
        allowRoles('admin')({}, {}, next);
        expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
});

describe('checkInput', () => {
    test('collects validation messages into a 422 error', async () => {
        const req = { body: { email: 'not-an-email' } };
        await body('email').isEmail().withMessage('Enter a valid email').run(req);

        const next = jest.fn();
        checkInput(req, {}, next);

        const err = next.mock.calls[0][0];
        expect(err.statusCode).toBe(422);
        expect(err.details).toEqual([{ field: 'email', message: 'Enter a valid email' }]);
    });

    test('passes when input is fine', async () => {
        const req = { body: { email: 'a@b.com' } };
        await body('email').isEmail().run(req);

        const next = jest.fn();
        checkInput(req, {}, next);
        expect(next).toHaveBeenCalledWith();
    });
});

describe('handleErrors', () => {
    const req = { method: 'GET', originalUrl: '/api/test' };

    test('uses the status of an ApiProblem', () => {
        const res = fakeRes();
        handleErrors(ApiProblem.notFound('Loan not found'), req, res, () => {});
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Loan not found' });
    });

    test('maps duplicate key errors to 409', () => {
        const res = fakeRes();
        handleErrors({ code: 11000, keyValue: { email: 'x@y.com' } }, req, res, () => {});
        expect(res.status).toHaveBeenCalledWith(409);
    });

    test('maps bad ObjectId casts to 400', () => {
        const res = fakeRes();
        handleErrors({ name: 'CastError', path: '_id' }, req, res, () => {});
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('hides internal error details', () => {
        const res = fakeRes();
        const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
        handleErrors(new Error('db password is hunter2'), req, res, () => {});
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].message).toBe('Something went wrong on our side');
        spy.mockRestore();
    });
});
