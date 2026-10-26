const fs = require('node:fs/promises');
const path = require('node:path');
const { storageDirectory } = require('../config/storage');

const documents = new Map();

function resolveStorageKey(storageKey) {
  if (typeof storageKey !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(storageKey)) {
    throw new Error('Identificador interno de armazenamento inválido.');
  }
  return path.join(storageDirectory, storageKey);
}

function save(document, filename) {
  resolveStorageKey(filename);
  documents.set(document.id, { document: { ...document }, filename });
  return { ...document };
}

async function listByOwner(owner) {
  const records = [...documents.values()].filter(({ document }) => document.owner === owner);
  const result = [];
  for (let offset = 0; offset < records.length; offset += 10) {
    const batch = await Promise.all(records.slice(offset, offset + 10).map(async ({ document, filename }) => {
      try {
        await fs.stat(resolveStorageKey(filename));
        return { ...document };
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return null;
      }
    }));
    result.push(...batch.filter((document) => document !== null));
  }
  return result;
}

function findById(id) {
  const record = documents.get(id);
  return record ? { ...record.document } : undefined;
}

async function getDownloadPath(id) {
  const record = documents.get(id);
  if (!record) return undefined;
  const filePath = resolveStorageKey(record.filename);
  try {
    await fs.stat(filePath);
    return filePath;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  }
}

async function removeFile(filename) {
  try {
    await fs.unlink(resolveStorageKey(filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = { save, listByOwner, findById, getDownloadPath, removeFile };
