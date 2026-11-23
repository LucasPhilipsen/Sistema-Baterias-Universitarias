import { useEffect, useState } from 'react';
import { demandaError, readDemanda } from './demanda.js';

export default function useDemanda(session, ensaioId, revision) {
  const [state, setState] = useState({ ensaioId: null, revision: null, loading: false, data: null, error: '' });
  useEffect(() => {
    if (!ensaioId) { setState({ ensaioId: null, revision, loading: false, data: null, error: '' }); return; }
    const controller = new AbortController();
    setState({ ensaioId, revision, loading: true, data: null, error: '' });
    (async () => {
      try {
        const result = await session.request(`/ensaios/${ensaioId}/demanda`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        });
        const data = readDemanda(result, ensaioId);
        if (!controller.signal.aborted) setState({ ensaioId, revision, loading: false, data, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setState({ ensaioId, revision, loading: false, data: null, error: demandaError(error) });
      }
    })();
    return () => controller.abort();
  }, [session, ensaioId, revision]);
  return state;
}
