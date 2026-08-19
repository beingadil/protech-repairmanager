import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wrench,
  Users,
  BarChart2,
  Bell,
  DatabaseBackup,
  Settings,
  PlusCircle,
  Sun,
  Moon,
  Shield,
  Laptop,
  Boxes,
  Receipt,
  Wallet
} from 'lucide-react';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { useTheme } from '../../hooks/useTheme';
import { query } from '../../lib/db';
import { ProTechLogo } from '../shared/ProTechLogo';

export const Sidebar: React.FC = () => {
  const { settings } = useSettingsStore();
  const { isSidebarOpen } = useUIStore();
  const { isDark, toggleTheme } = useTheme('dark');
  const [activeJobCount, setActiveJobCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);

  useEffect(() => {
    query<{ count: number }>(
      "SELECT COUNT(*) as count FROM jobs WHERE deliver_status = 'pending' AND deleted_at IS NULL"
    ).then((res) => {
      if (res.length > 0) setActiveJobCount(res[0].count);
    });

    query<{ count: number }>(
      "SELECT COUNT(*) as count FROM inventory_items WHERE quantity <= min_threshold"
    ).then((res) => {
      if (res.length > 0) setLowStockCount(res[0].count);
    }).catch(() => {});
  }, []);

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { label: 'Jobs List', icon: Wrench, path: '/jobs', badge: activeJobCount > 0 ? activeJobCount : undefined },
    { label: 'Payments & Ledger', icon: Receipt, path: '/payments' },
    { label: 'Stock & Parts', icon: Boxes, path: '/inventory', badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined, badgeColor: 'amber' },
    { label: 'Customers / Suppliers', icon: Users, path: '/customers' },
    { label: 'Analytics', icon: BarChart2, path: '/analytics' },
    { label: 'Notifications', icon: Bell, path: '/notifications' },
    { label: 'Backup & Restore', icon: DatabaseBackup, path: '/backup' },
    { label: 'Settings', icon: Settings, path: '/settings' }
  ];

  return (
    <aside
      className={`fixed top-0 left-0 z-40 h-screen transition-all duration-200 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col justify-between border-r border-slate-200 dark:border-slate-800/90 shadow-xs ${
        isSidebarOpen ? 'w-60' : 'w-16'
      }`}
    >
      {/* Top Header Logo */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            {settings.logo_path ? (
              <img
                src={settings.logo_path}
                alt="Shop Logo"
                className="w-9 h-9 rounded-lg object-contain bg-slate-100 dark:bg-white/10 p-1 border border-slate-200 dark:border-white/20 shrink-0 shadow-xs"
              />
            ) : (
              <ProTechLogo className="w-9 h-9 shrink-0" />
            )}
            {isSidebarOpen && (
              <div className="truncate">
                <h1 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight leading-none truncate font-heading" title={settings.shop_name || 'ProTech Services'}>
                  {settings.shop_name || 'ProTech Services'}
                </h1>
                <span className="text-[10px] text-blue-700 dark:text-blue-400 font-bold tracking-wider uppercase">
                  Repair & Services
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Add Button */}
        <div className="p-3">
          <NavLink
            to="/jobs/new"
            className={`btn-primary w-full ${!isSidebarOpen && 'px-0 justify-center'}`}
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            {isSidebarOpen && <span>New Repair Job</span>}
          </NavLink>
        </div>

        {/* Navigation Links */}
        <nav className="px-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-500/10 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 font-bold border-l-2 border-blue-600 dark:border-blue-500 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/90 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                  }`
                }
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <Icon className="w-4 h-4 shrink-0" />
                  {isSidebarOpen && <span className="truncate">{item.label}</span>}
                </div>
                {isSidebarOpen && item.badge !== undefined && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    item.badgeColor === 'amber'
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30'
                      : 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Theme Toggle & Info */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 transition-colors text-xs font-semibold cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-2">
            {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            {isSidebarOpen && <span>{isDark ? 'Switch to Light' : 'Switch to Dark'}</span>}
          </div>
          {isSidebarOpen && (
            <span className="text-[10px] px-1.5 py-0.5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-slate-700/80 uppercase tracking-wider font-bold">
              {isDark ? 'DARK' : 'LIGHT'}
            </span>
          )}
        </button>

        {isSidebarOpen && (
          <div className="px-1 pt-1 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              SQLite DB Online
            </span>
            <span className="font-mono text-[9px]">v1.0.0</span>
          </div>
        )}
      </div>
    </aside>
  );
};

