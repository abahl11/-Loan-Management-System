const safely = require('../core/safely');
const reply = require('../core/reply');
const { summarise, buildSchedule } = require('../core/emi');

const calculate = safely(async (req, res) => {
    const { amount, annualRate, tenureMonths, includeSchedule } = req.body;
    const result = { amount, annualRate, tenureMonths, ...summarise(amount, annualRate, tenureMonths) };

    if (includeSchedule) result.schedule = buildSchedule(amount, annualRate, tenureMonths);
    reply(res, result);
});

module.exports = { calculate };
