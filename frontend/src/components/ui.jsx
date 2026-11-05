import { useId } from 'react';
import styles from './ui.module.css';

export function Button({ variant = 'primary', type = 'button', className = '', ...props }) {
  return <button type={type} className={`${styles.button} ${variant === 'secondary' ? styles.secondary : ''} ${className}`} {...props} />;
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
