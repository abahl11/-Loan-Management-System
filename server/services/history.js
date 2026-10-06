const LoanHistory = require('../models/LoanHistory');
const logger = require('../core/logger');

async function addHistory(loanId, action, actorId, { from = null, to = null, note = '' } = {}) {
    logger.info(`loan ${loanId}: ${action}`, from || to ? { from, to } : undefined);
    return LoanHistory.create({ loan: loanId, action, actor: actorId, fromStatus: from, toStatus: to, note });
}

module.exports = { addHistory };
