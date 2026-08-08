import React, { useState } from 'react';
import {
  Cloud,
  RefreshCw,
  Folder,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  ToggleLeft,
  ToggleRight,
  Clock,
  Shield,
  Save,
  FileCode2
} from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { syncDatabaseToGoogleDrive } from '../../services/dbSyncService';
import { exportDatabaseBinary } from '../../lib/db';
import { toast } from 'sonner';

export const SyncSettingsComponent: React.FC = () => {
  const {
    googleDrivePath,
    autoBackupOnClose,
    lastSyncTime,
    syncStatus,
    syncError,
    setGoogleDrivePath,
    setAutoBackupOnClose,
    setSyncStatus,
    setLastSyncTime,
    resetSyncStatus
  } = useSettingsStore();

  const [pathInput, setPathInput] = useState(googleDrivePath);
  const [isSaved, setIsSaved] = useState(false);

  const handleSavePath = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGoogleDrivePath(pathInput);
    setIsSaved(true);
    toast.success('Google Drive path updated');
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleManualSync = async () => {
    // Ensure path is saved first
    const activePath = pathInput.trim();
    if (!activePath) {
      toast.error('Please specify a valid Google Drive folder path first.');
      return;
    }
    setGoogleDrivePath(activePath);

    setSyncStatus('syncing');
    const toastId = toast.loading('Exporting database to Google Drive...');

    try {
      // 1. Export database binary from sql.js memory instance
      const dbBytes = await exportDatabaseBinary();

      // 2. Write file directly to local Google Drive folder path
      const result = await syncDatabaseToGoogleDrive(dbBytes, activePath);

      if (result.success) {
        const formattedTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) + ' (' + new Date().toLocaleDateString() + ')';

        setLastSyncTime(formattedTime);
        toast.success(`Database synced to ${result.filePath}`, { id: toastId });
      } else {
        const errorMsg = result.error || 'Failed to sync database to Google Drive path.';
        setSyncStatus('error', errorMsg);
        toast.error(errorMsg, { id: toastId });
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      const errDetail = err.message || 'Error occurred during database export.';
      setSyncStatus('error', errDetail);
      toast.error(`Sync error: ${errDetail}`, { id: toastId });
    }
  };

  const handlePresetPath = (presetPath: string) => {
    setPathInput(presetPath);
    setGoogleDrivePath(presetPath);
    toast.success('Path preset applied');
  };

  const handleChooseFolder = async () => {
    if (!window.prodata?.drive) return;
    const chosen = await window.prodata.drive.chooseFolder();
    if (chosen) {
      setPathInput(chosen);
      setGoogleDrivePath(chosen);
      toast.success('Backup folder selected');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 md:p-6 shadow-xs dark:shadow-xl text-slate-900 dark:text-slate-100 space-y-6 transition-colors duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/90 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-xl shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-heading">
                Google Drive Zero-API Sync
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 uppercase tracking-wider">
                Desktop Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Directly saves sql.js database binary (<code className="text-blue-700 dark:text-blue-300 font-mono">ProDataRepairManager.db</code>) to local Google Drive
            </p>
          </div>
        </div>

        {/* Sync Now Button */}
        <button
          onClick={handleManualSync}
          disabled={syncStatus === 'syncing'}
          className="btn-primary font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin text-blue-100' : ''}`} />
          <span>{syncStatus === 'syncing' ? 'Syncing Now...' : 'Sync Now'}</span>
        </button>
      </div>

      {/* Path Configuration Form */}
      <form onSubmit={handleSavePath} className="space-y-3">
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Folder className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Local Google Drive Folder Path
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal normal-case">
            Absolute Desktop Directory Path
          </span>
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={pathInput}
              onChange={(e) => {
                setPathInput(e.target.value);
                resetSyncStatus();
              }}
              placeholder="e.g. C:\Users\Admin\Google Drive\ProDataBackups"
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-blue-600/20 dark:focus:ring-blue-500/30 focus:border-blue-600 dark:focus:border-blue-500 outline-none font-mono transition-all"
            />
            <HardDrive className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-3" />
          </div>

          <button
            type="submit"
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700/80 transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{isSaved ? 'Saved!' : 'Save Path'}</span>
          </button>

          {window.prodata?.drive && (
            <button
              type="button"
              onClick={handleChooseFolder}
              className="px-4 py-2.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl border border-blue-200 dark:border-blue-800 transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Browse...</span>
            </button>
          )}
        </div>

        {/* Quick Path Preset Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="text-slate-400 dark:text-slate-500 text-[10px] font-semibold uppercase">Presets:</span>
          <button
            type="button"
            onClick={() => handlePresetPath('C:\\Users\\Admin\\Google Drive\\ProDataBackups')}
            className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 font-mono transition-colors text-[10px] cursor-pointer"
          >
            Win: C:\...\Google Drive\ProDataBackups
          </button>
          <button
            type="button"
            onClick={() => handlePresetPath('/Users/Shared/Google Drive/ProDataBackups')}
            className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 font-mono transition-colors text-[10px] cursor-pointer"
          >
            Mac: /Users/Shared/Google Drive/...
          </button>
        </div>
      </form>

      {/* Settings Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Auto Backup Toggle */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Auto-Sync on Close</span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Automatically trigger sync whenever application tab or window closes
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAutoBackupOnClose(!autoBackupOnClose);
              toast.success(`Auto-sync on close ${!autoBackupOnClose ? 'enabled' : 'disabled'}`);
            }}
            className="text-2xl transition-transform hover:scale-105 focus:outline-none shrink-0 cursor-pointer"
            title={autoBackupOnClose ? 'Disable Auto-Sync' : 'Enable Auto-Sync'}
          >
            {autoBackupOnClose ? (
              <ToggleRight className="w-9 h-9 text-blue-600 dark:text-blue-500" />
            ) : (
              <ToggleLeft className="w-9 h-9 text-slate-400 dark:text-slate-600" />
            )}
          </button>
        </div>

        {/* Sync Status Badge */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 rounded-xl flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Last Sync Timestamp
            </span>
            <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300">
              {lastSyncTime ? lastSyncTime : 'Never synced yet'}
            </p>
          </div>

          <div className="shrink-0 text-right">
            {syncStatus === 'success' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Synced
              </span>
            )}
            {syncStatus === 'error' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-3 h-3 text-rose-500" /> Error
              </span>
            )}
            {syncStatus === 'idle' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                Ready
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status Banner Output */}
      {syncError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl text-xs space-y-2">
          <div className="flex items-start gap-2.5 text-rose-800 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span className="font-bold block">Synchronization Error / Permission Failure</span>
              <p className="text-rose-700 dark:text-rose-200/90 leading-relaxed font-mono text-[11px]">{syncError}</p>
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleManualSync}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 dark:bg-rose-800 dark:hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Sync</span>
            </button>
          </div>
        </div>
      )}

      {syncStatus === 'success' && !syncError && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs flex items-center justify-between text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Database binary successfully written to <code className="font-mono text-emerald-900 dark:text-emerald-200 font-bold">{googleDrivePath}\ProDataRepairManager.db</code>
            </span>
          </div>
          <FileCode2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
        </div>
      )}

      {/* Security & Info Footnote */}
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Zero-API Local File System Isolation (No Cloud Tokens Required)
        </span>
        <span className="font-mono text-[10px]">Target: ProDataRepairManager.db</span>
      </div>
    </div>
  );
};
