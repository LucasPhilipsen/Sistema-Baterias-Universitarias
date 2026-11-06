import styles from './BrandLogo.module.css';

export default function BrandLogo({ className = '' }) {
  return <svg className={`${styles.logo} ${className}`} viewBox="63 344 1063 391" role="img" aria-label="Flam">
    <image href="/branding/flam.png" width="1200" height="1200" />
  </svg>;
}
