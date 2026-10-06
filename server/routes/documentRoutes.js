const router = require('express').Router();
const { checkInput, mongoIdParam } = require('../guards/checkInput');
const { requireLogin } = require('../guards/auth');
const docs = require('../handlers/documentHandler');

router.use(requireLogin);

router.get('/:docId/download', mongoIdParam('docId'), checkInput, docs.downloadDocument);
router.delete('/:docId', mongoIdParam('docId'), checkInput, docs.removeDocument);

module.exports = router;
