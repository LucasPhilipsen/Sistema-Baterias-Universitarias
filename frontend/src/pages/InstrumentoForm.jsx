import { useEffect, useRef, useState } from 'react';
import { Button, FormField, Message } from '../components/ui.jsx';
import { situacoes, stockFieldErrors, validateInstrumento, validateTipo } from './instrumentos.js';
import styles from './Instrumentos.module.css';

export default function InstrumentoForm({ kind, original, tipos, busy, onSave, onClose }) {
  const typeForm = kind === 'tipo';
  const [values, setValues] = useState(() => typeForm ? { nome: original?.nome ?? '' } : {
    tipoInstrumentoId: original ? String(original.tipoInstrumentoId) : '', identificacao: original?.identificacao ?? '', observacoes: original?.observacoes ?? '',
  });
  const [errors, setErrors] = useState({});
  const panel = useRef(null);
  const mounted = useRef(false);
  const typeLocked = Boolean(original && !typeForm && original.situacao !== 'DISPONIVEL');
  const ready = typeForm || (!tipos.loading && !tipos.error && tipos.data.length > 0);
  useEffect(() => {
    mounted.current = true;
    panel.current?.focus();
    return () => { mounted.current = false; };
  }, []);
  function change(event) {
    const { name, value } = event.target;
    setValues(previous => ({ ...previous, [name]: value }));
    setErrors(previous => ({ ...previous, [name]: undefined }));
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || !ready) return;
    const { errors: validation, body } = typeForm ? validateTipo(values) : validateInstrumento(values, tipos.data);
    setErrors(validation);
    if (Object.keys(validation).length) {
      requestAnimationFrame(() => panel.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    try { await onSave({ kind, original, body }); }
    catch (error) { if (mounted.current) setErrors(stockFieldErrors(error)); }
  }
  return <section className={styles.panel} ref={panel} tabIndex={-1} aria-labelledby="instrumento-form-title">
    <h2 id="instrumento-form-title">{original ? 'Editar' : 'Cadastrar'} {typeForm ? 'tipo' : 'unidade'}</h2>
    <form onSubmit={submit} noValidate aria-busy={busy}>
      {typeForm ? <FormField label="Nome do tipo" name="nome" required value={values.nome} onChange={change} error={errors.nome} hint="De 1 a 80 caracteres. O nome é único, desconsiderando maiúsculas e minúsculas." disabled={busy} /> : <>
        <div className={styles.field}>
          <label htmlFor="unidade-tipo">Tipo de instrumento (obrigatório)</label>
          <select id="unidade-tipo" name="tipoInstrumentoId" required value={values.tipoInstrumentoId} onChange={change} disabled={busy || !ready || typeLocked}
            aria-invalid={errors.tipoInstrumentoId ? true : undefined} aria-describedby="unidade-tipo-hint unidade-tipo-error">
            <option value="">Selecione um tipo</option>
            {tipos.data.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
          </select>
          <small id="unidade-tipo-hint">{typeLocked ? 'O tipo só pode ser alterado quando a unidade está disponível.' : 'Opções consultadas no cadastro de tipos.'}</small>
          <span id="unidade-tipo-error" className={styles.error}>{errors.tipoInstrumentoId}</span>
        </div>
        {!ready && <Message>{tipos.loading ? 'Carregando os tipos para o formulário…' : tipos.error ? 'Atualize as consultas para carregar os tipos antes de salvar uma unidade.' : 'Cadastre um tipo antes de cadastrar unidades.'}</Message>}
        <FormField label="Identificação" name="identificacao" required maxLength={40} value={values.identificacao} onChange={change} error={errors.identificacao}
          hint="Até 40 caracteres: letras de A a Z, números, hífen e sublinhado. Será salva em maiúsculas." disabled={busy} />
        <div className={styles.field}>
          <label htmlFor="unidade-observacoes">Observações</label>
          <textarea id="unidade-observacoes" name="observacoes" rows={4} value={values.observacoes} onChange={change} disabled={busy}
            aria-invalid={errors.observacoes ? true : undefined} aria-describedby="unidade-observacoes-hint" />
          <small id="unidade-observacoes-hint" className={errors.observacoes ? styles.error : undefined}>{errors.observacoes || 'Opcional. Até 500 caracteres.'}</small>
        </div>
        <p className={styles.situation}>Situação: <strong>{situacoes[original?.situacao ?? 'DISPONIVEL']}</strong>. {original ? 'A situação é consultada e não é alterada por este formulário.' : 'Toda unidade nova começa disponível.'}</p>
      </>}
      <div className={styles.actions}>
        <Button type="submit" disabled={busy || !ready}>{busy ? 'Aguardando confirmação…' : typeForm ? 'Salvar tipo' : 'Salvar unidade'}</Button>
        <Button variant="secondary" onClick={onClose} disabled={busy}>Fechar formulário</Button>
      </div>
    </form>
  </section>;
}
