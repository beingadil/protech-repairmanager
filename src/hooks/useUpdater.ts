import { useCallback, useEffect, useRef, useState } from 'react';
import type { UpdateEvent } from '../types/electron';

export type UpdateUiState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'uptodate'
  | 'error';

/**
 * Update state machine fed by main-process events over the preload bridge.
 * Silent in browser mode (no bridge) — the component simply renders nothing.
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateUiState>('idle');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const apply = useCallback((e: UpdateEvent) => {
    if (!mountedRef.current) return;
    switch (e.type) {
      case 'checking':
        setState('checking');
        break;
      case 'available':
        setState('available');
        setError('');
        break;
      case 'not-available':
        setState('uptodate');
        setError('');
        break;
      case 'progress':
        setState('downloading');
        setPercent(e.percent ?? 0);
        break;
      case 'downloaded':
        setState('downloaded');
        break;
      case 'error':
        // Network/offline errors on the silent background check stay quiet;
        // only surface failures when the user explicitly asked to check.
        if (e.manual) {
          setState('error');
          setError(e.error || 'Update check failed.');
        }
        break;
    }
  }, []);

  useEffect(() => {
    const bridge = window.prodata?.updater;
    if (!bridge) return;
    const off = bridge.onEvent(apply);
    return off;
  }, [apply]);

  const check = useCallback(async (manual = false) => {
    const bridge = window.prodata?.updater;
    if (!bridge) return;
    if (manual) setState('checking');
    const res = await bridge.check(manual);
    if (!res.ok && manual) {
      setState('error');
      setError(res.error || 'Update check failed.');
    }
  }, []);

  const install = useCallback(() => {
    window.prodata?.updater.install();
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setError('');
  }, []);

  return { state, percent, error, check, install, reset };
}
