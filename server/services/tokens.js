const jwt = require('jsonwebtoken');
const settings = require('../config/settings');

function issueToken(user, roleName) {
    return jwt.sign({ sub: String(user._id), role: roleName }, settings.jwtSecret, {
        expiresIn: settings.jwtLifetime
    });
}

function sessionFor(user, roleName) {
    return {
        token: issueToken(user, roleName),
        user: {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            role: roleName
        }
    };
}

module.exports = { issueToken, sessionFor };
