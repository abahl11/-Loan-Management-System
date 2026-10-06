const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const settings = require('../config/settings');
const ApiProblem = require('../core/ApiProblem');

fs.mkdirSync(settings.uploadDir, { recursive: true });

const ALLOWED_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png'
};

const storage = multer.diskStorage({
    destination: (req, file, done) => done(null, settings.uploadDir),
    filename: (req, file, done) => {
        const randomPart = crypto.randomBytes(8).toString('hex');
        done(null, `${Date.now()}-${randomPart}${ALLOWED_TYPES[file.mimetype]}`);
    }
});

const acceptFile = (req, file, done) => {
    if (ALLOWED_TYPES[file.mimetype]) return done(null, true);
    done(ApiProblem.badInput('Only PDF, JPG and PNG files are allowed'));
};

const singleFile = multer({
    storage,
    fileFilter: acceptFile,
    limits: { fileSize: settings.maxUploadMb * 1024 * 1024 }
}).single('file');

module.exports = { singleFile };
