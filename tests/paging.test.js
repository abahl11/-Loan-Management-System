const { readPaging, pageMeta, escapeForRegex } = require('../server/core/paging');

describe('readPaging', () => {
    test('uses defaults when nothing is passed', () => {
        expect(readPaging({})).toEqual({ page: 1, limit: 10, skip: 0 });
    });

    test('computes skip from page and limit', () => {
        expect(readPaging({ page: '3', limit: '20' })).toEqual({ page: 3, limit: 20, skip: 40 });
    });

    test('clamps silly values', () => {
        expect(readPaging({ page: '-4', limit: '5000' })).toEqual({ page: 1, limit: 50, skip: 0 });
        expect(readPaging({ page: 'abc', limit: '0' }).limit).toBe(10);
    });
});

describe('pageMeta', () => {
    test('rounds pages up', () => {
        expect(pageMeta(21, { page: 1, limit: 10 })).toEqual({ total: 21, page: 1, limit: 10, pages: 3 });
    });

    test('always reports at least one page', () => {
        expect(pageMeta(0, { page: 1, limit: 10 }).pages).toBe(1);
    });
});

describe('escapeForRegex', () => {
    test('special characters are matched literally', () => {
        const pattern = new RegExp(escapeForRegex('a.b*(c)'));
        expect(pattern.test('a.b*(c)')).toBe(true);
        expect(pattern.test('axbbbc')).toBe(false);
    });
});
