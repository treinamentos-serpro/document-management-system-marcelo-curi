import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, downloadDocument, listDocuments, uploadDocument } from '../src/services/api.js';

const document = {
  id: 'document-1',
  originalName: 'relatorio.txt',
  size: 123,
  owner: 'default',
  uploadedAt: '2026-10-26T19:17:06.198Z',
};

test('lista documentos pelo prefixo /api e encaminha o sinal de cancelamento', async (t) => {
  const documents = [document];
  const signal = new AbortController().signal;
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ documents }));

  assert.deepEqual(await listDocuments({ signal }), documents);
  assert.deepEqual(fetch.mock.calls[0].arguments, ['/api/documents', { signal }]);
});

test('envia um único arquivo multipart sem definir Content-Type ou proprietário', async (t) => {
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
    await assert.rejects(listDocuments(), (error) =>
      error instanceof ApiError && error.status === status && error.code === 'FAILED');
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

for (const body of [null, {}, [], { documents: null }, { documents: {} }, { documents: [null] }]) {
  test(`rejeita envelope de listagem inválido: ${JSON.stringify(body)}`, async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json(body));
    await assert.rejects(listDocuments(), { message: 'O servidor retornou uma resposta inválida.', status: 200 });
  });
}

for (const [field, value] of [
  ['id', ''], ['originalName', null], ['size', -1], ['size', '123'],
  ['size', 1.5], ['size', Number.MAX_SAFE_INTEGER + 1],
  ['owner', ''], ['uploadedAt', 'inválido'], ['uploadedAt', '2026-10-26'],
]) {
  test(`rejeita metadado inválido: ${field}=${value}`, async (t) => {
    const invalidDocument = { ...document, [field]: value };
    const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({
      documents: [invalidDocument],
    }));
    await assert.rejects(listDocuments(), /resposta inválida/);
    fetch.mock.mockImplementation(async () => Response.json({ document: invalidDocument }, { status: 201 }));
    await assert.rejects(uploadDocument(new File(['a'], 'a.txt')), /resposta inválida/);
  });
}

test('rejeita upload com resposta de sucesso sem documento', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(null, { status: 201 }));
  await assert.rejects(uploadDocument(new File(['a'], 'a.txt')), { status: 201, name: 'ApiError' });
});

test('aceita lista vazia e documento com zero bytes no contrato de leitura', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => Response.json({ documents: [] }));
  assert.deepEqual(await listDocuments(), []);
  fetch.mock.mockImplementation(async () => Response.json({ documents: [{ ...document, size: 0 }] }));
  assert.deepEqual(await listDocuments(), [{ ...document, size: 0 }]);
});

test('erro JSON nulo preserva o status HTTP em vez de provocar TypeError', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json(null, { status: 502 }));
  await assert.rejects(listDocuments(), { status: 502, message: 'Não foi possível concluir a operação (HTTP 502).' });
});

test('preserva cancelamento durante a leitura do JSON', async (t) => {
  const error = new DOMException('Aborted', 'AbortError');
  const response = Response.json({ documents: [] });
  t.mock.method(response, 'json', async () => { throw error; });
  t.mock.method(globalThis, 'fetch', async () => response);
  await assert.rejects(listDocuments(), (received) => received === error);
});
