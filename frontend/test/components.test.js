import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;
let DocumentList;
let UploadComponent;
let App;

before(async () => {
  server = await createServer({ server: { middlewareMode: true } });
  ({ default: DocumentList } = await server.ssrLoadModule('/src/components/DocumentList.jsx'));
  ({ default: UploadComponent } = await server.ssrLoadModule('/src/components/UploadComponent.jsx'));
  ({ default: App } = await server.ssrLoadModule('/src/App.jsx'));
});

after(async () => {
  await server?.close();
});

test('lista distingue carregamento, erro e estado vazio', () => {
  const loading = renderToStaticMarkup(createElement(DocumentList, {
    documents: [], isLoading: true, error: '',
  }));
  assert.match(loading, /role="status"/);
  assert.match(loading, /Carregando documentos/);
  assert.doesNotMatch(loading, /Nenhum documento/);

  const failure = renderToStaticMarkup(createElement(DocumentList, {
    documents: [], isLoading: false, error: 'Usuário não identificado.',
  }));
  assert.match(failure, /role="alert"/);
  assert.match(failure, /Usuário não identificado/);
  assert.doesNotMatch(failure, /Nenhum documento/);

  const empty = renderToStaticMarkup(createElement(DocumentList, {
    documents: [], isLoading: false, error: '',
  }));
  assert.match(empty, /Nenhum documento enviado/);
});

test('lista mostra metadados e botão de download com nome acessível', () => {
  const markup = renderToStaticMarkup(createElement(DocumentList, {
    documents: [{
      id: 'document-1',
      originalName: '<relatorio>.txt',
      size: 123,
      uploadedAt: '2026-10-26T19:17:06.198Z',
    }],
    isLoading: false,
    error: '',
  }));

  assert.match(markup, /&lt;relatorio&gt;\.txt/);
  assert.match(markup, /<td>123<\/td>/);
  assert.match(markup, /dateTime="2026-10-26T19:17:06.198Z"/);
  assert.match(markup, /aria-label="Baixar &lt;relatorio&gt;\.txt"/);
});

test('upload permite um arquivo e desabilita envio sem seleção', () => {
  const markup = renderToStaticMarkup(createElement(UploadComponent, { onUpload() {} }));
  assert.match(markup, /type="file"/);
  assert.match(markup, /name="file"/);
  assert.doesNotMatch(markup, /multiple/);
  assert.match(markup, /<button type="submit" disabled="">Enviar<\/button>/);
});

test('App monta upload e listagem com carregamento inicial', () => {
  const markup = renderToStaticMarkup(createElement(App));
  assert.match(markup, /Enviar documento/);
  assert.match(markup, /Meus documentos/);
  assert.match(markup, /Atualizar lista/);
  assert.match(markup, /Carregando documentos/);
});
