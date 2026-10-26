const { randomUUID } = require('node:crypto');
const repository = require('../repositories/documentRepository');

class DocumentError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function createDocument(file, owner) {
  if (!file) {
    throw new DocumentError('FILE_REQUIRED', 'Envie um arquivo no campo file.');
  }

  try {
    if (file.size === 0) {
      throw new DocumentError('FILE_REQUIRED', 'Envie um arquivo não vazio no campo file.');
    }

    const document = {
      id: randomUUID(),
      originalName: file.originalName,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner,
    };
    return await repository.save(document, file.storageKey);
  } catch (error) {
    try {
      await repository.removeFile(file.storageKey);
    } catch (cleanupError) {
      console.error('Falha ao remover arquivo de upload incompleto:', cleanupError);
    }
    throw error;
  }
}

async function listDocuments(owner) {
  const documents = await repository.listByOwner(owner);
  return documents.sort((left, right) => {
    if (left.uploadedAt !== right.uploadedAt) {
      return left.uploadedAt > right.uploadedAt ? -1 : 1;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

async function getDownload(id, owner) {
  const document = repository.findById(id);
  if (!document || document.owner !== owner) {
    throw new DocumentError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }

  const filePath = await repository.getDownloadPath(id);
  if (!filePath) {
    throw new DocumentError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }
  return { document, filePath };
}

module.exports = { DocumentError, createDocument, listDocuments, getDownload };
