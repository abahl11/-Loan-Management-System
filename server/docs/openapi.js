const secured = [{ bearerAuth: [] }];
const pathId = (name = 'id') => ({ name, in: 'path', required: true, schema: { type: 'string' } });
const q = (name, description, type = 'string', extra = {}) => ({ name, in: 'query', required: false, description, schema: { type, ...extra } });
const paging = [q('page', 'Page number', 'integer'), q('limit', 'Items per page (max 50)', 'integer')];

const jsonBody = (properties, required = []) => ({
    required: true,
    content: { 'application/json': { schema: { type: 'object', properties, required } } }
});

const commonErrors = {
    401: { description: 'Missing or invalid token' },
    403: { description: 'Role not allowed' },
    422: { description: 'Validation failed' }
};
const ok = (description = 'Success') => ({ 200: { description }, ...commonErrors });
const created = (description = 'Created') => ({ 201: { description }, ...commonErrors });

const str = { type: 'string' };
const num = { type: 'number' };
const int = { type: 'integer' };
const bool = { type: 'boolean' };
const statusEnum = { type: 'string', enum: ['pending', 'under_review', 'approved', 'rejected', 'closed'] };

const loanTypeProps = {
    name: str, code: str, description: str, annualRate: num,
    minAmount: num, maxAmount: num, minTenure: int, maxTenure: int,
    requiredDocuments: { type: 'array', items: str }, isActive: bool
};

module.exports = {
    openapi: '3.0.3',
    info: {
        title: 'LoanDesk - Loan Management API',
        version: '1.0.0',
        description: 'Roles: admin, officer, customer. Log in, copy the token, press "Authorize" and paste it.\n\n'
            + 'Demo users: admin@loandesk.com / Admin@123, officer@loandesk.com / Officer@123, customer@loandesk.com / Customer@123'
    },
    servers: [{ url: '/api' }],
    components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
    },
    tags: [
        { name: 'Auth' }, { name: 'Loan Types' }, { name: 'Loans' }, { name: 'Documents' },
        { name: 'Repayment' }, { name: 'EMI' }, { name: 'Users (admin)' }, { name: 'Reports (admin)' }
    ],
    paths: {
        '/auth/register': {
            post: {
                tags: ['Auth'], summary: 'Register as a customer',
                requestBody: jsonBody({ fullName: str, email: str, password: str, phone: str }, ['fullName', 'email', 'password']),
                responses: { 201: { description: 'Account created, returns token' }, 409: { description: 'Email taken' }, 422: { description: 'Validation failed' } }
            }
        },
        '/auth/login': {
            post: {
                tags: ['Auth'], summary: 'Log in (any role)',
                requestBody: jsonBody({ email: str, password: str }, ['email', 'password']),
                responses: { 200: { description: 'Returns JWT token and user' }, 401: { description: 'Wrong credentials' } }
            }
        },
        '/auth/me': {
            get: { tags: ['Auth'], summary: 'Current user profile', security: secured, responses: ok() }
        },

        '/loan-types': {
            get: { tags: ['Loan Types'], summary: 'List loan types', security: secured, parameters: [q('all', 'Admin only: include inactive (true)')], responses: ok() },
            post: { tags: ['Loan Types'], summary: 'Create loan type (admin)', security: secured, requestBody: jsonBody(loanTypeProps, ['name', 'code', 'annualRate', 'minAmount', 'maxAmount', 'minTenure', 'maxTenure']), responses: created() }
        },
        '/loan-types/{id}': {
            get: { tags: ['Loan Types'], summary: 'Loan type with rate history', security: secured, parameters: [pathId()], responses: ok() },
            put: { tags: ['Loan Types'], summary: 'Update loan type (admin)', security: secured, parameters: [pathId()], requestBody: jsonBody(loanTypeProps), responses: ok() },
            delete: { tags: ['Loan Types'], summary: 'Soft delete loan type (admin)', security: secured, parameters: [pathId()], responses: ok() }
        },
        '/loan-types/{id}/rate': {
            patch: { tags: ['Loan Types'], summary: 'Configure interest rate (admin)', security: secured, parameters: [pathId()], requestBody: jsonBody({ annualRate: num }, ['annualRate']), responses: ok() }
        },

        '/loans': {
            get: {
                tags: ['Loans'], summary: 'List loans (customer: own, staff: all)', security: secured,
                parameters: [
                    q('status', 'Filter by status', 'string', { enum: statusEnum.enum }),
                    q('loanType', 'Loan type id'), q('search', 'Ref no / purpose / customer name or email'),
                    q('minAmount', 'Minimum amount', 'number'), q('maxAmount', 'Maximum amount', 'number'),
                    q('from', 'Applied on/after (YYYY-MM-DD)'), q('to', 'Applied on/before (YYYY-MM-DD)'),
                    q('sortBy', 'createdAt | amount | status | tenureMonths'), q('order', 'asc | desc'),
                    ...paging
                ],
                responses: ok()
            },
            post: {
                tags: ['Loans'], summary: 'Apply for a loan (customer)', security: secured,
                requestBody: jsonBody({ loanTypeId: str, amount: num, tenureMonths: int, purpose: str, monthlyIncome: num, employmentType: { type: 'string', enum: ['salaried', 'self_employed', 'student', 'other'] } }, ['loanTypeId', 'amount', 'tenureMonths']),
                responses: created()
            }
        },
        '/loans/{id}': {
            get: { tags: ['Loans'], summary: 'Loan details with documents and history', security: secured, parameters: [pathId()], responses: ok() },
            put: { tags: ['Loans'], summary: 'Edit open application (officer/admin)', security: secured, parameters: [pathId()], requestBody: jsonBody({ amount: num, tenureMonths: int, interestRate: num, purpose: str }), responses: ok() },
            delete: { tags: ['Loans'], summary: 'Soft delete application (officer/admin)', security: secured, parameters: [pathId()], responses: ok() }
        },
        '/loans/{id}/review': {
            patch: { tags: ['Loans'], summary: 'Move pending -> under_review (officer/admin)', security: secured, parameters: [pathId()], responses: ok() }
        },
        '/loans/{id}/decision': {
            post: { tags: ['Loans'], summary: 'Approve or reject (officer/admin)', security: secured, parameters: [pathId()], requestBody: jsonBody({ decision: { type: 'string', enum: ['approve', 'reject'] }, remark: str }, ['decision']), responses: ok() }
        },
        '/loans/{id}/remarks': {
            post: { tags: ['Loans'], summary: 'Add remark (officer/admin)', security: secured, parameters: [pathId()], requestBody: jsonBody({ note: str }, ['note']), responses: created() }
        },
        '/loans/{id}/documents': {
            get: { tags: ['Documents'], summary: 'List documents of a loan', security: secured, parameters: [pathId()], responses: ok() },
            post: {
                tags: ['Documents'], summary: 'Upload a document (PDF/JPG/PNG, max 5 MB)', security: secured, parameters: [pathId()],
                requestBody: {
                    required: true,
                    content: { 'multipart/form-data': { schema: { type: 'object', properties: { docType: str, file: { type: 'string', format: 'binary' } }, required: ['docType', 'file'] } } }
                },
                responses: created()
            }
        },
        '/documents/{docId}/download': {
            get: { tags: ['Documents'], summary: 'Download a document', security: secured, parameters: [pathId('docId')], responses: ok('File stream') }
        },
        '/documents/{docId}': {
            delete: { tags: ['Documents'], summary: 'Soft delete a document', security: secured, parameters: [pathId('docId')], responses: ok() }
        },
        '/loans/{id}/schedule': {
            get: { tags: ['Repayment'], summary: 'EMI schedule', security: secured, parameters: [pathId()], responses: ok() }
        },
        '/loans/{id}/repayments': {
            post: {
                tags: ['Repayment'], summary: 'Pay EMI(s) or foreclose (customer, simulated)', security: secured, parameters: [pathId()],
                requestBody: jsonBody({ mode: { type: 'string', enum: ['upi', 'card', 'netbanking', 'cash'] }, installments: int, settleAll: bool }, ['mode']),
                responses: created()
            }
        },
        '/loans/{id}/payments': {
            get: { tags: ['Repayment'], summary: 'Payment history', security: secured, parameters: [pathId(), ...paging], responses: ok() }
        },
        '/loans/{id}/statement': {
            get: { tags: ['Repayment'], summary: 'Download loan statement (PDF)', security: secured, parameters: [pathId()], responses: ok('PDF file') }
        },

        '/emi/calculate': {
            post: { tags: ['EMI'], summary: 'EMI calculator', security: secured, requestBody: jsonBody({ amount: num, annualRate: num, tenureMonths: int, includeSchedule: bool }, ['amount', 'annualRate', 'tenureMonths']), responses: ok() }
        },

        '/users/roles': {
            get: { tags: ['Users (admin)'], summary: 'List roles', security: secured, responses: ok() }
        },
        '/users': {
            get: {
                tags: ['Users (admin)'], summary: 'List users', security: secured,
                parameters: [q('search', 'Name / email / phone'), q('role', 'admin | officer | customer'), q('active', 'true | false'), q('deleted', 'include | only'), ...paging],
                responses: ok()
            },
            post: { tags: ['Users (admin)'], summary: 'Create user with any role', security: secured, requestBody: jsonBody({ fullName: str, email: str, password: str, phone: str, role: str }, ['fullName', 'email', 'password', 'role']), responses: created() }
        },
        '/users/{id}': {
            put: { tags: ['Users (admin)'], summary: 'Update user (name, phone, role, active, password)', security: secured, parameters: [pathId()], requestBody: jsonBody({ fullName: str, phone: str, role: str, isActive: bool, password: str }), responses: ok() },
            delete: { tags: ['Users (admin)'], summary: 'Soft delete user', security: secured, parameters: [pathId()], responses: ok() }
        },
        '/users/{id}/restore': {
            patch: { tags: ['Users (admin)'], summary: 'Restore soft-deleted user', security: secured, parameters: [pathId()], responses: ok() }
        },

        '/reports/summary': {
            get: { tags: ['Reports (admin)'], summary: 'Dashboard numbers', security: secured, responses: ok() }
        },
        '/reports/loans.csv': {
            get: { tags: ['Reports (admin)'], summary: 'Export loans as CSV', security: secured, parameters: [q('status', 'Filter by status'), q('from', 'YYYY-MM-DD'), q('to', 'YYYY-MM-DD')], responses: ok('CSV file') }
        }
    }
};
