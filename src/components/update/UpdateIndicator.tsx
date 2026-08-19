import React, { useEffect, useRef } from 'react';
import { RefreshCw, Download, RotateCcw, AlertTriangle } from 'lucide-react';
import { useUpdater } from '../../hooks/useUpdater';

/**
 * Renders a compact update pill in the top bar. Silent when idle/up-to-date;
 * shows download progress and a "Restart to Update" action once ready.
 */
export const UpdateIndicator: React.FC = () => {
  const { state, percent, check, install, reset } = useUpdater();
  const autoChecked = useRef(false);

  useEffect(() => {
    if (autoChecked.current) return;
    autoChecked.current = true;
    check(false).catch(() => {});
  }, [check]);

  if (state === 'idle' || state === 'uptodate' || state === 'checking') return null;

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={reset}
        title="Update check failed (click to dismiss)"
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 cursor-pointer"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Update check failed</span>
      </button>
    );
  }

  if (state === 'downloaded') {
    return (
      <button
        type="button"
        onClick={install}
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25 transition-colors cursor-pointer"
        title="A new version is ready. Restart to install."
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Restart to Update</span>
      </button>
    );
  }

  // available / downloading
  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30">
      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      <span>{state === 'downloading' ? `Downloading update… ${percent}%` : 'Downloading update…'}</span>
    </span>
  );
};