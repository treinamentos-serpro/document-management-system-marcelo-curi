const service = require('../services/documentService');

async function uploadDocument(req, res) {
  const file = req.file && {
    originalName: req.file.originalname,
    size: req.file.size,
    storageKey: req.file.filename,
  };
  const document = await service.createDocument(file, req.ownerId);
  res.status(201).json({ document });
}

async function listDocuments(req, res) {
  const documents = await service.listDocuments(req.ownerId);
  res.json({ documents });
}

async function downloadDocument(req, res, next) {
  const { document, filePath } = await service.getDownload(req.params.id, req.ownerId);
  res.download(filePath, document.originalName, {
    headers: { 'Content-Type': 'application/octet-stream' },
  }, (error) => {
    if (!error) return;
    if (error.code === 'ENOENT') {
      return next(new service.DocumentError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.'));
    }
    next(error);
  });
}

module.exports = { uploadDocument, listDocuments, downloadDocument };
