import { useEffect, useState } from 'react';
import { readEmprestimos } from './emprestimos.js';
import { readIntegrantes } from './integrantes.js';
import { readInstrumentos } from './instrumentos.js';

const pending = { loading: true, data: null, error: null };

// A chave inclui a identidade: uma troca de sessão nunca reutiliza o histórico anterior.
function useQuery(session, identity, revision, enabled, load) {
  const [result, setResult] = useState(pending);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    setResult({ ...pending, identity, revision });
    load(session, signal).then(data => {
      if (!controller.signal.aborted) setResult({ identity, revision, loading: false, data, error: null });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ identity, revision, loading: false, data: null, error });
    });
    return () => controller.abort();
  }, [session, identity, revision, enabled, load]);
  return enabled && result.identity === identity && result.revision === revision ? result : pending;
}

async function loadHistory(session, signal) {
  return readEmprestimos(await session.request('/emprestimos', { signal, cache: 'no-store' }));
}

async function loadOptions(session, signal) {
  const [members, units] = await Promise.all([
    session.request('/integrantes', { signal, cache: 'no-store' }),
    session.request('/instrumentos?situacao=DISPONIVEL', { signal, cache: 'no-store' }),
  ]);
  const integrantes = readIntegrantes(members);
  const instrumentos = readInstrumentos(units);
  if (instrumentos.some(item => item.situacao !== 'DISPONIVEL')
    || new Set(instrumentos.map(item => item.id)).size !== instrumentos.length) throw new Error('Disponibilidade inválida.');
  return { integrantes, instrumentos };
}

export function useEmprestimos(session, identity, revision, director) {
  const history = useQuery(session, identity, revision, Boolean(identity), loadHistory);
  const options = useQuery(session, identity, revision, director, loadOptions);
  return { history, options };
}
