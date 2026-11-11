import { Route, Routes, useLocation } from 'react-router-dom';
import { ActionLink, Message } from './components/ui.jsx';
import AppShell from './components/AppShell.jsx';
import PageIntro from './components/PageIntro.jsx';
import ModuleGrid from './components/ModuleGrid.jsx';
import BateriaLogos from './components/BateriaLogos.jsx';
import RibbonWave from './components/RibbonWave/RibbonWave.jsx';
import { useAuth } from './auth/AuthContext.jsx';
import { canAccess, profileLabel } from './auth/access.js';
import { RequireAuth, SessionUnavailable } from './auth/RequireAuth.jsx';
import Login from './pages/Login.jsx';
import Ensaios from './pages/Ensaios.jsx';
import styles from './App.module.css';

const modules = [
  { path: '/acesso', title: 'Login', description: 'Entre com sua conta para acompanhar a bateria.', status: 'Disponível', actionLabel: 'Fazer login' },
  { path: '/ensaios', title: 'Ensaios', description: 'Agenda da bateria e organização dos ensaios.' },
  { path: '/instrumentos', title: 'Instrumentos e estoque', description: 'Consulta de instrumentos e situação das unidades.' },
];
const administration = { path: '/administracao', title: 'Área da diretoria', description: 'Organização dos ensaios e dos instrumentos da bateria.', status: 'Diretoria' };

function Home() {
  const { usuario } = useAuth();
  const visibleModules = [...modules.filter(module => !usuario || module.path !== '/acesso'), ...(canAccess('/administracao', usuario) ? [administration] : [])];
  return <>
    <div className={styles.introStage}>
      <RibbonWave extendToHeader />
      <div className={styles.introContent}>
        <section className={styles.hero} aria-labelledby="home-title">
          <PageIntro id="home-title" className={styles.heroIntro} variant="hero"
            title="Cada ensaio começa com organização."
            description="A agenda, os instrumentos e a sua bateria. Tudo no mesmo ritmo, em um só lugar.">
            {usuario && <p className={styles.heroNote}>{usuario.nome} · {profileLabel(usuario.perfil)}</p>}
          </PageIntro>
        </section>
        <BateriaLogos />
      </div>
    </div>
    <section className={styles.modules} aria-labelledby="modules-title">
      <div className={styles.sectionHeading}><h2 id="modules-title">Onde se formam campeãs.</h2></div>
      <ModuleGrid modules={visibleModules} />
    </section>
  </>;
}

function Administration() {
  return <section aria-labelledby="administration-title">
    <PageIntro className={styles.pageIntro} id="administration-title" eyebrow="Diretoria" title="Organize o próximo encontro."
      description="Acompanhe os módulos de gestão da sua bateria." />
    <Message>A agenda de ensaios está disponível para gestão. As operações de instrumentos estarão disponíveis na próxima entrega.</Message>
    <ModuleGrid modules={modules.filter(module => module.path !== '/acesso')} />
  </section>;
}

function Placeholder({ module }) {
  return <section aria-labelledby="module-title">
    <PageIntro className={styles.pageIntro} id="module-title" eyebrow="Em desenvolvimento" title={module.title} description={module.description} />
    <Message>Este módulo ainda não está disponível. A navegação faz parte da base inicial do sistema.</Message>
    <ActionLink className={styles.back} variant="secondary" to="/">Voltar ao início</ActionLink>
  </section>;
}

export default function App() {
  const { status } = useAuth();
  const location = useLocation();
  const title = [...modules, administration].find(module => module.path === location.pathname)?.title ?? (location.pathname === '/' ? 'Início' : 'Página não encontrada');
  return <AppShell title={title} fullWidth={location.pathname === '/' && status !== 'error'}>
    {status === 'error' ? <SessionUnavailable /> : <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/acesso" element={<Login />} />
      <Route element={<RequireAuth key={location.key} />}>
        <Route path="/ensaios" element={<Ensaios />} />
        <Route path="/instrumentos" element={<Placeholder module={modules.find(module => module.path === '/instrumentos')} />} />
        <Route path="/administracao" element={<Administration />} />
      </Route>
      <Route path="*" element={<><PageIntro title="Página não encontrada" description="Confira o endereço ou volte para o início." className={styles.pageIntro} /><ActionLink to="/" variant="secondary">Voltar ao início</ActionLink></>} />
    </Routes>}
  </AppShell>;
}
