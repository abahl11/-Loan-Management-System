const User = require('../models/User');
const Role = require('../models/Role');
const ApiProblem = require('../core/ApiProblem');
const safely = require('../core/safely');
const reply = require('../core/reply');
const { readPaging, pageMeta, escapeForRegex } = require('../core/paging');

async function roleIdFor(name) {
    const role = await Role.findOne({ name });
    if (!role) throw ApiProblem.badInput(`Unknown role "${name}"`);
    return role._id;
}

const listRoles = safely(async (req, res) => {
    reply(res, await Role.find().sort({ name: 1 }));
});

const listUsers = safely(async (req, res) => {
    const { search, role, active, deleted } = req.query;
    const paging = readPaging(req.query);
    const filter = {};

    if (role) filter.role = await roleIdFor(role);
    if (active === 'true' || active === 'false') filter.isActive = active === 'true';
    if (deleted === 'only') filter.isDeleted = true;
    if (search && search.trim()) {
        const pattern = new RegExp(escapeForRegex(search.trim()), 'i');
        filter.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }];
    }

    const options = deleted === 'include' ? { withDeleted: true } : {};
    const [users, total] = await Promise.all([
        User.find(filter).setOptions(options).populate('role', 'name title')
            .sort({ createdAt: -1 }).skip(paging.skip).limit(paging.limit),
        User.countDocuments(filter).setOptions(options)
    ]);

    reply(res, users, 200, pageMeta(total, paging));
});

const createUser = safely(async (req, res) => {
    const { fullName, email, password, phone, role } = req.body;

    const existing = await User.findOne({ email }).setOptions({ withDeleted: true });
    if (existing) throw ApiProblem.conflict('An account with this email already exists');

    const user = new User({ fullName, email, phone, role: await roleIdFor(role) });
    await user.setPassword(password);
    await user.save();
    await user.populate('role', 'name title');

    reply(res, user, 201);
});

const updateUser = safely(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw ApiProblem.notFound('User not found');

    const isSelf = String(user._id) === String(req.user._id);
    const { fullName, phone, role, isActive, password } = req.body;

    if (isSelf && (isActive === false || (role && role !== req.role))) {
        throw ApiProblem.badInput('You cannot disable or change the role of your own account');
    }

    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (role) user.role = await roleIdFor(role);
    if (password) await user.setPassword(password);

    await user.save();
    await user.populate('role', 'name title');
    reply(res, user);
});

const removeUser = safely(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) throw ApiProblem.badInput('You cannot delete your own account');

    const user = await User.findById(req.params.id);
    if (!user) throw ApiProblem.notFound('User not found');

    await user.moveToTrash(req.user._id);
    reply(res, { id: user._id, deleted: true });
});

const restoreUser = safely(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, isDeleted: true });
    if (!user) throw ApiProblem.notFound('No deleted user with this id');

    await user.restoreFromTrash();
    await user.populate('role', 'name title');
    reply(res, user);
});

module.exports = { listRoles, listUsers, createUser, updateUser, removeUser, restoreUser };
