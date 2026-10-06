const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function checkInputs(principal, annualRate, months) {
    if (!(principal > 0)) throw new RangeError('Principal must be greater than 0');
    if (!(annualRate >= 0)) throw new RangeError('Interest rate cannot be negative');
    if (!Number.isInteger(months) || months < 1) throw new RangeError('Tenure must be a whole number of months');
}

function calculateEmi(principal, annualRate, months) {
    checkInputs(principal, annualRate, months);

    const r = annualRate / 12 / 100;
    if (r === 0) return round2(principal / months);

    const growth = Math.pow(1 + r, months);
    return round2((principal * r * growth) / (growth - 1));
}

function shiftMonths(fromDate, count) {
    const base = new Date(fromDate);
    const target = new Date(base.getFullYear(), base.getMonth() + count, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(base.getDate(), lastDay));
    return target;
}

function buildSchedule(principal, annualRate, months, startDate = new Date()) {
    const emi = calculateEmi(principal, annualRate, months);
    const r = annualRate / 12 / 100;
    const rows = [];
    let balance = principal;

    for (let no = 1; no <= months; no++) {
        const interestPart = round2(balance * r);
        let principalPart = round2(emi - interestPart);
        let amount = emi;

        if (no === months) {
            principalPart = round2(balance);
            amount = round2(principalPart + interestPart);
        }

        const openingBalance = round2(balance);
        balance = round2(balance - principalPart);

        rows.push({
            installmentNo: no,
            dueDate: shiftMonths(startDate, no),
            amount,
            principalPart,
            interestPart,
            openingBalance,
            closingBalance: Math.max(balance, 0)
        });
    }

    return rows;
}

function summarise(principal, annualRate, months) {
    const rows = buildSchedule(principal, annualRate, months);
    const totalPayable = round2(rows.reduce((sum, row) => sum + row.amount, 0));

    return {
        emi: rows[0].amount,
        totalPayable,
        totalInterest: round2(totalPayable - principal)
    };
}

module.exports = { round2, calculateEmi, buildSchedule, summarise, shiftMonths };
