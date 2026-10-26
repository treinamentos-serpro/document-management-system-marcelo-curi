const path = require('node:path');

const storageDirectory = path.resolve(__dirname, '../../storage');
const configuredLimit = process.env.MAX_FILE_SIZE_BYTES ?? '10485760';
const maxFileSize = Number(configuredLimit);

if (!/^[0-9]+$/.test(configuredLimit) || !Number.isSafeInteger(maxFileSize) || maxFileSize <= 0) {
  throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo seguro.');
}

module.exports = { storageDirectory, maxFileSize };
