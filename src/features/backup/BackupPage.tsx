import React, { useState, useEffect } from 'react';
import { DatabaseBackup, Download, Upload, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { exportDatabaseBinary, restoreDatabaseBinary, query, execute } from '../../lib/db';
import { BackupLogItem } from '../../types/settings';
import { formatDateTime } from '../../lib/utils';
import { SyncSettingsComponent } from '../../components/sync/SyncSettingsComponent';

export const BackupPage: React.FC = () => {
  const [logs, setLogs] = useState<BackupLogItem[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadBackupLogs();
  }, []);

  const loadBackupLogs = async () => {
    try {
      const res = await query<BackupLogItem>('SELECT * FROM backup_log ORDER BY id DESC LIMIT 10');
      setLogs(res);
    } catch (e) {
      console.error('Failed to load backup logs:', e);
    }
  };

  const handleManualBackup = async () => {
    setIsExporting(true);
    try {
      // Desktop app: native save dialog via the main process.
      if (window.prodata?.backup) {
        const res = await window.prodata.backup.save();
        if (!res.canceled && res.filePath) {
          const fileName = res.filePath.split(/[\\/]/).pop() || res.filePath;
          await execute(
            'INSERT INTO backup_log (file_path, file_name, size_bytes, backup_type, created_at) VALUES (?, ?, ?, "manual", datetime("now"))',
            [res.filePath, fileName, res.sizeBytes ?? 0]
          );
          toast.success(`Backup saved: ${res.filePath}`);
          loadBackupLogs();
        }
        return;
      }

      const binary = await exportDatabaseBinary();
      const blob = new Blob([binary.buffer as ArrayBuffer], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const fileName = `ProData_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Log backup
      await execute(
        'INSERT INTO backup_log (file_path, file_name, size_bytes, backup_type, created_at) VALUES (?, ?, ?, "manual", datetime("now"))',
        [fileName, fileName, binary.byteLength]
      );

      toast.success('Database backup exported successfully!');
      loadBackupLogs();
    } catch (e) {
      console.error('Failed to export backup:', e);
      toast.error('Failed to export backup file.');
    } finally {
      setIsExporting(false);
    }
  };

  const restoreViaDialog = async () => {
    try {
      const res = await window.prodata!.backup.restore();
      if (!res.canceled) {
        toast.success('Database restored successfully! Reloading...');
        setTimeout(() => window.location.reload(), 1000);
      }
    } catch (err) {
      console.error('Failed to restore database:', err);
      toast.error(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('WARNING: Restoring database will replace all current jobs and customers with the imported file. Continue?')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(buffer);
        await restoreDatabaseBinary(uint8Array);
        toast.success('Database restored successfully! Reloading...');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        console.error('Failed to restore database:', err);
        toast.error('Invalid backup file or restore failed.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Database Backup & Restore</h1>
        <p className="text-xs text-slate-500">Protect shop repair data with instant export, local USB backups, and database restores</p>
      </div>

      {/* Google Drive Zero-API Desktop Sync */}
      <SyncSettingsComponent />

      {/* Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Export Backup Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-xl">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Export Database Backup</h3>
              <p className="text-xs text-slate-500">Save full SQLite database file (.db) to disk or USB drive</p>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Contains all customer profiles, repair tokens, device serials, financial charges, and notification history.
          </p>

          <button
            onClick={handleManualBackup}
            disabled={isExporting}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exporting...' : 'Export Backup File (.db)'}</span>
          </button>
        </div>

        {/* Restore Backup Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-xl">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Restore from Backup</h3>
              <p className="text-xs text-slate-500">Import .db backup file to restore shop data</p>
            </div>
          </div>

          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Note: This action will overwrite current in-memory database records with the selected file.
          </p>

          {window.prodata?.backup ? (
            <button
              type="button"
              onClick={restoreViaDialog}
              className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Restore from Backup File</span>
            </button>
          ) : (
            <label className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Select .db Backup File</span>
              <input type="file" accept=".db,.sqlite" onChange={handleRestoreFile} className="hidden" />
            </label>
          )}
        </div>
      </div>

      {/* Backup Logs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">
          Backup History Log
        </h3>

        {logs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No previous backup logs recorded.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">{log.file_name}</span>
                    <span className="text-slate-400 block text-[10px]">
                      {(log.size_bytes / 1024).toFixed(1)} KB • {log.backup_type.toUpperCase()}
                    </span>
                  </div>
                </div>
                <span className="text-slate-400">{formatDateTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
