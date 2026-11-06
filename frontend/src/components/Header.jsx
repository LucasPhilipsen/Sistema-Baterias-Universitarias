import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { canAccess, profileLabel } from '../auth/access.js';
import { ActionLink, Button } from './ui.jsx';
import BrandLogo from './BrandLogo.jsx';
import styles from './Header.module.css';

export default function Header() {
  const { usuario, session } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const header = useRef(null);
  const menuButton = useRef(null);

  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOutside = event => {
      if (!header.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [menuOpen]);

  function closeOnEscape(event) {
    if (event.key !== 'Escape' || !menuOpen) return;
    event.preventDefault();
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  return <header ref={header} className={`${styles.header} ${pathname === '/' ? styles.home : ''} ${menuOpen ? styles.expanded : ''}`} onKeyDown={closeOnEscape}>
    <div className={styles.inner}>
      <Link to="/" className={styles.brand} aria-label="Flam — Início" onClick={() => setMenuOpen(false)}>
        <BrandLogo />
      </Link>
      <button ref={menuButton} type="button" className={styles.menuButton} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuOpen} aria-controls="navigation-menu" onClick={() => setMenuOpen(open => !open)}>
        <span aria-hidden="true" /><span aria-hidden="true" />
      </button>
      <div id="navigation-menu" className={`${styles.navigation} ${menuOpen ? styles.open : ''}`}>
        <nav className={styles.nav} aria-label="Navegação principal" onClick={event => {
          if (event.target.closest('a')) setMenuOpen(false);
        }}>
          <NavLink to="/" end>Início</NavLink>
          <NavLink to="/ensaios">Ensaios</NavLink>
          <NavLink to="/instrumentos">Instrumentos e estoque</NavLink>
          {canAccess('/administracao', usuario) && <NavLink to="/administracao">Diretoria</NavLink>}
        </nav>
        <div className={styles.actions}>
          {usuario ? <>
            <span className={styles.identity}><span>{usuario.nome}</span><small>{profileLabel(usuario.perfil)}</small></span>
            <Button variant="secondary" onClick={() => { setMenuOpen(false); void session.logout(); }}>Sair</Button>
          </> : <ActionLink to="/acesso" variant="secondary" size="large" arrow className={styles.login}
            aria-current={pathname === '/acesso' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>Login</ActionLink>}
        </div>
      </div>
    </div>
  </header>;
}
