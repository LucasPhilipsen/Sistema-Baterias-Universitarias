import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { profiles } from '../auth/access.js';
import PageIntro from '../components/PageIntro.jsx';
import { Button, FormField, Loading, Message } from '../components/ui.jsx';
import IntegranteForm from './IntegranteForm.jsx';
import { integranteError, readIntegrante, readIntegrantes } from './integrantes.js';
import styles from './Integrantes.module.css';

export default function Integrantes() {
  const { usuario, session } = useAuth();
  const allowed = usuario?.perfil === profiles.DIRETORIA;
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState({ loading: true, data: [], error: '' });
  const [filter, setFilter] = useState('');
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const operation = useRef(null);
  const heading = useRef(null);
  const panel = useRef(null);

  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setList({ loading: true, data: [], error: '' });
    (async () => {
      try {
        const result = await session.request('/integrantes', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        const data = readIntegrantes(result);
        if (!controller.signal.aborted) setList({ loading: false, data, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setList({ loading: false, data: [], error: integranteError(error) });
      }
    })();
    return () => controller.abort();
  }, [session, revision, allowed]);
  useEffect(() => { if (editor && editor.mode !== 'create' && editor.mode !== 'edit') panel.current?.focus(); }, [editor]);

  function close() {
    operation.current?.abort(); operation.current = null;
    setEditor(null);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function open(mode, id) {
    if (busy || !allowed) return;
    operation.current?.abort();
    setSuccess('');
    if (mode === 'create') { operation.current = null; setEditor({ mode }); return; }
    const controller = new AbortController();
    operation.current = controller;
    setEditor({ mode: 'loading', id });
    try {
      const data = await session.request(`/integrantes/${id}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
      const integrante = readIntegrante(data?.integrante);
      if (integrante.id !== id) throw new Error('Consulta inválida.');
      if (!controller.signal.aborted) setEditor({ mode, integrante });
    } catch (error) {
      if (!controller.signal.aborted) setEditor({ mode: 'error', id, retryMode: mode, error: integranteError(error) });
    } finally {
      if (operation.current === controller) operation.current = null;
    }
  }
  async function save(body, id) {
    if (operation.current || !allowed) return;
    const controller = new AbortController();
    operation.current = controller; setBusy(true); setSuccess('');
    try {
      const result = await session.request(id ? `/integrantes/${id}` : '/integrantes', {
        method: id ? 'PUT' : 'POST', body, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      const confirmed = readIntegrante(result?.integrante);
      if ((id && confirmed.id !== id) || confirmed.nome !== body.nome || confirmed.email !== body.email) throw new Error('Confirmação inválida.');
      if (controller.signal.aborted) return;
      setEditor(null); setFilter('');
      setSuccess(id ? 'Integrante atualizado com sucesso.' : 'Integrante cadastrado com sucesso.');
      setRevision(value => value + 1);
      requestAnimationFrame(() => heading.current?.focus());
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (operation.current === controller) operation.current = null;
    }
  }

  if (!allowed) return null;
  const term = filter.trim().toLocaleLowerCase('pt-BR');
  const visible = list.data.filter(item => `${item.nome} ${item.email}`.toLocaleLowerCase('pt-BR').includes(term));
  return <section className={styles.page} aria-labelledby="integrantes-title">
    <PageIntro id="integrantes-title" eyebrow="Diretoria" title="Integrantes" description="Mantenha os dados de quem faz parte da sua bateria atualizados.">
      <Button onClick={() => open('create')} disabled={busy}>Cadastrar integrante</Button>
    </PageIntro>
    {success && <Message>{success}</Message>}
    {editor && ['create', 'edit'].includes(editor.mode) && <IntegranteForm key={`${editor.mode}-${editor.integrante?.id ?? 'new'}`} original={editor.integrante} busy={busy} onSave={save} onClose={close} />}
    {editor && !['create', 'edit'].includes(editor.mode) && <section className={styles.panel} ref={panel} tabIndex={-1} aria-labelledby="integrante-detail-title">
      <h2 id="integrante-detail-title">Consultar integrante</h2>
      {editor.mode === 'loading' ? <Loading>Carregando integrante…</Loading> : editor.mode === 'error' ? <>
        <Message variant="error">{editor.error}</Message><Button onClick={() => open(editor.retryMode, editor.id)}>Tentar novamente</Button>
      </> : <>
        <dl className={styles.details}><dt>Nome</dt><dd>{editor.integrante.nome}</dd><dt>E-mail</dt><dd>{editor.integrante.email}</dd><dt>Perfil</dt><dd>Integrante</dd></dl>
        <Button onClick={() => open('edit', editor.integrante.id)}>Editar integrante</Button>
      </>}
      <div className={styles.actions}><Button variant="secondary" onClick={close}>Voltar à lista</Button></div>
    </section>}
    <section className={styles.section} aria-labelledby="integrantes-list-title">
      <div className={styles.toolbar}>
        <h2 id="integrantes-list-title" ref={heading} tabIndex={-1}>Integrantes cadastrados</h2>
        <Button variant="secondary" onClick={() => setRevision(value => value + 1)} disabled={list.loading || busy}>Atualizar lista</Button>
      </div>
      <div className={styles.search}><FormField label="Buscar por nome ou e-mail" name="busca" type="search" value={filter} onChange={event => setFilter(event.target.value)} /></div>
      {list.loading ? <Loading>Carregando integrantes…</Loading> : list.error ? <Message variant="error">{list.error}</Message>
        : list.data.length === 0 ? <Message>Nenhum integrante cadastrado.</Message>
          : visible.length === 0 ? <Message>Nenhum integrante encontrado para esta busca.</Message>
            : <ul className={styles.list}>{visible.map(item => <li key={item.id}>
              <article className={styles.member} aria-labelledby={`integrante-${item.id}`}>
                <div className={styles.identity}><h3 id={`integrante-${item.id}`}>{item.nome}</h3><p>{item.email}</p></div>
                <div className={styles.actions}>
                  <Button variant="secondary" disabled={busy} onClick={() => open('view', item.id)} aria-label={`Consultar ${item.nome}`}>Consultar</Button>
                  <Button variant="secondary" disabled={busy} onClick={() => open('edit', item.id)} aria-label={`Editar ${item.nome}`}>Editar</Button>
                </div>
              </article>
            </li>)}</ul>}
    </section>
  </section>;
}
