import { useEffect, useId, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { profiles } from '../auth/access.js';
import PageIntro from '../components/PageIntro.jsx';
import { Button, Loading, Message } from '../components/ui.jsx';
import { displayDate } from './ensaios.js';
import { demandaError, displayCalculatedAt, readScheduledEnsaios } from './demanda.js';
import useDemanda from './useDemanda.js';
import styles from './Demanda.module.css';

export default function Demanda() {
  const { usuario, session } = useAuth();
  const allowed = usuario?.perfil === profiles.DIRETORIA;
  const selectId = useId();
  const [agendaRevision, setAgendaRevision] = useState(0);
  const [revision, setRevision] = useState(0);
  const [agenda, setAgenda] = useState({ loading: true, data: [], error: '' });
  const [selected, setSelected] = useState('');
  const ensaio = !agenda.loading && !agenda.error ? agenda.data.find(item => String(item.id) === selected) : null;
  const result = useDemanda(session, allowed ? ensaio?.id : null, revision);
  const loading = Boolean(ensaio) && (result.ensaioId !== ensaio.id || result.revision !== revision || result.loading);
  const current = ensaio && result.ensaioId === ensaio.id && !loading ? result : null;

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setAgenda({ loading: true, data: [], error: '' });
    (async () => {
      try {
        const result = await session.request('/ensaios?situacao=AGENDADO', {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const data = readScheduledEnsaios(result);
        if (controller.signal.aborted) return;
        setAgenda({ loading: false, data, error: '' });
        setSelected(previous => data.some(item => String(item.id) === previous) ? previous : '');
      } catch (error) {
        if (!controller.signal.aborted) setAgenda({ loading: false, data: [], error: demandaError(error, 'agenda') });
      }
    })();
    return () => controller.abort();
  }, [allowed, session, agendaRevision]);

  if (!allowed) return null;
  return <section className={styles.page} aria-labelledby="demanda-title">
    <PageIntro id="demanda-title" eyebrow="Diretoria" title="Demanda e disponibilidade"
      description="Compare as confirmações de um ensaio com os instrumentos disponíveis agora." />
    <Message title="Previsão com o estoque atual">Esta comparação não reserva unidades e não garante a disponibilidade na data do ensaio.</Message>
    <section className={styles.section} aria-labelledby="demanda-select-title">
      <div className={styles.toolbar}>
        <h2 id="demanda-select-title">Escolha um ensaio</h2>
        <Button variant="secondary" onClick={() => setAgendaRevision(value => value + 1)} disabled={agenda.loading}>Atualizar ensaios</Button>
      </div>
      {agenda.loading ? <Loading>Carregando ensaios…</Loading> : agenda.error ? <Message variant="error">{agenda.error}</Message>
        : agenda.data.length === 0 ? <Message>Nenhum ensaio agendado para comparar.</Message> : <div className={styles.controls}>
          <div className={styles.field}>
            <label htmlFor={selectId}>Ensaio</label>
            <select id={selectId} value={selected} onChange={event => setSelected(event.target.value)} aria-describedby={`${selectId}-hint`}>
              <option value="">Selecione um ensaio</option>
              {agenda.data.map(item => <option key={item.id} value={item.id}>{displayDate(item.inicioEm)} · {item.local}</option>)}
            </select>
            <small id={`${selectId}-hint`}>Somente ensaios agendados. Horários em America/Sao_Paulo.</small>
          </div>
          <Button onClick={() => setRevision(value => value + 1)} disabled={!ensaio || loading}>Atualizar comparação</Button>
        </div>}
    </section>
    {ensaio ? <section className={styles.section} aria-labelledby="demanda-result-title" aria-busy={loading}>
      <div><h2 id="demanda-result-title">Comparação por tipo</h2><p className={styles.context}>{ensaio.local} · {displayDate(ensaio.inicioEm)}</p></div>
      {loading ? <Loading>Carregando comparação…</Loading> : current?.error ? <Message variant="error">{current.error}</Message>
        : current?.data && <>
          <p className={styles.timestamp}>Estoque consultado em <time dateTime={current.data.calculadoEm}>{displayCalculatedAt(current.data.calculadoEm)}</time> (America/Sao_Paulo).</p>
          {current.data.tipos.length === 0 ? <Message>Nenhum tipo de instrumento cadastrado para comparar.</Message> : <>
            {current.data.tipos.some(item => item.falta > 0)
              ? <Message title="Há instrumentos insuficientes">Confira os tipos destacados e as quantidades em falta.</Message>
              : <Message>O estoque atual atende às confirmações deste ensaio.</Message>}
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.caption}>Confirmações, estoque disponível e falta por tipo de instrumento</caption>
                <thead><tr><th scope="col">Tipo de instrumento</th><th scope="col">Confirmados</th><th scope="col">Disponíveis</th><th scope="col">Falta</th></tr></thead>
                <tbody>{current.data.tipos.map(item => <tr key={item.tipoInstrumentoId} className={item.falta > 0 ? styles.shortage : undefined}>
                  <th scope="row">{item.nome}{item.falta > 0 && <span className={styles.badge}>Insuficiente</span>}</th>
                  <td data-label="Confirmados">{item.confirmados}</td><td data-label="Disponíveis">{item.disponiveis}</td><td data-label="Falta">{item.falta}</td>
                </tr>)}</tbody>
              </table>
            </div>
          </>}
        </>}
    </section> : !agenda.loading && !agenda.error && agenda.data.length > 0 && <Message>Selecione um ensaio para consultar a demanda e a disponibilidade.</Message>}
  </section>;
}
