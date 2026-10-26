const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const service = require('../src/services/documentService');
const repository = require('../src/repositories/documentRepository');

test('serviço recebe dados da aplicação sem depender do formato do Multer', async (t) => {
  const storageKey = randomUUID();
  const save = t.mock.method(repository, 'save', (document) => document);
  const document = await service.createDocument({ originalName: 'arquivo.txt', size: 10, storageKey }, 'owner');
  assert.equal(document.originalName, 'arquivo.txt');
  assert.equal(document.size, 10);
  assert.equal(document.owner, 'owner');
  assert.equal(save.mock.calls[0].arguments[1], storageKey);
  assert.ok(!('storageKey' in document));
});

test('serviço impede consultar o arquivo de um documento de outro owner', async (t) => {
  t.mock.method(repository, 'findById', () => ({ id: 'documento', owner: 'alice' }));
  const getPath = t.mock.method(repository, 'getDownloadPath', () => assert.fail('leitura não autorizada'));
  await assert.rejects(service.getDownload('documento', 'bob'), { code: 'DOCUMENT_NOT_FOUND' });
  assert.equal(getPath.mock.callCount(), 0);
});

test('falha de limpeza é registrada e não substitui a falha original de upload', async (t) => {
  const failure = new Error('falha de metadados');
  t.mock.method(repository, 'save', () => { throw failure; });
  t.mock.method(repository, 'removeFile', async () => { throw new Error('falha de limpeza'); });
  const log = t.mock.method(console, 'error', () => {});
  await assert.rejects(service.createDocument({
    originalName: 'arquivo.txt', size: 10, storageKey: randomUUID(),
  }, 'owner'), (error) => error === failure);
  assert.equal(log.mock.callCount(), 1);
});
