import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { profiles } from '../auth/access.js';
import PageIntro from '../components/PageIntro.jsx';
import { Button, Loading, Message } from '../components/ui.jsx';
import InstrumentoForm from './InstrumentoForm.jsx';
import useStockQuery from './useStockQuery.js';
import { instrumentosPath, readEstoque, readInstrumento, readInstrumentos, readTipo, readTipos, situacoes, stockError } from './instrumentos.js';
import styles from './Instrumentos.module.css';

function QueryState({ query, empty, children }) {
  if (query.loading) return <Loading>Carregando dados…</Loading>;
  if (query.error) return <Message variant="error">{query.error}</Message>;
  if (!query.data.length) return <Message>{empty}</Message>;
  return children;
}

export default function Instrumentos() {
  const { usuario, session } = useAuth();
  const isDirector = usuario?.perfil === profiles.DIRETORIA;
  const [revision, setRevision] = useState(0);
  const [filters, setFilters] = useState({ tipoInstrumentoId: '', situacao: '' });
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  const operation = useRef(null);
  const sequence = useRef(0);
  const heading = useRef(null);
  const errorBox = useRef(null);
  const tipos = useStockQuery(session, '/tipos-instrumentos', readTipos, revision);
  const unidades = useStockQuery(session, instrumentosPath(filters), readInstrumentos, revision);
  const estoque = useStockQuery(session, '/estoque', readEstoque, revision);
  const tiposReady = !tipos.loading && !tipos.error;
  const tipoNames = new Map(tipos.data.map(tipo => [tipo.id, tipo.nome]));

  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => { if (!isDirector) setEditor(null); }, [isDirector]);
  function open(kind, original = null) {
    setFailure(''); setSuccess('');
    setEditor({ kind, original, key: ++sequence.current });
  }
  function close() {
    setEditor(null); setFailure('');
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function save({ kind, original, body }) {
    if (operation.current || !isDirector) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true); setFailure(''); setSuccess('');
    try {
      const path = kind === 'tipo' ? '/tipos-instrumentos' : '/instrumentos';
      const data = await session.request(`${path}${original ? `/${original.id}` : ''}`, {
        method: original ? 'PUT' : 'POST', body,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      const confirmed = kind === 'tipo' ? readTipo(data?.tipoInstrumento) : readInstrumento(data?.instrumento);
      if ((original && confirmed.id !== original.id) || (!original && kind === 'unidade' && confirmed.situacao !== 'DISPONIVEL')) throw new Error('Confirmação inválida.');
      if (controller.signal.aborted) return;
      close();
      setSuccess(kind === 'tipo' ? original ? 'Tipo atualizado com sucesso.' : 'Tipo cadastrado com sucesso.'
        : original ? 'Unidade atualizada com sucesso.' : 'Unidade cadastrada com sucesso.');
      setRevision(previous => previous + 1);
    } catch (error) {
      if (!controller.signal.aborted) {
        setFailure(stockError(error, 'save'));
        requestAnimationFrame(() => errorBox.current?.focus());
      }
      throw error;
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      operation.current = null;
    }
  }
  function filter(event) { setFilters(previous => ({ ...previous, [event.target.name]: event.target.value })); }

  return <section className={styles.page} aria-labelledby="instrumentos-title">
    <PageIntro id="instrumentos-title" eyebrow="Instrumentos da bateria" title="Instrumentos e estoque"
      description="Consulte os tipos, acompanhe as unidades e confira o que está disponível.">
      <div className={styles.actions}>
        {isDirector && <>
          <Button onClick={() => open('tipo')} disabled={busy}>Cadastrar tipo</Button>
          <Button variant="secondary" onClick={() => open('unidade')} disabled={busy || !tiposReady || !tipos.data.length}>Cadastrar unidade</Button>
        </>}
        <Button variant="secondary" onClick={() => setRevision(previous => previous + 1)} disabled={busy || (tipos.loading && unidades.loading && estoque.loading)}>Atualizar consultas</Button>
      </div>
    </PageIntro>
    {success && <Message>{success}</Message>}
    {failure && <div tabIndex={-1} ref={errorBox}><Message variant="error">{failure}</Message></div>}
    {tipos.loading && <Loading>Carregando tipos de instrumentos…</Loading>}
    {tipos.error && <Message variant="error" title="Tipos de instrumentos">{tipos.error}</Message>}
    {isDirector && editor && <InstrumentoForm key={editor.key} kind={editor.kind} original={editor.original} tipos={tipos} busy={busy} onSave={save} onClose={close} />}
    <section className={styles.section} aria-labelledby="estoque-title">
      <h2 id="estoque-title">Disponibilidade por tipo</h2>
      <p className={styles.note}>Somente unidades disponíveis entram na disponibilidade. Tipos sem unidades também aparecem no resumo.</p>
      <QueryState query={estoque} empty="Nenhum tipo cadastrado para consultar a disponibilidade.">
        <ul className={styles.summary}>{estoque.data.map(row => <li key={row.tipoInstrumentoId}>
          <article className={styles.summaryCard} aria-labelledby={`estoque-${row.tipoInstrumentoId}`}>
            <h3 id={`estoque-${row.tipoInstrumentoId}`}>{row.nome}</h3>
            <dl className={styles.counts}>
              <div><dt>Disponíveis</dt><dd className={styles.available}>{row.disponiveis}</dd></div>
              <div><dt>Total</dt><dd>{row.total}</dd></div>
              <div><dt>Emprestados</dt><dd>{row.emprestados}</dd></div>
              <div><dt>Em manutenção</dt><dd>{row.emManutencao}</dd></div>
            </dl>
            {isDirector && <Button variant="secondary" disabled={busy} onClick={() => open('tipo', { id: row.tipoInstrumentoId, nome: row.nome })} aria-label={`Editar tipo ${row.nome}`}>Editar</Button>}
          </article>
        </li>)}</ul>
      </QueryState>
    </section>
      <section className={styles.section} aria-labelledby="unidades-title">
        <h2 id="unidades-title" ref={heading} tabIndex={-1}>Unidades</h2>
        <div className={styles.filters}>
          <div className={styles.filter}><label htmlFor="filtro-tipo">Filtrar por tipo</label>
            <select id="filtro-tipo" name="tipoInstrumentoId" value={filters.tipoInstrumentoId} onChange={filter} disabled={busy || !tiposReady}>
              <option value="">Todos os tipos</option>
              {tipos.data.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
            </select>
          </div>
          <div className={styles.filter}><label htmlFor="filtro-situacao">Filtrar por situação</label>
            <select id="filtro-situacao" name="situacao" value={filters.situacao} onChange={filter} disabled={busy}>
              <option value="">Todas as situações</option>
              {Object.entries(situacoes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <Button variant="secondary" onClick={() => setFilters({ tipoInstrumentoId: '', situacao: '' })} disabled={busy || (!filters.tipoInstrumentoId && !filters.situacao)}>Limpar filtros</Button>
        </div>
        <QueryState query={unidades} empty={filters.tipoInstrumentoId || filters.situacao ? 'Nenhuma unidade encontrada com esses filtros.' : 'Nenhuma unidade cadastrada.'}>
          <ul className={styles.units}>{unidades.data.map(unidade => <li key={unidade.id}>
            <article className={styles.unit} aria-labelledby={`unidade-${unidade.id}`}>
              <div className={styles.unitHeading}><h3 id={`unidade-${unidade.id}`}>{unidade.identificacao}</h3>
                <span className={`${styles.badge} ${unidade.situacao === 'DISPONIVEL' ? styles.available : ''}`}>{situacoes[unidade.situacao]}</span>
              </div>
              <p className={styles.note}>{tipoNames.get(unidade.tipoInstrumentoId) ?? 'Tipo não disponível na consulta'}</p>
              {unidade.observacoes && <p className={styles.observations}>{unidade.observacoes}</p>}
              {isDirector && <Button variant="secondary" disabled={busy || !tiposReady} onClick={() => open('unidade', unidade)} aria-label={`Editar unidade ${unidade.identificacao}`}>Editar unidade</Button>}
            </article>
          </li>)}</ul>
        </QueryState>
      </section>
  </section>;
}
