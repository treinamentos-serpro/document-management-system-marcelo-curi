export class ApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('Não foi possível conectar ao servidor. Tente novamente.');
  }

  if (!response.ok) {
    let message = `Não foi possível concluir a operação (HTTP ${response.status}).`;
    let code;
    if (response.headers.get('content-type')?.includes('application/json')) {
      const data = await readJson(response);
      if (typeof data?.error?.message === 'string') {
        message = data.error.message;
      }
      if (typeof data?.error?.code === 'string') code = data.error.code;
    }
    throw new ApiError(message, { status: response.status, code });
  }

  return response;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('O servidor retornou uma resposta inválida.', { status: response.status });
  }
}

function isDocument(document) {
  return document !== null && typeof document === 'object' &&
    typeof document.id === 'string' && document.id.length > 0 &&
    typeof document.originalName === 'string' && document.originalName.length > 0 &&
    Number.isSafeInteger(document.size) && document.size >= 0 &&
    typeof document.owner === 'string' && document.owner.length > 0 &&
    typeof document.uploadedAt === 'string' &&
    Number.isFinite(Date.parse(document.uploadedAt)) &&
    new Date(document.uploadedAt).toISOString() === document.uploadedAt;
}

export async function listDocuments({ signal } = {}) {
  const response = await request('/documents', { signal });
  const data = await readJson(response);
  if (!Array.isArray(data?.documents) || !data.documents.every(isDocument)) {
    throw new ApiError('O servidor retornou uma resposta inválida.', { status: response.status });
  }
  return data.documents;
}

export async function uploadDocument(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await request('/upload', { method: 'POST', body });
  const data = await readJson(response);
  if (!isDocument(data?.document)) {
    throw new ApiError('O servidor retornou uma resposta inválida.', { status: response.status });
  }
  return data.document;
}

export async function downloadDocument(id) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`);
  return response.blob();
}
