import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ActionLink, Button, Loading, Message } from '../components/ui.jsx';
import PageIntro from '../components/PageIntro.jsx';
import { useAuth } from './AuthContext.jsx';
import { canAccess } from './access.js';

export function SessionUnavailable() {
  const { reason, session } = useAuth();
  return <section aria-labelledby="session-error-title"><PageIntro id="session-error-title" title="Não foi possível confirmar sua sessão" />
    <Message variant="error">{reason === 'logoutFailed'
      ? 'Não foi possível encerrar a sessão no servidor. Tente sair novamente.'
      : 'Verifique sua conexão e se a API está disponível. Tente novamente para continuar.'}</Message>
    <p><Button onClick={() => void (reason === 'logoutFailed' ? session.logout() : session.refresh())}>Tentar novamente</Button></p>
  </section>;
}

export function RequireAuth() {
  const location = useLocation();
  const { status, usuario, session } = useAuth();
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    let active = true;
    session.refresh().then(() => { if (active) setVerified(true); });
    return () => { active = false; };
  }, [session]);

  if (!verified || ['checking', 'signingIn', 'signingOut'].includes(status)) return <Loading>Confirmando sua sessão…</Loading>;
  if (status === 'error') return <SessionUnavailable />;
  if (status !== 'authenticated') return <Navigate to="/acesso" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  if (!canAccess(location.pathname, usuario)) return <section aria-labelledby="forbidden-title"><PageIntro id="forbidden-title" title="Acesso restrito à diretoria" />
    <Message variant="error">Seu perfil não tem permissão para acessar esta área.</Message><p><ActionLink variant="secondary" to="/ensaios">Ir para ensaios</ActionLink></p></section>;
  return <Outlet />;
}
