import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { profiles } from '../auth/access.js';
import PageIntro from '../components/PageIntro.jsx';
import { Button, Loading, Message } from '../components/ui.jsx';
import { displayLoanDate, emprestimoError, readEmprestimo, validateRetirada } from './emprestimos.js';
import { useEmprestimos } from './useEmprestimos.js';
import styles from './Emprestimos.module.css';

function SelectField({ label, value, onChange, options, optionLabel, error, disabled, inputRef }) {
  const id = useId();
  return <div className={styles.field}>
    <label htmlFor={id}>{label} (obrigatório)</label>
    <select id={id} ref={inputRef} value={value} onChange={onChange} required disabled={disabled}
      aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
      <option value="">Selecione {label === 'Integrante' ? 'um integrante' : 'uma unidade'}</option>
      {options.map(item => <option key={item.id} value={item.id}>{optionLabel(item)}</option>)}
    </select>
    {error && <span id={`${id}-error`} className={styles.error}>{error}</span>}
  </div>;
}

export default function Emprestimos() {
  const { usuario, session } = useAuth();
  const director = usuario?.perfil === profiles.DIRETORIA;
  const identity = usuario ? `${usuario.id}:${usuario.perfil}` : '';
  const [revision, setRevision] = useState(0);
  const { history, options } = useEmprestimos(session, identity, revision, director);
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState({ integranteId: '', instrumentoId: '' });
  const [errors, setErrors] = useState({});
  const [returnId, setReturnId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const operation = useRef(null);
  const heading = useRef(null);
  const firstField = useRef(null);
  const unitField = useRef(null);
  const returnPanel = useRef(null);
  const returnTrigger = useRef(null);
  const newTrigger = useRef(null);

  useEffect(() => {
    setCreating(false); setReturnId(null); setValues({ integranteId: '', instrumentoId: '' }); setErrors({}); setBusy(false);
    return () => { operation.current?.abort(); operation.current = null; };
  }, [identity, session]);
  useEffect(() => {
    if (!options.data) return;
    setValues(previous => ({
      integranteId: options.data.integrantes.some(item => String(item.id) === previous.integranteId) ? previous.integranteId : '',
      instrumentoId: options.data.instrumentos.some(item => String(item.id) === previous.instrumentoId) ? previous.instrumentoId : '',
    }));
  }, [options.data]);
  useEffect(() => { if (creating && options.data) firstField.current?.focus(); }, [creating, options.data]);
  useEffect(() => { if (returnId) returnPanel.current?.focus(); }, [returnId]);
  useEffect(() => {
    if (history.data && returnId && !history.data.some(item => item.id === returnId && item.situacao === 'ATIVO')) setReturnId(null);
  }, [history.data, returnId]);

  const records = history.data ?? [];
  const returning = records.find(item => item.id === returnId && item.situacao === 'ATIVO');
  const loading = history.loading || director && options.loading;
  function refresh() { if (!operation.current) setRevision(value => value + 1); }
  function closeReturn() {
    setReturnId(null);
    requestAnimationFrame(() => (returnTrigger.current?.isConnected ? returnTrigger.current : heading.current)?.focus());
  }
  async function mutate(body, original) {
    if (!director || operation.current || history.loading || history.error) return;
    const controller = new AbortController();
    operation.current = controller; setBusy(true); setNotice(null);
    try {
      const data = await session.request(original ? `/emprestimos/${original.id}/devolucao` : '/emprestimos', {
        method: original ? 'PUT' : 'POST', body,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      const saved = readEmprestimo(data?.emprestimo);
      if (original ? saved.id !== original.id || saved.situacao !== 'DEVOLVIDO'
        || saved.integrante.id !== original.integrante.id || saved.instrumento.id !== original.instrumento.id
        || Date.parse(saved.retiradaEm) !== Date.parse(original.retiradaEm)
        : saved.situacao !== 'ATIVO' || saved.integrante.id !== body.integranteId || saved.instrumento.id !== body.instrumentoId) throw new Error('Confirmação inválida.');
      if (controller.signal.aborted) return;
      setNotice({ identity, text: original ? 'Devolução registrada com sucesso.' : 'Retirada registrada com sucesso.' });
      setCreating(false); setReturnId(null); setValues({ integranteId: '', instrumentoId: '' }); setErrors({});
      requestAnimationFrame(() => heading.current?.focus());
    } catch (error) {
      if (!controller.signal.aborted) {
        setNotice({ identity, text: emprestimoError(error, true), error: true });
        setReturnId(null);
        if (original) requestAnimationFrame(() => heading.current?.focus());
      }
    } finally {
      if (!controller.signal.aborted) { setBusy(false); setRevision(value => value + 1); }
      if (operation.current === controller) operation.current = null;
    }
  }
  function submit(event) {
    event.preventDefault();
    if (busy || !options.data || history.loading || history.error) return;
    const validation = validateRetirada(values, options.data.integrantes, options.data.instrumentos);
    setErrors(validation.errors);
    if (Object.keys(validation.errors).length) {
      (validation.errors.integranteId ? firstField : unitField).current?.focus(); return;
    }
    void mutate(validation.body);
  }
  function change(key, value) { setValues(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: '' })); }

  return <section className={styles.page} aria-labelledby="emprestimos-title">
    <PageIntro id="emprestimos-title" eyebrow={director ? 'Diretoria' : 'Minha bateria'} title="Empréstimos"
      description={director ? 'Registre retiradas, acompanhe os responsáveis e confira as devoluções.' : 'Consulte os instrumentos que estão com você e o histórico das suas devoluções.'}>
      {director && <Button ref={newTrigger} disabled={busy || creating || Boolean(returnId)} onClick={() => { setCreating(true); setErrors({}); setNotice(null); refresh(); }}>Registrar retirada</Button>}
    </PageIntro>
    {notice?.identity === identity && <Message variant={notice.error ? 'error' : 'info'}>{notice.text}</Message>}
    {director && creating && <section className={styles.panel} aria-labelledby="retirada-title">
      <h2 id="retirada-title">Nova retirada</h2>
      {options.loading ? <Loading>Carregando integrantes e unidades disponíveis…</Loading> : options.error ? <Message variant="error">{emprestimoError(options.error)}</Message> : <>
        {options.data.integrantes.length === 0 && <Message>Nenhum integrante cadastrado. Cadastre um integrante e atualize as consultas.</Message>}
        {options.data.instrumentos.length === 0 && <Message>Nenhuma unidade disponível para retirada.</Message>}
        <form onSubmit={submit} noValidate aria-busy={busy} className={styles.section}>
          <div className={styles.fields}>
            <SelectField label="Integrante" value={values.integranteId} onChange={event => change('integranteId', event.target.value)} options={options.data.integrantes} optionLabel={item => item.nome} error={errors.integranteId} disabled={busy} inputRef={firstField} />
            <SelectField label="Unidade" value={values.instrumentoId} onChange={event => change('instrumentoId', event.target.value)} options={options.data.instrumentos} optionLabel={item => item.identificacao} error={errors.instrumentoId} disabled={busy} inputRef={unitField} />
          </div>
          <p className={styles.hint}>Confira o responsável e a unidade antes de confirmar a retirada.</p>
          <div className={styles.actions}><Button type="submit" disabled={busy || history.loading || Boolean(history.error) || !options.data.integrantes.length || !options.data.instrumentos.length}>{busy ? 'Registrando…' : 'Confirmar retirada'}</Button></div>
        </form>
      </>}
      <div className={styles.actions}><Button variant="secondary" disabled={busy} onClick={() => { setCreating(false); setErrors({}); requestAnimationFrame(() => newTrigger.current?.focus()); }}>Fechar cadastro</Button></div>
    </section>}
    {director && returning && <section className={styles.panel} ref={returnPanel} tabIndex={-1} aria-labelledby="devolucao-title">
      <h2 id="devolucao-title">Confirmar devolução</h2>
      <p>Registrar a devolução de <strong>{returning.instrumento.identificacao}</strong>, sob responsabilidade de {returning.integrante.nome}?</p>
      <p className={styles.hint}>A devolução libera a unidade para uma nova retirada.</p>
      <div className={styles.actions}>
        <Button disabled={busy || history.loading} onClick={() => void mutate({}, returning)}>{busy ? 'Registrando…' : 'Confirmar devolução'}</Button>
        <Button variant="secondary" disabled={busy} onClick={closeReturn}>Voltar ao histórico</Button>
      </div>
    </section>}
    <section className={styles.section} aria-labelledby="emprestimos-history-title" aria-busy={history.loading}>
      <div className={styles.toolbar}>
        <h2 id="emprestimos-history-title" ref={heading} tabIndex={-1}>{director ? 'Histórico de empréstimos' : 'Meu histórico de empréstimos'}</h2>
        <Button variant="secondary" onClick={refresh} disabled={busy || loading}>Atualizar consultas</Button>
      </div>
      <p className={styles.hint}>Datas e horários em America/Sao_Paulo.</p>
      {director && !creating && options.error && <Message variant="error">Não foi possível consultar integrantes e unidades disponíveis. Atualize as consultas para tentar novamente.</Message>}
      {history.loading ? <Loading>Carregando histórico…</Loading> : history.error ? <Message variant="error">{emprestimoError(history.error)}</Message>
        : records.length === 0 ? <Message>{director ? 'Nenhum empréstimo registrado.' : 'Você ainda não possui empréstimos registrados.'}</Message>
          : <ul className={styles.list}>{records.map(item => <li key={item.id}>
            <article className={styles.loan} aria-labelledby={`emprestimo-${item.id}`}>
              <div className={styles.toolbar}><h3 id={`emprestimo-${item.id}`}>{item.instrumento.identificacao}</h3><span className={`${styles.badge} ${item.situacao === 'ATIVO' ? styles.active : ''}`}>{item.situacao === 'ATIVO' ? 'Em andamento' : 'Devolvido'}</span></div>
              <dl className={styles.details}>
                <div><dt>Responsável</dt><dd>{item.integrante.nome}</dd></div>
                <div><dt>Retirada</dt><dd><time dateTime={item.retiradaEm}>{displayLoanDate(item.retiradaEm)}</time></dd></div>
                <div><dt>Devolução</dt><dd>{item.devolucaoEm ? <time dateTime={item.devolucaoEm}>{displayLoanDate(item.devolucaoEm)}</time> : 'Ainda não devolvido'}</dd></div>
              </dl>
              {director && item.situacao === 'ATIVO' && <div className={styles.actions}><Button variant="secondary" disabled={busy || creating || Boolean(returnId)} onClick={event => { returnTrigger.current = event.currentTarget; setNotice(null); setReturnId(item.id); }}>Registrar devolução de {item.instrumento.identificacao}</Button></div>}
            </article>
          </li>)}</ul>}
    </section>
  </section>;
}
