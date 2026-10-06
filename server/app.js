const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const settings = require('./config/settings');
const logger = require('./core/logger');
const apiDoc = require('./docs/openapi');
const apiRoutes = require('./routes');
const { unknownRoute, handleErrors } = require('./guards/errors');

const app = express();

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

if (settings.runMode !== 'test') {
    app.use(morgan(':method :url :status :response-time ms', { stream: logger.httpStream }));
}

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(apiDoc, { customSiteTitle: 'LoanDesk API' }));
app.get('/api-docs.json', (req, res) => res.json(apiDoc));

app.use('/api', apiRoutes);
app.use('/api', unknownRoute);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(handleErrors);

module.exports = app;
