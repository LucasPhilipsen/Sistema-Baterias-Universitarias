import { useEffect, useRef, useState } from 'react';
import { Button, FormField, Message } from '../components/ui.jsx';
import { integranteError, validateIntegrante } from './integrantes.js';
import styles from './Integrantes.module.css';

export default function IntegranteForm({ original, busy, onSave, onClose }) {
  const [values, setValues] = useState({ nome: original?.nome ?? '', email: original?.email ?? '', senha: '' });
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const panel = useRef(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    panel.current?.focus();
    return () => { mounted.current = false; };
  }, []);
  function change({ target: { name, value } }) {
    setValues(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: undefined }));
    setFailure('');
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const { errors: validation, body } = validateIntegrante(values, !original);
    setErrors(validation); setFailure('');
    if (Object.keys(validation).length) {
      requestAnimationFrame(() => panel.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    try { await onSave(body, original?.id); }
    catch (error) {
      if (!mounted.current) return;
      setFailure(integranteError(error, true));
      if (error.data?.error?.code === 'EMAIL_DUPLICADO') {
        setErrors({ email: 'Já existe uma conta com este e-mail.' });
        requestAnimationFrame(() => panel.current?.querySelector('[name="email"]')?.focus());
      } else requestAnimationFrame(() => panel.current?.querySelector('[data-failure]')?.focus());
    }
  }
  return <section className={styles.panel} ref={panel} tabIndex={-1} aria-labelledby="integrante-form-title">
    <h2 id="integrante-form-title">{original ? 'Editar integrante' : 'Cadastrar integrante'}</h2>
    <p className={styles.note}>{original ? 'Atualize nome e e-mail. O próximo login usará o e-mail atualizado.' : 'Crie uma conta de integrante para acessar o sistema.'}</p>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      {failure && <div tabIndex={-1} data-failure className={styles.failure}><Message variant="error">{failure}</Message></div>}
      <FormField label="Nome" name="nome" required autoComplete="name" value={values.nome} onChange={change} error={errors.nome} hint="Até 120 caracteres." disabled={busy} />
      <FormField label="E-mail" name="email" type="email" required autoComplete="email" value={values.email} onChange={change} error={errors.email} hint="Será salvo em minúsculas. Deve ser único entre todas as contas." disabled={busy} />
      {!original && <FormField label="Senha inicial" name="senha" type="password" required autoComplete="new-password" value={values.senha} onChange={change} error={errors.senha} hint="Pelo menos 12 caracteres e até 1024 bytes. Espaços fazem parte da senha." disabled={busy} />}
      {busy && <Message>Aguardando confirmação da gravação…</Message>}
      <div className={styles.actions}>
        <Button type="submit" disabled={busy}>{busy ? 'Salvando…' : 'Salvar integrante'}</Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Fechar formulário</Button>
      </div>
    </form>
  </section>;
}
