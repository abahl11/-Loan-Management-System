const Role = require('../models/Role');
const User = require('../models/User');
const LoanType = require('../models/LoanType');
const settings = require('../config/settings');
const logger = require('../core/logger');
const { ROLES } = require('../core/constants');

const STARTER_ROLES = [
    { name: ROLES.ADMIN, title: 'Administrator', description: 'Manages users, loan types, interest rates and reports' },
    { name: ROLES.OFFICER, title: 'Loan Officer', description: 'Reviews, approves or rejects loan applications' },
    { name: ROLES.CUSTOMER, title: 'Customer', description: 'Applies for loans and repays them' }
];

const STARTER_LOAN_TYPES = [
    {
        name: 'Home Loan', code: 'HOME', annualRate: 7.25,
        minAmount: 500000, maxAmount: 20000000, minTenure: 12, maxTenure: 360,
        description: 'Buy or build a house',
        requiredDocuments: ['ID Proof', 'Address Proof', 'Income Proof', 'Property Papers']
    },
    {
        name: 'Personal Loan', code: 'PERSONAL', annualRate: 10,
        minAmount: 10000, maxAmount: 2500000, minTenure: 6, maxTenure: 60,
        description: 'For any personal need',
        requiredDocuments: ['ID Proof', 'Income Proof', 'Bank Statement']
    },
    {
        name: 'Education Loan', code: 'EDU', annualRate: 9.15,
        minAmount: 50000, maxAmount: 5000000, minTenure: 12, maxTenure: 120,
        description: 'Tuition and study expenses',
        requiredDocuments: ['ID Proof', 'Admission Letter', 'Fee Structure']
    },
    {
        name: 'Vehicle Loan', code: 'VEHICLE', annualRate: 8.7,
        minAmount: 50000, maxAmount: 3000000, minTenure: 12, maxTenure: 84,
        description: 'New or used car / two-wheeler',
        requiredDocuments: ['ID Proof', 'Income Proof', 'Vehicle Quotation']
    }
];

async function ensureUser({ fullName, email, password }, roleId) {
    const found = await User.findOne({ email }).setOptions({ withDeleted: true });
    if (found) return;

    const user = new User({ fullName, email, role: roleId });
    await user.setPassword(password);
    await user.save();
    logger.info(`seeded user ${email}`);
}

async function bootstrapData() {
    for (const role of STARTER_ROLES) {
        await Role.updateOne({ name: role.name }, { $setOnInsert: role }, { upsert: true });
    }
    const roles = await Role.find();
    const roleId = (name) => roles.find((r) => r.name === name)._id;

    await ensureUser(settings.firstAdmin, roleId(ROLES.ADMIN));

    if (settings.seedDemoUsers) {
        await ensureUser({ fullName: 'Demo Officer', email: 'officer@loandesk.com', password: 'Officer@123' }, roleId(ROLES.OFFICER));
        await ensureUser({ fullName: 'Demo Customer', email: 'customer@loandesk.com', password: 'Customer@123' }, roleId(ROLES.CUSTOMER));
    }

    const typeCount = await LoanType.countDocuments({}).setOptions({ withDeleted: true });
    if (typeCount === 0) {
        await LoanType.insertMany(STARTER_LOAN_TYPES.map((t) => ({ ...t, rateHistory: [{ rate: t.annualRate }] })));
        logger.info('seeded default loan types');
    }
}

module.exports = { bootstrapData };
