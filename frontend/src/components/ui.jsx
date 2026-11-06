import { useId } from 'react';
import { Link } from 'react-router-dom';
import styles from './ui.module.css';

function actionClasses(variant, size, className) {
  return `${styles.button} ${variant === 'secondary' ? styles.secondary : ''} ${size === 'large' ? styles.large : ''} ${className}`;
}

export function Button({ variant = 'primary', size = 'default', type = 'button', className = '', ...props }) {
  return <button type={type} className={actionClasses(variant, size, className)} {...props} />;
}

export function ActionLink({ variant = 'primary', size = 'default', arrow = false, className = '', children, ...props }) {
  return <Link className={actionClasses(variant, size, className)} {...props}>
    {children}{arrow && <span className={styles.arrow} aria-hidden="true">›</span>}
  </Link>;
}

export function FormField({ label, hint, error, id, ...props }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = [hint && `${inputId}-hint`, error && `${inputId}-error`, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
  return <div className={styles.field}>
    <label htmlFor={inputId}>{label}{props.required && ' (obrigatório)'}</label>
    <input {...props} id={inputId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
    {hint && <small id={`${inputId}-hint`}>{hint}</small>}
    {error && <span className={styles.error} id={`${inputId}-error`}>{error}</span>}
  </div>;
}

export function Message({ children, title, variant = 'info' }) {
  return <div className={`${styles.message} ${variant === 'error' ? styles.error : ''}`} role={variant === 'error' ? 'alert' : 'status'}>
    {title && <strong>{title}</strong>}<div>{children}</div>
  </div>;
}

export function Loading({ children = 'Carregando…' }) {
  return <p className={styles.loading} role="status"><span className={styles.spinner} aria-hidden="true" />{children}</p>;
}
