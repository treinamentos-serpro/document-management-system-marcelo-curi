const service = require('../services/documentService');

function sendError(res, status, code, message) {
  res.removeHeader('Content-Disposition');
  return res.status(status).type('json').json({ error: { code, message } });
}

function handleError(error, res, next, code, message) {
  if (res.headersSent) return next(error);
  if (error instanceof service.DocumentError) {
    const status = error.code === 'DOCUMENT_NOT_FOUND' ? 404 : 400;
    return sendError(res, status, error.code, error.message);
  }
  console.error(message, error);
  return sendError(res, 500, code, message);
}

function uploadError(error, req, res, next) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 413, 'FILE_TOO_LARGE', 'O arquivo excede o limite permitido.');
  }
  if (error.name === 'MulterError' || error.message.startsWith('Multipart:') ||
      error.message === 'Unexpected end of form' ||
      error.message === 'Unexpected end of file' ||
      error.message === 'Malformed part header') {
    return sendError(res, 400, 'INVALID_MULTIPART', 'Envie apenas um arquivo no campo file em multipart válido.');
  }
  return handleError(error, res, next, 'UPLOAD_FAILED', 'Não foi possível enviar o documento.');
}

async function uploadDocument(req, res, next) {
  try {
    const document = await service.createDocument(req.file, req.ownerId);
    res.status(201).json({ document });
  } catch (error) {
    handleError(error, res, next, 'UPLOAD_FAILED', 'Não foi possível enviar o documento.');
  }
}

async function listDocuments(req, res, next) {
  try {
    const documents = await service.listDocuments(req.ownerId);
    res.json({ documents });
  } catch (error) {
    handleError(error, res, next, 'DOCUMENT_LIST_FAILED', 'Não foi possível listar os documentos.');
  }
}

async function downloadDocument(req, res, next) {
  try {
    const { document, filePath } = await service.getDownload(req.params.id, req.ownerId);
    res.download(filePath, document.originalName, {
      headers: { 'Content-Type': 'application/octet-stream' },
    }, (error) => {
      if (!error) return;
      if (error.code === 'ENOENT') {
        error = new service.DocumentError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
      }
      handleError(error, res, next, 'DOWNLOAD_FAILED', 'Não foi possível baixar o documento.');
    });
  } catch (error) {
    handleError(error, res, next, 'DOWNLOAD_FAILED', 'Não foi possível baixar o documento.');
  }
}

module.exports = { uploadError, uploadDocument, listDocuments, downloadDocument };
