export class HttpError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

// O contrato de autenticação será definido com Giovani na SCRUM-23.
// Não adiciona token, armazenamento de sessão ou credenciais entre origens.
export function createHttpClient({ baseUrl = '/api', fetchImpl = globalThis.fetch } = {}) {
  return async function request(path, { body, headers, ...options } = {}) {
    const requestHeaders = new Headers(headers);
    requestHeaders.set('Accept', 'application/json');
    if (body !== undefined) requestHeaders.set('Content-Type', 'application/json');
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
      ...options, headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); }
      catch {
        throw new HttpError('A API retornou uma resposta inválida.', response.status, null);
      }
    }
    if (!response.ok) throw new HttpError(`Não foi possível concluir a solicitação (HTTP ${response.status}).`, response.status, data);
    return data;
  };
}

export const request = createHttpClient({ baseUrl: import.meta.env?.VITE_API_BASE_URL || '/api' });
