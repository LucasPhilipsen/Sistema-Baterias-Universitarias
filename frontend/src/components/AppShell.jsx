import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './Header.jsx';
import styles from './AppShell.module.css';

export default function AppShell({ title, fullWidth = false, children }) {
  const { pathname } = useLocation();
  const main = useRef(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    document.title = `${title} | Bateria Universitária`;
    if (previousPath.current !== pathname) {
      main.current?.focus();
      previousPath.current = pathname;
    }
  }, [pathname, title]);
  return <>
    <a className={styles.skip} href="#conteudo">Pular para o conteúdo</a>
    <Header />
    <main ref={main} tabIndex={-1} id="conteudo" className={`${styles.main} ${fullWidth ? styles.fullWidth : ''}`}>{children}</main>
    <footer className={styles.footer}><span>Bateria Universitária</span><span>Projeto acadêmico · Grupo 14</span></footer>
  </>;
}
