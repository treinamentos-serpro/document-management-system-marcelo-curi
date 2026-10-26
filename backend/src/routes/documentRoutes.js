const express = require('express');
const controller = require('../controllers/documentController');
const { upload } = require('../repositories/documentRepository');

const router = express.Router();

router.post('/upload', controller.requireUser, upload, controller.uploadDocument, controller.uploadError);
router.get('/documents', controller.requireUser, controller.listDocuments);
router.get('/documents/:id/download', controller.requireUser, controller.downloadDocument);

module.exports = router;
