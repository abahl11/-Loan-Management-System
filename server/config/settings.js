const path = require('path');
require('dotenv').config();

const runMode = process.env.NODE_ENV || 'development';

const settings = {
    runMode,
    port: Number(process.env.PORT) || 5000,
    mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/loan_desk',

    jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
    jwtLifetime: process.env.JWT_EXPIRES_IN || '1d',

    uploadDir: path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')),
    maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 5,

    firstAdmin: {
        fullName: process.env.ADMIN_NAME || 'System Admin',
        email: process.env.ADMIN_EMAIL || 'admin@loandesk.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123'
    },
    seedDemoUsers: process.env.SEED_DEMO_USERS !== 'false'
};

if (runMode === 'production' && !process.env.JWT_SECRET) {
    console.warn('[settings] JWT_SECRET is not set - using an insecure fallback secret');
}

module.exports = settings;
