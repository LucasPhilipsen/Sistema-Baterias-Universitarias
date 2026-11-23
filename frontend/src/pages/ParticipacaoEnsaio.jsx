import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';
import { Button, Loading, Message } from '../components/ui.jsx';
import { participacaoError, readParticipacao, validateParticipacao } from './participacoes.js';
import styles from './ParticipacaoEnsaio.module.css';

export default function ParticipacaoEnsaio({ ensaio, tipos, disabled, onBusyChange }) {
  const { session } = useAuth();
  const fieldId = useId();
  const [revision, setRevision] = useState(0);
  const [query, setQuery] = useState({ loading: true, data: null, error: '' });
  const [selected, setSelected] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [failure, setFailure] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [locked, setLocked] = useState(false);
  const operation = useRef(null);
  const select = useRef(null);
  const failureBox = useRef(null);
  const cancelBox = useRef(null);
  const cancelled = ensaio.situacao === 'CANCELADO' || locked;
  const ready = !query.loading && !query.error;
  const tiposReady = !tipos.loading && !tipos.error && tipos.data.length > 0;

  useEffect(() => () => {
    if (operation.current) { operation.current.abort(); onBusyChange(ensaio.id, false); }
  }, [ensaio.id, onBusyChange]);
  useEffect(() => {
    const controller = new AbortController();
    setQuery({ loading: true, data: null, error: '' });
    (async () => {
      try {
        const result = await session.request(`/ensaios/${ensaio.id}/minha-participacao`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const data = readParticipacao(result, ensaio.id);
        if (controller.signal.aborted) return;
        setQuery({ loading: false, data, error: '' });
        setSelected(data ? String(data.tipoInstrumentoId) : '');
        setUncertain(false); setFailure(''); setFieldError(''); setCancelPrompt(false);
      } catch (error) {
        if (!controller.signal.aborted) setQuery({ loading: false, data: null, error: participacaoError(error) });
      }
    })();
    return () => controller.abort();
  }, [ensaio.id, ensaio.situacao, session, revision]);
  useEffect(() => { if (cancelPrompt) cancelBox.current?.focus(); }, [cancelPrompt]);

  async function save(cancel = false) {
    if (operation.current || disabled || cancelled || !ready || uncertain) return;
    const validation = cancel ? { body: undefined, error: '' } : validateParticipacao(selected, tipos.data);
    setFieldError(validation.error); setFailure(''); setSuccess('');
    if (validation.error) { select.current?.focus(); return; }
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true); onBusyChange(ensaio.id, true);
    try {
      const result = await session.request(`/ensaios/${ensaio.id}/minha-participacao`, {
        method: cancel ? 'DELETE' : 'PUT', ...(cancel ? {} : { body: validation.body }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      const data = readParticipacao(result, ensaio.id);
      if ((cancel && data !== null) || (!cancel && (!data || data.tipoInstrumentoId !== validation.body.tipoInstrumentoId))) throw new Error('Confirmação inválida.');
      if (controller.signal.aborted) return;
      setQuery({ loading: false, data, error: '' });
      setSelected(data ? String(data.tipoInstrumentoId) : '');
      setCancelPrompt(false);
      setSuccess(cancel ? 'Participação cancelada.' : query.data ? 'Instrumento da participação atualizado.' : 'Participação confirmada.');
    } catch (error) {
      if (controller.signal.aborted) return;
      setFailure(participacaoError(error, 'save'));
      if (error.data?.error?.code === 'ENSAIO_CANCELADO') setLocked(true);
      else if (error.data?.error?.code === 'TIPO_INSTRUMENTO_INVALIDO') setFieldError('Atualize os tipos e escolha outro instrumento.');
      else setUncertain(true);
      requestAnimationFrame(() => failureBox.current?.focus());
    } finally {
      if (!controller.signal.aborted) { setBusy(false); onBusyChange(ensaio.id, false); }
      if (operation.current === controller) operation.current = null;
    }
  }

  return <section className={styles.participation} aria-labelledby={`${fieldId}-title`} aria-busy={query.loading || busy}>
    <h4 id={`${fieldId}-title`}>Minha participação</h4>
    {query.loading ? <Loading>Consultando sua participação…</Loading> : query.error ? <Message variant="error">{query.error}</Message>
      : uncertain ? <Message>Atualize sua participação para conferir o estado atual antes de fazer outra alteração.</Message>
        : <p className={styles.status}>{query.data
          ? <>{cancelled ? 'Participação registrada' : 'Confirmada'}: <strong>{query.data.tipoInstrumentoNome}</strong></>
          : cancelled ? 'Sem participação registrada.' : 'Você não confirmou participação neste ensaio.'}</p>}
    {cancelled && <Message>Ensaio cancelado. As alterações de participação estão indisponíveis.</Message>}
    {success && <Message>{success}</Message>}
    {failure && <div ref={failureBox} tabIndex={-1}><Message variant="error">{failure}</Message></div>}
    {!cancelled && ready && <>
      <form noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
        <div className={styles.field}>
          <label htmlFor={fieldId}>Tipo de instrumento</label>
          <select id={fieldId} ref={select} value={selected} onChange={event => { setSelected(event.target.value); setFieldError(''); setSuccess(''); }}
            required disabled={disabled || busy || !tiposReady || uncertain || cancelPrompt} aria-invalid={fieldError ? true : undefined} aria-describedby={`${fieldId}-hint${fieldError ? ` ${fieldId}-error` : ''}`}>
            <option value="">Selecione um tipo</option>
            {tipos.data.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nome}</option>)}
          </select>
          <small id={`${fieldId}-hint`}>{tipos.loading ? 'Carregando tipos…' : tipos.error ? 'Atualize os tipos para selecionar um instrumento.' : tipos.data.length === 0 ? 'Ainda não há tipos de instrumento cadastrados.' : 'Confirmar participação não reserva uma unidade física.'}</small>
          {fieldError && <span className={styles.error} id={`${fieldId}-error`}>{fieldError}</span>}
        </div>
        {!cancelPrompt && <div className={styles.actions}>
          <Button type="submit" disabled={disabled || busy || !tiposReady || uncertain}>{busy ? 'Salvando participação…' : query.data ? 'Salvar instrumento' : 'Confirmar participação'}</Button>
          {query.data && <Button variant="secondary" disabled={disabled || busy || uncertain} onClick={() => { setCancelPrompt(true); setFailure(''); setSuccess(''); }}>Cancelar participação</Button>}
        </div>}
      </form>
      {cancelPrompt && <div className={styles.cancelBox} ref={cancelBox} tabIndex={-1}>
        <p>Cancelar sua participação neste ensaio?</p>
        <div className={styles.actions}>
          <Button disabled={disabled || busy || uncertain} onClick={() => void save(true)}>{busy ? 'Cancelando participação…' : 'Confirmar cancelamento da participação'}</Button>
          <Button variant="secondary" disabled={disabled || busy} onClick={() => setCancelPrompt(false)}>Manter participação</Button>
        </div>
      </div>}
    </>}
    {!cancelled && <Button variant="secondary" disabled={disabled || busy || query.loading} onClick={() => { setSuccess(''); setRevision(value => value + 1); }}>Atualizar participação</Button>}
  </section>;
}
