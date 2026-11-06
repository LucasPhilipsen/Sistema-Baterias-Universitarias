import { useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ActionLink, Button, FormField, Loading, Message } from '../components/ui.jsx';
import PageIntro from '../components/PageIntro.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { loginDestination } from '../auth/access.js';
import { loginErrorMessage } from '../auth/session.js';
import { SessionUnavailable } from '../auth/RequireAuth.jsx';
import styles from './Login.module.css';

export default function Login() {
  const { status, usuario, reason, session } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const errorBox = useRef(null);
  const submitting = useRef(false);
  const busy = status === 'signingIn';

  if (status === 'checking' || status === 'signingOut') return <Loading>Confirmando sua sessão…</Loading>;
  if (status === 'error') return <SessionUnavailable />;
  if (status === 'authenticated') return <Navigate to={loginDestination(usuario, location.state?.from)} replace />;

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError('');
    try { await session.login({ email, senha }); }
    catch (failure) {
      setError(loginErrorMessage(failure));
      setSenha('');
      requestAnimationFrame(() => errorBox.current?.focus());
    } finally { submitting.current = false; }
  }

  return <section className={styles.layout} aria-labelledby="login-title">
    <PageIntro className={styles.intro} id="login-title" eyebrow="Sua bateria, organizada"
      title={<>Entre no ritmo<br />da sua bateria.</>}
      description="Acompanhe os ensaios e os instrumentos. Mais organização para tocar junto.">
      <dl className={styles.details}>
        <div><dt>Ensaios</dt><dd>A agenda dos próximos encontros.</dd></div>
        <div><dt>Instrumentos</dt><dd>O estoque da bateria em um só lugar.</dd></div>
        <div><dt>Seu perfil</dt><dd>Acesso para integrantes e diretoria.</dd></div>
      </dl>
    </PageIntro>
    <div className={styles.panel}><h2>Login</h2><p>Use o e-mail e a senha da sua conta.</p>
      {reason === 'expired' && <Message>Sua sessão expirou ou foi encerrada. Entre novamente para continuar.</Message>}
      {reason === 'signedOut' && <Message>Sessão encerrada com sucesso.</Message>}
      <form onSubmit={submit} aria-busy={busy}>
        <FormField label="E-mail" name="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
        <FormField label="Senha" name="senha" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={senha} onChange={event => setSenha(event.target.value)} disabled={busy} />
        <label className={styles.passwordToggle}><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} disabled={busy} />Mostrar senha</label>
        {error && <div ref={errorBox} tabIndex={-1} className={styles.error}><Message variant="error">{error}</Message></div>}
        <div className={styles.formActions}>
          <Button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
          <ActionLink variant="secondary" to="/">Voltar ao início</ActionLink>
        </div>
      </form>
      <p className={styles.help}>Precisa de uma conta ou de ajuda para entrar? Fale com a diretoria da sua bateria.</p>
    </div>
  </section>;
}
