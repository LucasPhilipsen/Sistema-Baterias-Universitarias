import { useEffect, useState } from 'react';
import { stockError } from './instrumentos.js';

export default function useStockQuery(session, path, reader, revision) {
  const [state, setState] = useState({ data: [], loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: [], loading: true, error: '' });
    (async () => {
      try {
        const result = await session.request(path, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        const data = reader(result);
        if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setState({ data: [], loading: false, error: stockError(error) });
      }
    })();
    return () => controller.abort();
  }, [session, path, reader, revision]);
  return state;
}
