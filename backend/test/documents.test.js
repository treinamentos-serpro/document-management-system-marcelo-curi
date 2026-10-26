const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { readFile, readdir, unlink } = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { Writable } = require('node:stream');
const express = require('express');
const app = require('../src/app');
const repository = require('../src/repositories/documentRepository');
const service = require('../src/services/documentService');

const storageDirectory = path.resolve(__dirname, '../storage');

test('contratos HTTP de documentos e armazenamento local', async (t) => {
  const wrapper = express();
  wrapper.use(app);
  const server = wrapper.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const filenames = new Map();
  const originalSave = repository.save;
  t.mock.method(repository, 'save', (document, filename) => {
    filenames.set(document.id, filename);
    return originalSave(document, filename);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    for (const filename of filenames.values()) await repository.removeFile(filename);
  });

  function request(url, options = {}) {
    return fetch(`${baseUrl}${url}`, options);
  }

  function form(content = 'conteudo do documento', name = 'relatorio.txt') {
    const body = new FormData();
    body.append('file', new Blob([content]), name);
    return body;
  }

  async function expectError(response, status, code) {
    assert.equal(response.status, status);
    assert.match(response.headers.get('content-type'), /application\/json/);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['error']);
    assert.deepEqual(Object.keys(body.error).sort(), ['code', 'message']);
    assert.equal(body.error.code, code);
    assert.equal(typeof body.error.message, 'string');
    assert.ok(!JSON.stringify(body).includes(storageDirectory));
  }

  let document;
  await t.test('preserva health e atende as rotas sem contexto externo de identidade', async () => {
    const health = await request('/health');
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: 'ok' });
    assert.deepEqual(await (await request('/documents')).json(), { documents: [] });
  });

  await t.test('grava arquivo local com UUID e retorna apenas metadados públicos', async () => {
    const body = form();
    body.append('owner', 'mallory');
    body.append('path', '/destino-ignorado');
    const response = await request('/upload', {
      method: 'POST',
      body,
      headers: { 'x-test-user': 'mallory' },
    });
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.deepEqual(Object.keys(result), ['document']);
    document = result.document;
    assert.deepEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    assert.match(document.id, /^[0-9a-f-]{36}$/);
    assert.equal(document.originalName, 'relatorio.txt');
    assert.equal(document.owner, process.env.DOCUMENT_OWNER_ID || 'default');
    assert.equal(document.size, Buffer.byteLength('conteudo do documento'));
    assert.equal(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
    const filename = filenames.get(document.id);
    assert.match(filename, /^[0-9a-f-]{36}$/);
    assert.equal(await readFile(path.join(storageDirectory, filename), 'utf8'), 'conteudo do documento');
  });

  await t.test('usa o owner do servidor e ignora seletores de owner enviados pelo cliente', async () => {
    const selectedByQuery = await request('/documents?owner=mallory', {
      headers: { 'x-test-user': 'bob' },
    });
    assert.deepEqual(await selectedByQuery.json(), { documents: [document] });
    assert.deepEqual(await (await request('/documents')).json(), { documents: [document] });
  });

  await t.test('download preserva conteúdo, nome e cabeçalhos', async () => {
    const response = await request(`/documents/${document.id}/download`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    assert.equal(response.headers.get('content-length'), String(document.size));
    assert.match(response.headers.get('content-disposition'), /^attachment; filename="relatorio.txt"/);
    assert.equal(await response.text(), 'conteudo do documento');
    const clientSelectedOwner = await request(`/documents/${document.id}/download`, {
      headers: { 'x-test-user': 'bob' },
    });
    assert.equal(clientSelectedOwner.status, 200);
    assert.equal(await clientSelectedOwner.text(), 'conteudo do documento');
    await expectError(await request('/documents/unknown/download'), 404, 'DOCUMENT_NOT_FOUND');
  });

  await t.test('rejeita upload ausente, vazio, múltiplo, campo errado e multipart inválido', async () => {
    const before = (await readdir(storageDirectory)).sort();
    await expectError(await request('/upload', { method: 'POST' }), 400, 'FILE_REQUIRED');
    await expectError(await request('/upload', { method: 'POST', body: form('') }), 400, 'FILE_REQUIRED');
    const multiple = form();
    multiple.append('file', new Blob(['outro']), 'outro.txt');
    await expectError(await request('/upload', { method: 'POST', body: multiple }), 400, 'INVALID_MULTIPART');
    const wrongField = new FormData();
    wrongField.append('wrong', new Blob(['arquivo']), 'arquivo.txt');
    await expectError(await request('/upload', { method: 'POST', body: wrongField }), 400, 'INVALID_MULTIPART');
    await expectError(await request('/upload', {
      method: 'POST', headers: { 'Content-Type': 'multipart/form-data' }, body: 'invalido',
    }), 400, 'INVALID_MULTIPART');
    await expectError(await request('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=teste' },
      body: '--teste\r\nContent-Disposition: form-data; name="file"; filename="parcial.txt"\r\n' +
        'Content-Type: text/plain\r\n\r\nconteudo sem fechamento',
    }), 400, 'INVALID_MULTIPART');
    assert.deepEqual((await readdir(storageDirectory)).sort(), before);
  });

  await t.test('aplica o limite exato em bytes e remove uploads rejeitados', async () => {
    const limit = Number(process.env.MAX_FILE_SIZE_BYTES ?? 10485760);
    const accepted = await request('/upload', { method: 'POST', body: form(new Uint8Array(limit)) });
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json()).document.size, limit);
    const before = (await readdir(storageDirectory)).sort();
    await expectError(await request('/upload', {
      method: 'POST', body: form(new Uint8Array(limit + 1)),
    }), 413, 'FILE_TOO_LARGE');
    assert.deepEqual((await readdir(storageDirectory)).sort(), before);
  });

  await t.test('nome externo não define caminho e download usa cabeçalho seguro', async () => {
    const response = await request('/upload', {
      method: 'POST', body: form('outro', '../../relatório "final".txt'),
    });
    assert.equal(response.status, 201);
    const { document: uploaded } = await response.json();
    assert.ok(!uploaded.originalName.includes('/'));
    assert.match(filenames.get(uploaded.id), /^[0-9a-f-]{36}$/);
    const download = await request(`/documents/${uploaded.id}/download`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /^attachment;/);
    assert.equal(await download.text(), 'outro');
  });

  await t.test('falha de metadados remove o arquivo e retorna erro explícito', async (t) => {
    const before = (await readdir(storageDirectory)).sort();
    t.mock.method(repository, 'save', () => { throw new Error('falha simulada'); });
    const log = t.mock.method(console, 'error', () => {});
    await expectError(await request('/upload', { method: 'POST', body: form() }), 500, 'UPLOAD_FAILED');
    assert.equal(log.mock.callCount(), 1);
    assert.deepEqual((await readdir(storageDirectory)).sort(), before);
  });

  await t.test('falha de gravação retorna UPLOAD_FAILED e não cria metadados', async (t) => {
    const before = await (await request('/documents')).json();
    t.mock.method(fs, 'createWriteStream', () => new Writable({
      write(chunk, encoding, callback) {
        callback(Object.assign(new Error('falha de escrita simulada'), { code: 'EACCES' }));
      },
    }));
    const log = t.mock.method(console, 'error', () => {});
    await expectError(await request('/upload', { method: 'POST', body: form() }), 500, 'UPLOAD_FAILED');
    assert.equal(log.mock.callCount(), 1);
    assert.deepEqual(await (await request('/documents')).json(), before);
  });

  await t.test('falhas de listagem e leitura retornam JSON sem detalhes internos', async (t) => {
    t.mock.method(repository, 'listByOwner', async () => { throw new Error('falha simulada'); });
    t.mock.method(repository, 'getDownloadPath', async () => {
      throw Object.assign(new Error('falha simulada'), { code: 'EACCES' });
    });
    const log = t.mock.method(console, 'error', () => {});
    await expectError(await request('/documents'), 500, 'DOCUMENT_LIST_FAILED');
    await expectError(await request(`/documents/${document.id}/download`), 500, 'DOWNLOAD_FAILED');
    assert.equal(log.mock.callCount(), 2);
  });

  await t.test('arquivo removido retorna 404 e deixa de aparecer na lista', async () => {
    await unlink(path.join(storageDirectory, filenames.get(document.id)));
    await expectError(await request(`/documents/${document.id}/download`), 404, 'DOCUMENT_NOT_FOUND');
    const { documents } = await (await request('/documents')).json();
    assert.ok(documents.every((item) => item.id !== document.id));
  });
});

test('listagem ordena por data decrescente e desempata por id crescente', async (t) => {
  const records = [
    { id: 'b', uploadedAt: '2026-10-26T12:00:00.000Z' },
    { id: 'c', uploadedAt: '2026-10-25T12:00:00.000Z' },
    { id: 'a', uploadedAt: '2026-10-26T12:00:00.000Z' },
  ];
  t.mock.method(repository, 'listByOwner', async () => records);
  assert.deepEqual((await service.listDocuments('alice')).map((document) => document.id), ['a', 'b', 'c']);
});

test('configuração inválida impede a inicialização com erro explícito', () => {
  for (const value of ['', '0', '-1', '1.5', 'abc', 'Infinity', '9007199254740992']) {
    const result = spawnSync(process.execPath, ['-e', "require('./src/app')"], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, MAX_FILE_SIZE_BYTES: value },
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, value);
    assert.match(result.stderr, /MAX_FILE_SIZE_BYTES deve ser um inteiro positivo seguro/);
  }
});

test('owner é configurado pelo servidor e usa default quando variável ausente', () => {
  const source = "const middleware=require('./src/middleware/ownerContext');const req={ownerId:'client-owner',headers:{'x-owner-id':'header-owner'}};let nextCalls=0;middleware(req,{},()=>nextCalls++);process.stdout.write(`${req.ownerId}:${nextCalls}`)";
  const configuredEnvironment = { ...process.env, DOCUMENT_OWNER_ID: 'tenant-42' };
  const configured = spawnSync(process.execPath, ['-e', source], {
    cwd: path.resolve(__dirname, '..'),
    env: configuredEnvironment,
    encoding: 'utf8',
  });
  assert.equal(configured.status, 0, configured.stderr);
  assert.equal(configured.stdout, 'tenant-42:1');

  const defaultEnvironment = { ...process.env };
  delete defaultEnvironment.DOCUMENT_OWNER_ID;
  const fallback = spawnSync(process.execPath, ['-e', source], {
    cwd: path.resolve(__dirname, '..'),
    env: defaultEnvironment,
    encoding: 'utf8',
  });
  assert.equal(fallback.status, 0, fallback.stderr);
  assert.equal(fallback.stdout, 'default:1');
});
