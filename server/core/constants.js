const ROLES = Object.freeze({
    ADMIN: 'admin',
    OFFICER: 'officer',
    CUSTOMER: 'customer'
});

const STAFF_ROLES = [ROLES.ADMIN, ROLES.OFFICER];

const LOAN_STATUS = Object.freeze({
    PENDING: 'pending',
    IN_REVIEW: 'under_review',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    CLOSED: 'closed'
});

const OPEN_STATUSES = [LOAN_STATUS.PENDING, LOAN_STATUS.IN_REVIEW];

const PAYMENT_MODES = ['upi', 'card', 'netbanking', 'cash'];
const EMPLOYMENT_KINDS = ['salaried', 'self_employed', 'student', 'other'];

module.exports = {
    ROLES,
    STAFF_ROLES,
    LOAN_STATUS,
    OPEN_STATUSES,
    PAYMENT_MODES,
    EMPLOYMENT_KINDS
};
