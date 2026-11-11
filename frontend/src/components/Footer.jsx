import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';
import styles from './Footer.module.css';

export default function Footer() {
  return <footer className={styles.footer}>
    <div className={styles.gradient} aria-hidden="true" />
    <div className={styles.inner}>
      <Link to="/" className={styles.brand} aria-label="Flam — voltar ao início">
        <BrandLogo className={styles.logo} />
      </Link>
      <div className={styles.details}>
        <span>Made in UFU</span>
        <span>Sobe ripa!</span>
      </div>
    </div>
  </footer>;
}
