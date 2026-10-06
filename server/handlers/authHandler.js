const User = require('../models/User');
const Role = require('../models/Role');
const ApiProblem = require('../core/ApiProblem');
const safely = require('../core/safely');
const reply = require('../core/reply');
const logger = require('../core/logger');
const { ROLES } = require('../core/constants');
const { sessionFor } = require('../services/tokens');

const register = safely(async (req, res) => {
    const { fullName, email, password, phone } = req.body;

    const existing = await User.findOne({ email }).setOptions({ withDeleted: true });
    if (existing) throw ApiProblem.conflict('An account with this email already exists');

    const customerRole = await Role.findOne({ name: ROLES.CUSTOMER });
    const user = new User({ fullName, email, phone, role: customerRole._id });
    await user.setPassword(password);
    await user.save();

    logger.info('customer registered', { email: user.email });
    reply(res, sessionFor(user, ROLES.CUSTOMER), 201);
});

const login = safely(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash').populate('role');
    const passwordOk = user ? await user.passwordMatches(password) : false;
    if (!user || !passwordOk) throw ApiProblem.unauthorized('Wrong email or password');
    if (!user.isActive) throw ApiProblem.forbidden('This account has been disabled. Contact the admin.');

    user.lastLoginAt = new Date();
    await user.save();

    logger.info('user logged in', { email: user.email, role: user.role.name });
    reply(res, sessionFor(user, user.role.name));
});

const whoAmI = safely(async (req, res) => {
    reply(res, { ...req.user.toJSON(), role: req.role });
});

module.exports = { register, login, whoAmI };
