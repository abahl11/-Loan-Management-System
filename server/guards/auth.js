const jwt = require('jsonwebtoken');
const settings = require('../config/settings');
const User = require('../models/User');
const ApiProblem = require('../core/ApiProblem');
const safely = require('../core/safely');

const requireLogin = safely(async (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw ApiProblem.unauthorized();

    let claims;
    try {
        claims = jwt.verify(token, settings.jwtSecret);
    } catch (err) {
        const why = err.name === 'TokenExpiredError' ? 'Session expired, please log in again' : 'Invalid token';
        throw ApiProblem.unauthorized(why);
    }

    const user = await User.findById(claims.sub).populate('role');
    if (!user || !user.isActive || !user.role) {
        throw ApiProblem.unauthorized('Account not found or disabled');
    }

    req.user = user;
    req.role = user.role.name;
    next();
});

function allowRoles(...roles) {
    return (req, res, next) => {
        if (!req.role) return next(ApiProblem.unauthorized());
        if (!roles.includes(req.role)) {
            return next(ApiProblem.forbidden(`This action needs one of these roles: ${roles.join(', ')}`));
        }
        next();
    };
}

module.exports = { requireLogin, allowRoles };
