const { randomUUID } = require('node:crypto');
const { mkdirSync } = require('node:fs');
const { stat, unlink } = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');

const storageDirectory = path.resolve(__dirname, '../../storage');
const configuredLimit = process.env.MAX_FILE_SIZE_BYTES ?? '10485760';
const maxFileSize = Number(configuredLimit);

if (!/^[0-9]+$/.test(configuredLimit) || !Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
  throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo seguro.');
}

mkdirSync(storageDirectory, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: storageDirectory,
    filename: (req, file, callback) => callback(null, randomUUID()),
  }),
  // O parser emite LIMIT_FILE_SIZE ao atingir o valor, não apenas ao excedê-lo.
  limits: { fileSize: maxFileSize + 1, files: 1 },
}).single('file');

const documents = new Map();

function save(document, filename) {
  documents.set(document.id, { document: { ...document }, filename });
  return { ...document };
}

async function listByOwner(owner) {
  const result = [];
  for (const { document, filename } of documents.values()) {
    if (document.owner !== owner) continue;
    try {
      await stat(path.join(storageDirectory, filename));
      result.push({ ...document });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return result;
}

function findById(id) {
  const record = documents.get(id);
  return record ? { ...record.document } : undefined;
}

async function getDownloadPath(id) {
  const record = documents.get(id);
  const filePath = path.join(storageDirectory, record.filename);
  await stat(filePath);
  return filePath;
}

async function removeFile(filename) {
  try {
    await unlink(path.join(storageDirectory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = { upload, save, listByOwner, findById, getDownloadPath, removeFile };
