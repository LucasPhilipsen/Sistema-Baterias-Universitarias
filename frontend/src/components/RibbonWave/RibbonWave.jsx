import { useEffect, useRef, useState } from 'react';
import styles from './RibbonWave.module.css';

export default function RibbonWave({ className = '', extendToHeader = false }) {
  const root = useRef(null);
  const canvas = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const update = () => setEnabled(visible && !document.hidden && !motion.matches);
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(root.current);
    motion.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  useEffect(() => {
    setReady(false);
    if (!enabled) return;
    const controller = new AbortController();
    let dispose;
    import('./renderRibbonWave.js').then(({ createRibbonWave }) => createRibbonWave(canvas.current, {
      signal: controller.signal,
      onReady: () => { if (!controller.signal.aborted) setReady(true); },
      onError: () => { if (!controller.signal.aborted) setReady(false); },
    })).then(cleanup => {
      if (controller.signal.aborted) cleanup();
      else dispose = cleanup;
    }).catch(() => { if (!controller.signal.aborted) setReady(false); });
    return () => { controller.abort(); dispose?.(); };
  }, [enabled]);

  return <div ref={root} className={`${styles.wave} ${extendToHeader ? styles.extendToHeader : ''} ${className}`} aria-hidden="true" data-testid="ribbon-wave">
    <div className={styles.surface}>
      {enabled && <canvas ref={canvas} className={styles.canvas} data-ready={ready ? 'true' : 'false'} />}
      <picture className={`${styles.fallback} ${ready ? styles.hidden : ''}`}>
        <source media="(max-width: 639px)" srcSet="/ribbon-wave/wave-mobile.webp" />
        <source media="(max-width: 1263px)" srcSet="/ribbon-wave/wave-tablet.webp" />
        <img src="/ribbon-wave/wave-desktop.webp" alt="" width="1392" height="975" decoding="async" />
      </picture>
    </div>
  </div>;
}
