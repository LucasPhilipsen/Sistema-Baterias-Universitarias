export const NOME_COOKIE = 'bateria_sessao';

export function lerTokenSessao(req) {
  const header = req.headers.cookie;
  if (typeof header !== 'string') return null;
  const valores = header.split(';').map(item => item.trim())
    .filter(item => item.startsWith(`${NOME_COOKIE}=`));
  if (valores.length !== 1) return null;
  const token = valores[0].slice(NOME_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) && token.length === 43 ? token : null;
}

export function opcoesCookie(secure = false) {
  return { httpOnly: true, sameSite: 'lax', secure, path: '/api' };
}
