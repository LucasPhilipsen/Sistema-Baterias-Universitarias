import { HttpError, request as defaultRequest } from '../services/http.js';
import { profiles } from './access.js';

function readUser(data) {
  const usuario = data?.usuario;
  if (!Number.isInteger(usuario?.id) || usuario.id < 1 || typeof usuario.nome !== 'string' || !usuario.nome.trim()
    || typeof usuario.email !== 'string' || !Object.values(profiles).includes(usuario.perfil)) {
    throw new Error('Resposta de sessão inválida.');
  }
  const { id, nome, email, perfil } = usuario;
  return Object.freeze({ id, nome, email, perfil });
}

export function loginErrorMessage(error) {
  if (error instanceof HttpError) {
    if (error.status === 401) return 'E-mail ou senha inválidos.';
    if (error.status === 429) return 'Muitas tentativas. Aguarde antes de tentar novamente.';
    if (error.status === 400) return 'Confira o e-mail e a senha informados.';
    if (error.status === 403) return 'O servidor recusou a origem do acesso. Abra o sistema pelo endereço configurado.';
  }
  return 'Não foi possível entrar. Verifique sua conexão e tente novamente.';
}

// A identidade fica somente em memória; a sessão pertence ao servidor e ao cookie HttpOnly.
export function createSession({ request = defaultRequest, onSessionChange = () => {} } = {}) {
  let state = { status: 'checking', usuario: null, reason: null };
  let revision = 0;
  let pendingRefresh = null;
  const listeners = new Set();
  const update = next => { state = next; listeners.forEach(listener => listener()); };
  const anonymous = reason => update({ status: 'anonymous', usuario: null, reason });

  const session = {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },

    refresh() {
      if (['signingIn', 'signingOut'].includes(state.status)) return Promise.resolve();
      if (pendingRefresh) return pendingRefresh;
      const current = revision;
      const previousReason = state.reason;
      const wasAuthenticated = Boolean(state.usuario) || state.reason === 'expired';
      // Revalidar em segundo plano preserva a tela e os formulários já abertos.
      if (!['authenticated', 'anonymous'].includes(state.status)) {
        update({ status: 'checking', usuario: null, reason: null });
      }
      const operation = (async () => {
        try {
          const usuario = readUser(await request('/auth/me', { cache: 'no-store' }));
          if (current === revision) update({ status: 'authenticated', usuario, reason: null });
        } catch (error) {
          if (current !== revision) return;
          if (error instanceof HttpError && error.status === 401) anonymous(wasAuthenticated ? 'expired' : previousReason);
          else update({ status: 'error', usuario: null, reason: 'unavailable' });
        }
      })();
      pendingRefresh = operation;
      operation.finally(() => { if (pendingRefresh === operation) pendingRefresh = null; });
      return operation;
    },

    async login({ email, senha }) {
      const current = ++revision;
      pendingRefresh = null;
      update({ status: 'signingIn', usuario: null, reason: null });
      try {
        const usuario = readUser(await request('/auth/login', {
          method: 'POST', body: { email: email.trim().toLowerCase(), senha }, cache: 'no-store',
        }));
        if (current !== revision) return;
        update({ status: 'authenticated', usuario, reason: null });
        onSessionChange();
        return usuario;
      } catch (error) {
        if (current === revision) anonymous(null);
        throw error;
      }
    },

    async logout() {
      const current = ++revision;
      pendingRefresh = null;
      update({ status: 'signingOut', usuario: null, reason: null });
      try {
        await request('/auth/logout', { method: 'POST', body: {}, cache: 'no-store' });
        if (current !== revision) return;
        anonymous('signedOut');
        onSessionChange();
      } catch {
        if (current === revision) update({ status: 'error', usuario: null, reason: 'logoutFailed' });
      }
    },

    // Os próximos módulos devem usar este cliente para tratar revogação e mudança de perfil.
    async request(path, options) {
      if (state.status !== 'authenticated') throw new HttpError('Entre no sistema para continuar.', 401, null);
      const current = revision;
      try { return await request(path, options); }
      catch (error) {
        if (current === revision && error instanceof HttpError) {
          if (error.status === 401) { ++revision; pendingRefresh = null; anonymous('expired'); }
          else if (error.status === 403) await session.refresh();
        }
        throw error;
      }
    },
  };
  return session;
}
