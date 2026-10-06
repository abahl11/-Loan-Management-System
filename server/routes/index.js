const router = require('express').Router();

router.get('/health', (req, res) => {
    res.json({ success: true, data: { status: 'up', time: new Date().toISOString() } });
});

router.use('/auth', require('./authRoutes'));
router.use('/loan-types', require('./loanTypeRoutes'));
router.use('/loans', require('./loanRoutes'));
router.use('/documents', require('./documentRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/emi', require('./emiRoutes'));

module.exports = router;
