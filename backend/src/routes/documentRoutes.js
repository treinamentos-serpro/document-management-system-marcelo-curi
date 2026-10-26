const express = require('express');
const controller = require('../controllers/documentController');
const { upload } = require('../repositories/documentRepository');

const router = express.Router();

router.post('/upload', upload, controller.uploadDocument, controller.uploadError);
router.get('/documents', controller.listDocuments);
router.get('/documents/:id/download', controller.downloadDocument);

module.exports = router;
