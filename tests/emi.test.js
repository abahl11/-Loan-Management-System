const { calculateEmi, buildSchedule, summarise, shiftMonths, round2 } = require('../server/core/emi');

describe('calculateEmi', () => {
    test('matches the standard formula for 1 lakh at 12% for 12 months', () => {
        expect(calculateEmi(100000, 12, 12)).toBe(8884.88);
    });

    test('home-loan sized numbers', () => {
        expect(calculateEmi(2500000, 8.5, 240)).toBe(21695.58);
    });

    test('zero interest just splits the principal', () => {
        expect(calculateEmi(12000, 0, 12)).toBe(1000);
    });

    test('rejects bad input', () => {
        expect(() => calculateEmi(0, 10, 12)).toThrow(RangeError);
        expect(() => calculateEmi(1000, -1, 12)).toThrow(RangeError);
        expect(() => calculateEmi(1000, 10, 2.5)).toThrow(RangeError);
    });
});

describe('buildSchedule', () => {
    const rows = buildSchedule(100000, 12, 12, new Date(2026, 0, 15));

    test('has one row per month', () => {
        expect(rows).toHaveLength(12);
        expect(rows[0].installmentNo).toBe(1);
        expect(rows[11].installmentNo).toBe(12);
    });

    test('principal parts add up to the loan amount and balance ends at zero', () => {
        const principalSum = round2(rows.reduce((s, r) => s + r.principalPart, 0));
        expect(principalSum).toBe(100000);
        expect(rows[11].closingBalance).toBe(0);
    });

    test('first month interest is 1% of the principal', () => {
        expect(rows[0].interestPart).toBe(1000);
        expect(rows[0].principalPart).toBe(7884.88);
    });

    test('due dates move one month at a time', () => {
        expect(rows[0].dueDate.getMonth()).toBe(1);
        expect(rows[0].dueDate.getDate()).toBe(15);
        expect(rows[11].dueDate.getFullYear()).toBe(2027);
    });
});

describe('summarise', () => {
    test('total interest = total payable - principal', () => {
        const s = summarise(100000, 12, 12);
        expect(s.emi).toBe(8884.88);
        expect(s.totalInterest).toBe(round2(s.totalPayable - 100000));
        expect(s.totalPayable).toBeCloseTo(106618.55, 1);
    });
});

describe('shiftMonths', () => {
    test('31 Jan + 1 month lands on the last day of February', () => {
        const d = shiftMonths(new Date(2026, 0, 31), 1);
        expect(d.getMonth()).toBe(1);
        expect(d.getDate()).toBe(28);
    });
});
