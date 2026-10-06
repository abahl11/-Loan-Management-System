const LoanApplication = require('../models/LoanApplication');
const ApiProblem = require('../core/ApiProblem');
const { ROLES } = require('../core/constants');

const ANY_STATE = { isDeleted: { $in: [true, false] } };

const withType = { path: 'loanType', select: 'name code', match: ANY_STATE };
const withCustomer = { path: 'customer', select: 'fullName email phone', match: ANY_STATE };

async function fetchLoanForViewer(loanId, req, { populate = true } = {}) {
    const query = LoanApplication.findById(loanId);
    if (populate) query.populate(withType).populate(withCustomer);

    const loan = await query;
    if (!loan) throw ApiProblem.notFound('Loan application not found');

    if (req.role === ROLES.CUSTOMER) {
        const ownerId = loan.customer && loan.customer._id ? loan.customer._id : loan.customer;

                if (String(ownerId) !== String(req.user._id)) throw ApiProblem.notFound('Loan application not found');
    }

    return loan;
}

module.exports = { fetchLoanForViewer, withType, withCustomer, ANY_STATE };
