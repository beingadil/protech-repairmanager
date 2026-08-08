import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from '../shared/CommandPalette';
import { useUIStore } from '../../store/ui';
import { useSettingsStore } from '../../store/settings';
import { useTheme } from '../../hooks/useTheme';

export const AppShell: React.FC = () => {
  const { isSidebarOpen } = useUIStore();
  const { loadSettings } = useSettingsStore();
  const { isDark } = useTheme('dark');

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="min-h-screen bg-slate-100/90 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Sidebar />
      
      <div className={`flex-1 flex flex-col transition-all duration-200 ${isSidebarOpen ? 'ml-60' : 'ml-16'}`}>
        <TopBar />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette />
      <Toaster position="bottom-right" richColors theme={isDark ? 'dark' : 'light'} />
    </div>
  );
};

