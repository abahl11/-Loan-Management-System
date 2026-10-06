const mongoose = require('mongoose');
const app = require('./app');
const settings = require('./config/settings');
const logger = require('./core/logger');
const { bootstrapData } = require('./seed/bootstrap');

async function launch() {
    await mongoose.connect(settings.mongoUrl);
    logger.info('connected to MongoDB');

    await bootstrapData();

    app.listen(settings.port, () => {
        logger.info(`LoanDesk running on port ${settings.port} (${settings.runMode})`);
        logger.info(`API docs at /api-docs`);
    });
}

launch().catch((err) => {
    logger.error('could not start the server', { message: err.message });
    process.exit(1);
});
