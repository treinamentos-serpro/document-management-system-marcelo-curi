async function request(path, options) {
  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
  }

  if (!response.ok) {
    let message = `Não foi possível concluir a operação (HTTP ${response.status}).`;
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await readJson(response);
      if (typeof data.error?.message === 'string') {
        message = data.error.message;
      }
    }
    throw new Error(message);
  }

  return response;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    throw new Error('O servidor retornou uma resposta inválida.');
  }
}

export async function listDocuments({ signal } = {}) {
  const response = await request('/documents', { signal });
  const data = await readJson(response);
  return data.documents;
}

export async function uploadDocument(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await request('/upload', { method: 'POST', body });
  const data = await readJson(response);
  return data.document;
}

export async function downloadDocument(id) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`);
  return response.blob();
}
