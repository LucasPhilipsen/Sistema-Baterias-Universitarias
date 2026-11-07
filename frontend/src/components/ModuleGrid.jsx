import { Link } from 'react-router-dom';
import styles from './ModuleGrid.module.css';

export default function ModuleGrid({ modules }) {
  return <div className={styles.grid}>{modules.map(module => <Link className={styles.card} to={module.path} key={module.path}>
    <span className={styles.status}>{module.status ?? 'Em desenvolvimento'}</span>
    <h3>{module.title}</h3>
    <p>{module.description}</p>
    <span className={styles.action}>{module.actionLabel ?? 'Abrir módulo'} <span aria-hidden="true">›</span></span>
  </Link>)}</div>;
}
