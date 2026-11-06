export const profiles = Object.freeze({ DIRETORIA: 'DIRETORIA', INTEGRANTE: 'INTEGRANTE' });

// Base fictícia só para analisar caminhos: não configura domínio nem faz requisições.
const internalUrlBase = 'https://bateria.invalid';

export function canAccess(pathname, usuario) {
  if (!Object.values(profiles).includes(usuario?.perfil)) return false;
  pathname = pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/administracao') return usuario.perfil === profiles.DIRETORIA;
  return ['/', '/ensaios', '/instrumentos'].includes(pathname);
}

export function loginDestination(usuario, from) {
  // Só aceita destinos internos conhecidos e autorizados, inclusive após um novo login.
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
    const url = new URL(from, internalUrlBase);
    if (url.origin === internalUrlBase && canAccess(url.pathname, usuario)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  }
  return usuario?.perfil === profiles.DIRETORIA ? '/administracao' : '/ensaios';
}

export function profileLabel(perfil) {
  return perfil === profiles.DIRETORIA ? 'Diretoria' : 'Integrante';
}
