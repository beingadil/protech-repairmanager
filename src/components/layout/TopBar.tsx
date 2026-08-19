import React from 'react';
import { Search, Menu, Sun, Moon, Cloud, CheckCircle2, AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUIStore } from '../../store/ui';
import { useSettingsStore } from '../../store/settings';
import { useSyncSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/auth';
import { useTheme } from '../../hooks/useTheme';
import { toast } from 'sonner';
import { UpdateIndicator } from '../update/UpdateIndicator';

export const TopBar: React.FC = () => {
  const { toggleSidebar, setCommandPaletteOpen } = useUIStore();
  const { settings, updateSetting } = useSettingsStore();
  const { lastSyncTime, syncStatus, syncError } = useSyncSettingsStore();
  const { currentUser, logout } = useAuthStore();
  const { isDark, toggleTheme } = useTheme('dark');
  const navigate = useNavigate();
  const location = useLocation();

  const handleThemeToggle = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    toggleTheme();
    updateSetting('theme', nextTheme);
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully.');
    navigate('/login');
  };

  // Page title lookup
  const getPageTitle = (pathname: string) => {
    if (pathname === '/') return 'Dashboard Overview';
    if (pathname.startsWith('/jobs/new')) return 'New Repair Job Intake';
    if (pathname.includes('/edit')) return 'Edit Repair Job';
    if (pathname.includes('/print')) return 'Print Job Card / Invoice';
    if (pathname.startsWith('/jobs/')) return 'Repair Job Details';
    if (pathname.startsWith('/jobs')) return 'Repair Jobs Master List';
    if (pathname.startsWith('/payments')) return 'Financial Accounts & Payment Ledger';
    if (pathname.startsWith('/inventory')) return 'Parts & Spare Inventory';
    if (pathname.startsWith('/customers')) return 'Customer Directory';
    if (pathname.startsWith('/analytics')) return 'Analytics & Financial Reports';
    if (pathname.startsWith('/notifications')) return 'Customer Notifications';
    if (pathname.startsWith('/backup')) return 'System Database Backup';
    if (pathname.startsWith('/settings')) return 'Shop Settings & Configuration';
    return 'ProTech Services Repair Manager';
  };

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Left: Sidebar toggle + Page Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          title="Toggle Navigation Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-heading">
            {getPageTitle(location.pathname)}
          </h2>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Offline Mode • {settings.shop_name}
            </p>
            <button
              type="button"
              onClick={() => navigate('/backup')}
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                syncStatus === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : syncStatus === 'error'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                  : syncStatus === 'syncing'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={
                syncStatus === 'success'
                  ? `Google Drive Sync OK (${lastSyncTime || 'Recently'}) - Click to manage backups`
                  : syncStatus === 'error'
                  ? `Google Drive Sync Failed: ${syncError || 'Check path'} - Click to manage backups`
                  : syncStatus === 'syncing'
                  ? 'Syncing Database to Google Drive...'
                  : 'Google Drive Desktop Sync - Click to manage'
              }
            >
              {syncStatus === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              {syncStatus === 'error' && <AlertTriangle className="w-3 h-3 text-rose-500" />}
              {(syncStatus === 'idle' || syncStatus === 'syncing') && (
                <Cloud className={`w-3 h-3 ${syncStatus === 'syncing' ? 'animate-spin text-blue-500' : ''}`} />
              )}
              <span>
                {syncStatus === 'success'
                  ? 'Backup OK'
                  : syncStatus === 'error'
                  ? 'Backup Error'
                  : syncStatus === 'syncing'
                  ? 'Syncing...'
                  : 'Drive Sync'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Global Command Search Trigger + Light/Dark Toggle + User Profile / Logout */}
      <div className="flex items-center gap-3">
        <UpdateIndicator />

        {/* Cmd+K Search trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 transition-colors w-40 md:w-52 justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">Search jobs...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-400 font-mono shadow-2xs">
            ⌘K
          </kbd>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={handleThemeToggle}
          className="p-2 rounded-xl bg-slate-100/90 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>

        {/* Logged in User Badge & Logout Button */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">
              {currentUser?.username?.[0] || 'A'}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-1">
                {currentUser?.name || 'Administrator'}
                <ShieldCheck className="w-3 h-3 text-emerald-500 inline" />
              </p>
              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-mono leading-none">
                {currentUser?.role || 'Superadmin'}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
            title="Log out from terminal session"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-bold">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
