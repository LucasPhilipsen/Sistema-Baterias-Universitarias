import { useEffect, useRef } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Message } from './components/ui.jsx';
import styles from './App.module.css';

const modules = [
  { path: '/acesso', title: 'Acesso', ticket: 'SCRUM-24', description: 'Entrada no sistema e controle de sessão por perfil.' },
  { path: '/ensaios', title: 'Ensaios', ticket: 'SCRUM-28', description: 'Agenda da bateria e organização dos ensaios.' },
  { path: '/instrumentos', title: 'Instrumentos e estoque', ticket: 'SCRUM-32', description: 'Consulta de instrumentos e situação das unidades.' },
];

function Home() {
  return <><section className={styles.hero} aria-labelledby="home-title">
    <div className={styles.rhythmMarks} aria-hidden="true"><span>♪</span><span>✳</span><span>♫</span></div>
    <p className={styles.eyebrow}>Gestão da bateria universitária</p><h1 id="home-title">Cada ensaio começa<br />com <span className={styles.highlight}>organização.</span></h1>
    <p className={styles.heroIntro}>A agenda, os instrumentos e a sua bateria.<br className={styles.desktopBreak} /> Tudo no mesmo ritmo, em um só lugar.</p>
    <Link className={styles.primaryLink} to="/ensaios">Explorar ensaios <span aria-hidden="true">→</span></Link>
    <span className={styles.heroNote}>Interface em construção · funcionalidades em breve</span>
    </section>
    <section aria-labelledby="modules-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>O espaço da sua bateria</p><h2 id="modules-title">Cada coisa no seu lugar.</h2></div><span className={styles.sectionNote}>Uma base para os próximos encontros.</span></div>
    <div className={styles.cards}>{modules.map((module, index) => <Link className={styles.card} to={module.path} key={module.path}><div className={styles.cardTop}><span className={styles.cardIcon} aria-hidden="true">{['↗', '▦', '♫'][index]}</span><span className={styles.status}>Em desenvolvimento</span></div><h3>{module.title}</h3><p>{module.description}</p><span className={styles.cardLink}>Abrir módulo <span aria-hidden="true">↗</span></span></Link>)}</div>
    </section>
  </>;
}

function Placeholder({ module }) {
  return <><p className={styles.eyebrow}>Em desenvolvimento</p><h1>{module.title}</h1><p className={styles.intro}>{module.description}</p>
    <Message>Este módulo ainda não está disponível. A navegação faz parte da base inicial do sistema.</Message>
    <Link className={styles.back} to="/">← Voltar ao início</Link></>;
}

export default function App() {
  const location = useLocation();
  const main = useRef(null);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    const title = modules.find(module => module.path === location.pathname)?.title ?? (location.pathname === '/' ? 'Início' : 'Página não encontrada');
    document.title = `${title} | Bateria Universitária`;
    if (previousPath.current !== location.pathname) { main.current?.focus(); previousPath.current = location.pathname; }
  }, [location.pathname]);
  return <><a className={styles.skip} href="#conteudo">Pular para o conteúdo</a>
    <header className={styles.header}><div className={styles.headerInner}><Link to="/" className={styles.brand}><span className={styles.mark} aria-hidden="true">BU</span><span>Bateria Universitária<small>Gestão e organização</small></span></Link></div>
      <nav className={styles.nav} aria-label="Navegação principal"><NavLink to="/" end>Início</NavLink>{modules.map(module => <NavLink key={module.path} to={module.path}>{module.title}</NavLink>)}</nav>
    </header>
    <main ref={main} tabIndex={-1} id="conteudo" className={styles.main}><Routes><Route path="/" element={<Home />} />{modules.map(module => <Route key={module.path} path={module.path} element={<Placeholder module={module} />} />)}<Route path="*" element={<><h1>Página não encontrada</h1><p>Confira o endereço ou volte para o início.</p><Link to="/">Voltar ao início</Link></>} /></Routes></main>
    <footer className={styles.footer}>Bateria Universitária · Projeto acadêmico · Grupo 14</footer>
  </>;
}
