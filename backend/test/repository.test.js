const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const repository = require('../src/repositories/documentRepository');

test('repositório rejeita chaves internas que poderiam escapar do diretório local', async () => {
  for (const storageKey of ['../../arquivo', '/tmp/arquivo', '..\\arquivo', '', undefined]) {
    assert.throws(() => repository.save({ id: randomUUID() }, storageKey), /armazenamento inválido/);
    await assert.rejects(repository.removeFile(storageKey), /armazenamento inválido/);
  }
});

test('listagem verifica arquivos em lotes de até dez sem misturar owners', async (t) => {
  const owner = randomUUID();
  const records = Array.from({ length: 25 }, () => ({ id: randomUUID(), owner }));
  for (const record of records) repository.save(record, randomUUID());
  repository.save({ id: randomUUID(), owner: 'outro-owner' }, randomUUID());
  let active = 0;
  let peak = 0;
  const stat = t.mock.method(fs, 'stat', async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setImmediate(resolve));
    active--;
  });
  assert.deepEqual(await repository.listByOwner(owner), records);
  assert.equal(stat.mock.callCount(), records.length);
  assert.equal(peak, 10);
});

test('ausência de arquivo é representada sem esconder outras falhas de filesystem', async (t) => {
  const document = { id: randomUUID(), owner: randomUUID() };
  repository.save(document, randomUUID());
  const stat = t.mock.method(fs, 'stat', async () => {
    throw Object.assign(new Error('ausente'), { code: 'ENOENT' });
  });
  assert.deepEqual(await repository.listByOwner(document.owner), []);
  assert.equal(await repository.getDownloadPath(document.id), undefined);
  assert.equal(await repository.getDownloadPath('desconhecido'), undefined);
  const denied = Object.assign(new Error('negado'), { code: 'EACCES' });
  stat.mock.mockImplementation(async () => { throw denied; });
  await assert.rejects(repository.listByOwner(document.owner), (error) => error === denied);
  await assert.rejects(repository.getDownloadPath(document.id), (error) => error === denied);
});
