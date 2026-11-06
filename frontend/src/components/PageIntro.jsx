import styles from './PageIntro.module.css';

export default function PageIntro({ id, eyebrow, title, description, variant = 'default', className = '', children }) {
  return <div className={`${styles.intro} ${variant === 'hero' ? styles.hero : ''} ${className}`}>
    {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
    <h1 id={id}>{title}</h1>
    {description && <p className={styles.description}>{description}</p>}
    {children}
  </div>;
}
