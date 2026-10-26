const { randomUUID } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const multer = require('multer');
const { storageDirectory, maxFileSize } = require('../config/storage');

mkdirSync(storageDirectory, { recursive: true });

const parseUpload = multer({
  storage: multer.diskStorage({
    destination: storageDirectory,
    filename: (req, file, callback) => callback(null, randomUUID()),
  }),
  // O parser sinaliza truncamento ao atingir os limites de bytes, não apenas ao excedê-los.
  limits: {
    fileSize: maxFileSize + 1,
    files: 1,
    fields: 10,
    fieldSize: 1025,
    parts: 12,
  },
}).single('file');

function upload(req, res, next) {
  parseUpload(req, res, (error) => {
    // Busboy não atribui códigos aos erros sintáticos de multipart.
    if (error && !(error instanceof multer.MulterError) && typeof error.message === 'string' &&
        (/^Multipart:/.test(error.message) ||
         ['Unexpected end of form', 'Unexpected end of file', 'Malformed part header'].includes(error.message))) {
      error.code = 'INVALID_MULTIPART';
    }
    next(error);
  });
}

module.exports = upload;
