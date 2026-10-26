import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from '../src/services/api.js';

test('lista documentos pelo prefixo /api e encaminha o sinal de cancelamento', async (t) => {
  const documents = [{ id: 'document-1', originalName: 'relatorio.txt' }];
  const signal = new AbortController().signal;
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ documents }));

  assert.deepEqual(await listDocuments({ signal }), documents);
  assert.deepEqual(fetch.mock.calls[0].arguments, ['/api/documents', { signal }]);
});

test('envia um único arquivo multipart sem definir Content-Type ou proprietário', async (t) => {
  const document = { id: 'document-1', originalName: 'relatorio.txt' };
  const file = new File(['conteúdo'], 'relatorio.txt');
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ document }, { status: 201 }));

  assert.deepEqual(await uploadDocument(file), document);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, '/api/upload');
  assert.equal(options.method, 'POST');
  assert.deepEqual([...options.body.keys()], ['file']);
  assert.equal(options.body.get('file'), file);
  assert.equal(options.headers, undefined);
});

test('baixa conteúdo binário e codifica o identificador na URL', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('conteúdo'));
  const blob = await downloadDocument('id /?#');

  assert.equal(await blob.text(), 'conteúdo');
  assert.equal(fetch.mock.calls[0].arguments[0], '/api/documents/id%20%2F%3F%23/download');
});

for (const status of [400, 401, 404, 413, 500]) {
  test(`propaga a mensagem de erro do backend para HTTP ${status}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({
      error: { code: 'FAILED', message: 'Falha informada pelo servidor.' },
    }, { status }));

    await assert.rejects(listDocuments(), { message: 'Falha informada pelo servidor.' });
  });
}

test('informa o status HTTP quando o proxy retorna erro não JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Bad Gateway', { status: 502 }));
  await assert.rejects(listDocuments(), /HTTP 502/);
});

test('falhas de download não retornam um blob de erro como arquivo', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    error: { message: 'Documento não encontrado.' },
  }, { status: 404 }));

  await assert.rejects(downloadDocument('missing'), /Documento não encontrado/);
});

test('falhas de upload não são reportadas como sucesso', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    error: { message: 'O arquivo excede o limite permitido.' },
  }, { status: 413 }));

  await assert.rejects(uploadDocument(new File(['a'], 'a.txt')), /excede o limite/);
});

test('informa falha de rede em português', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(listDocuments(), /Não foi possível conectar ao servidor/);
});

test('preserva o cancelamento da requisição', async (t) => {
  const error = new DOMException('Aborted', 'AbortError');
  t.mock.method(globalThis, 'fetch', async () => { throw error; });
  await assert.rejects(listDocuments(), (received) => received === error);
});

test('informa JSON inválido sem apresentar sucesso', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{'));
  await assert.rejects(listDocuments(), /resposta inválida/);
});
