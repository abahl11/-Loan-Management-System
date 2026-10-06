function reply(res, data, statusCode = 200, meta) {
    const body = { success: true, data };
    if (meta) body.meta = meta;
    return res.status(statusCode).json(body);
}

module.exports = reply;
