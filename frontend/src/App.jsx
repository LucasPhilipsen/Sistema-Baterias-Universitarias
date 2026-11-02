import styles from './App.module.css';

const modules = [
  ['01', 'Integrantes', 'Pessoas, acesso e perfis.'],
  ['02', 'Ensaios', 'Agenda, confirmações e presença.'],
  ['03', 'Instrumentos', 'Cadastro e disponibilidade do estoque.'],
  ['04', 'Movimentações', 'Empréstimos, devoluções e manutenção.'],
  ['05', 'Painel da diretoria', 'Demanda de instrumentos e alertas de falta.'],
];

export function App() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.brand}>BU / Baterias Universitárias</span>
        <span className={styles.tag}>Versão inicial</span>
      </header>
      <section className={styles.intro} aria-labelledby="title">
        <p className={styles.eyebrow}>Gestão da bateria</p>
        <h1 id="title">Todo mundo<br />no mesmo ritmo.</h1>
        <p className={styles.description}>Um espaço para organizar os ensaios, cuidar dos instrumentos e acompanhar quem faz parte da bateria.</p>
        <p className={styles.notice}>O sistema está em desenvolvimento. Os módulos abaixo ainda não estão disponíveis.</p>
      </section>
      <section aria-label="Módulos previstos" className={styles.modules}>
        {modules.map(([number, title, description]) => (
          <article key={number} className={styles.module}>
            <span className={styles.number}>{number}</span>
            <div><h2>{title}</h2><p>{description}</p></div>
          </article>
        ))}
      </section>
      <footer className={styles.footer}>Processo de Desenvolvimento de Software · Grupo 14</footer>
    </main>
  );
}
