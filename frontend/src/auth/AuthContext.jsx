import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createSession } from './session.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const channel = useRef(null);
  const [session] = useState(() => createSession({ onSessionChange: () => channel.current?.postMessage('changed') }));
  useEffect(() => {
    void session.refresh();
    const refresh = () => {
      if (document.visibilityState === 'visible') void session.refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(() => {
      if (session.getSnapshot().status === 'authenticated') refresh();
    }, 60_000);
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('bateria-session');
      channel.current.onmessage = () => void session.refresh();
    }
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
      channel.current?.close();
      channel.current = null;
    };
  }, [session]);
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const session = useContext(AuthContext);
  if (!session) throw new Error('useAuth exige AuthProvider.');
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return { ...state, session };
}
