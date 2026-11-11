import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { profiles } from '../auth/access.js';
import PageIntro from '../components/PageIntro.jsx';
import { Button, FormField, Loading, Message } from '../components/ui.jsx';
import { dateFields, displayDate, ensaioError, readEnsaio, validateForm } from './ensaios.js';
import styles from './Ensaios.module.css';

const emptyForm = { data: '', horario: '', local: '', descricao: '' };

export default function Ensaios() {
  const { usuario, session } = useAuth();
  const isDirector = usuario?.perfil === profiles.DIRETORIA;
  const [filter, setFilter] = useState('');
  const [reload, setReload] = useState(0);
  const [list, setList] = useState({ loading: true, ensaios: [], error: '' });
  const [editor, setEditor] = useState(null);
  const [values, setValues] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const operation = useRef(null);
  const panel = useRef(null);
  const agenda = useRef(null);
  const errorBox = useRef(null);

  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    setList({ loading: true, ensaios: [], error: '' });
    (async () => {
      try {
        const data = await session.request(`/ensaios${filter ? `?situacao=${filter}` : ''}`, { signal, cache: 'no-store' });
        if (!Array.isArray(data?.ensaios)) throw new Error('Lista inválida.');
        const ensaios = data.ensaios.map(readEnsaio);
        if (!controller.signal.aborted) setList({ loading: false, ensaios, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setList({ loading: false, ensaios: [], error: ensaioError(error, 'list') });
      }
    })();
    return () => controller.abort();
  }, [session, filter, reload]);

  useEffect(() => {
    if (editor && isDirector) panel.current?.focus();
  }, [editor, isDirector]);
  useEffect(() => {
    if (!isDirector) { setEditor(null); setValues(emptyForm); }
  }, [isDirector]);

  function open(mode, ensaio = null) {
    setSuccess(''); setFailure(''); setErrors({});
    setValues(ensaio ? { ...dateFields(ensaio.inicioEm), local: ensaio.local, descricao: ensaio.descricao ?? '' } : emptyForm);
    setEditor({ mode, ensaio });
  }
  function close() {
    setEditor(null); setFailure(''); setErrors({}); setValues(emptyForm);
    requestAnimationFrame(() => agenda.current?.focus());
  }
  function change(event) { setValues(previous => ({ ...previous, [event.target.name]: event.target.value })); }

  async function submit(event) {
    event.preventDefault();
    if (operation.current || !isDirector || !editor) return;
    setSuccess(''); setFailure('');
    const cancel = editor.mode === 'cancel';
    const { errors: validation, body } = cancel ? { errors: {}, body: {} } : validateForm(values);
    setErrors(validation);
    if (Object.keys(validation).length) {
      requestAnimationFrame(() => panel.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    // Uma correção de texto mantém segundos/milissegundos do instante original.
    if (editor.ensaio && !cancel) {
      const original = dateFields(editor.ensaio.inicioEm);
      if (values.data === original.data && values.horario === original.horario) body.inicioEm = editor.ensaio.inicioEm;
    }
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    try {
      const id = editor.ensaio?.id;
      const path = cancel ? `/ensaios/${id}/cancelamento` : id ? `/ensaios/${id}` : '/ensaios';
      const data = await session.request(path, {
        method: cancel ? 'PATCH' : id ? 'PUT' : 'POST', body,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      const confirmed = readEnsaio(data?.ensaio);
      if ((id && confirmed.id !== id) || confirmed.situacao !== (cancel ? 'CANCELADO' : 'AGENDADO')) throw new Error('Confirmação inválida.');
      if (controller.signal.aborted) return;
      close();
      setSuccess(cancel ? 'Ensaio cancelado. Ele permanece identificado na agenda.' : id ? 'Ensaio atualizado.' : 'Ensaio cadastrado.');
      setReload(previous => previous + 1);
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailure(ensaioError(error, 'save'));
        requestAnimationFrame(() => errorBox.current?.focus());
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      operation.current = null;
    }
  }

  return <section className={styles.page} aria-labelledby="ensaios-title">
    <PageIntro id="ensaios-title" eyebrow="Agenda da bateria" title="Ensaios"
      description="Encontre os próximos encontros e acompanhe a programação da bateria.">
      {isDirector && <Button onClick={() => open('create')} disabled={busy}>Cadastrar ensaio</Button>}
    </PageIntro>
    {success && <Message>{success}</Message>}
    {failure && <div ref={errorBox} tabIndex={-1}><Message variant="error">{failure}</Message></div>}
    {isDirector && editor && <section className={styles.panel} aria-labelledby="editor-title" ref={panel} tabIndex={-1}>
      <h2 id="editor-title">{editor.mode === 'cancel' ? 'Cancelar ensaio' : editor.ensaio ? 'Editar ensaio' : 'Cadastrar ensaio'}</h2>
      <form onSubmit={submit} noValidate aria-busy={busy}>
        {editor.mode === 'cancel' ? <p>Cancelar o ensaio em <strong>{editor.ensaio.local}</strong>, {displayDate(editor.ensaio.inicioEm)}? O registro continuará na agenda e não poderá ser editado.</p> : <>
          <div className={styles.dateRow}>
            <FormField label="Data" name="data" type="date" required min="1970-01-01" max="9999-12-31" value={values.data} onChange={change} error={errors.data} disabled={busy} />
            <FormField label="Horário" name="horario" type="time" required value={values.horario} onChange={change} hint="America/Sao_Paulo" disabled={busy} />
          </div>
          <FormField label="Local" name="local" required maxLength={160} value={values.local} onChange={change} error={errors.local} disabled={busy} />
          <div className={styles.descriptionField}>
            <label htmlFor="ensaio-descricao">Descrição</label>
            <textarea id="ensaio-descricao" name="descricao" maxLength={1000} rows={4} value={values.descricao} onChange={change} disabled={busy}
              aria-invalid={errors.descricao ? true : undefined} aria-describedby="descricao-hint" />
            <small id="descricao-hint">{errors.descricao || 'Opcional. Até 1000 caracteres.'}</small>
          </div>
        </>}
        <div className={styles.actions}>
          <Button type="submit" disabled={busy}>{busy ? 'Aguardando confirmação…' : editor.mode === 'cancel' ? 'Confirmar cancelamento' : 'Salvar ensaio'}</Button>
          <Button variant="secondary" onClick={close} disabled={busy}>Voltar à agenda</Button>
        </div>
      </form>
    </section>}
    <div className={styles.toolbar}>
      <h2 ref={agenda} tabIndex={-1}>Agenda de ensaios</h2>
      <div className={styles.filters}>
        <div className={styles.filterField}>
          <label htmlFor="ensaios-situacao">Situação</label>
          <select id="ensaios-situacao" value={filter} onChange={event => setFilter(event.target.value)} disabled={busy}>
            <option value="">Todas</option><option value="AGENDADO">Agendados</option><option value="CANCELADO">Cancelados</option>
          </select>
        </div>
        <Button variant="secondary" onClick={() => setReload(previous => previous + 1)} disabled={list.loading || busy}>Atualizar agenda</Button>
      </div>
    </div>
    {list.loading ? <Loading>Carregando ensaios…</Loading> : list.error ? <Message variant="error">{list.error}</Message>
      : list.ensaios.length === 0 ? <Message>{filter ? 'Nenhum ensaio nesta situação.' : 'Nenhum ensaio cadastrado.'}</Message>
        : <ul className={styles.list}>{list.ensaios.map(ensaio => <li key={ensaio.id}>
          <article className={styles.card} aria-labelledby={`ensaio-${ensaio.id}`}>
            <div className={styles.cardHeading}><h3 id={`ensaio-${ensaio.id}`}>{ensaio.local}</h3>
              <span className={ensaio.situacao === 'CANCELADO' ? styles.cancelled : styles.scheduled}>{ensaio.situacao === 'CANCELADO' ? 'Cancelado' : 'Agendado'}</span>
            </div>
            <time dateTime={ensaio.inicioEm}>{displayDate(ensaio.inicioEm)}</time>
            {ensaio.descricao && <p className={styles.description}>{ensaio.descricao}</p>}
            {isDirector && ensaio.situacao === 'AGENDADO' && <div className={styles.actions}>
              <Button variant="secondary" disabled={busy} onClick={() => open('edit', ensaio)} aria-label={`Editar ensaio em ${ensaio.local}`}>Editar</Button>
              <Button variant="secondary" disabled={busy} onClick={() => open('cancel', ensaio)} aria-label={`Cancelar ensaio em ${ensaio.local}`}>Cancelar ensaio</Button>
            </div>}
          </article>
        </li>)}</ul>}
  </section>;
}
