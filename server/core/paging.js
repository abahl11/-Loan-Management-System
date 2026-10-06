function readPaging(query = {}, maxLimit = 50) {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 10, 1), maxLimit);

    return { page, limit, skip: (page - 1) * limit };
}

function pageMeta(total, { page, limit }) {
    return {
        total,
        page,
        limit,
        pages: Math.max(Math.ceil(total / limit), 1)
    };
}

function escapeForRegex(text = '') {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { readPaging, pageMeta, escapeForRegex };
