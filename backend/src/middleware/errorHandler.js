const multer = require('multer');
const { DocumentError } = require('../services/documentService');

const operationErrors = {
  '/upload': ['UPLOAD_FAILED', 'Não foi possível enviar o documento.'],
  '/documents': ['DOCUMENT_LIST_FAILED', 'Não foi possível listar os documentos.'],
  '/documents/:id/download': ['DOWNLOAD_FAILED', 'Não foi possível baixar o documento.'],
};

function sendError(res, status, code, message) {
  res.removeHeader('Content-Disposition');
  res.removeHeader('Content-Length');
  res.removeHeader('Content-Range');
  return res.status(status).type('json').json({ error: { code, message } });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof DocumentError) {
    return sendError(res, error.code === 'DOCUMENT_NOT_FOUND' ? 404 : 400, error.code, error.message);
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 413, 'FILE_TOO_LARGE', 'O arquivo excede o limite permitido.');
    }
    return sendError(res, 400, 'INVALID_MULTIPART', 'Envie apenas um arquivo no campo file em multipart válido.');
  }
  if (error.code === 'INVALID_MULTIPART') {
    return sendError(res, 400, 'INVALID_MULTIPART', 'Envie apenas um arquivo no campo file em multipart válido.');
  }
  if (error.type === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_JSON', 'Envie um corpo JSON válido.');
  }
  if (error.type === 'entity.too.large') {
    return sendError(res, 413, 'REQUEST_TOO_LARGE', 'O corpo da requisição excede o limite permitido.');
  }
  if (error instanceof URIError && error.status === 400) {
    return sendError(res, 400, 'INVALID_URL', 'A URL da requisição é inválida.');
  }

  const [code, message] = operationErrors[req.route?.path] ??
    ['REQUEST_FAILED', 'Não foi possível concluir a requisição.'];
  console.error(message, error);
  return sendError(res, 500, code, message);
}

module.exports = errorHandler;
