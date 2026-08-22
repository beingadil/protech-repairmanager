import React, { Suspense } from 'react';
import { createHashRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';

// Helper: React.lazy requires default exports, but our pages use named exports.
// This adapter wraps each dynamic import to map the named export to `default`.
const lazy =
  <T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) =>
    React.lazy(factory);

// Lazy-loaded page components — each becomes a separate chunk loaded on demand.
// This splits the 3.6 MB monolith into ~14 smaller files (~150-400 KB each).
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));
const JobListPage = lazy(() => import('./features/jobs/JobListPage').then(m => ({ default: m.JobListPage })));
const AddJobPage = lazy(() => import('./features/jobs/AddJobPage').then(m => ({ default: m.AddJobPage })));
const JobDetailPage = lazy(() => import('./features/jobs/JobDetailPage').then(m => ({ default: m.JobDetailPage })));
const EditJobPage = lazy(() => import('./features/jobs/EditJobPage').then(m => ({ default: m.EditJobPage })));
const PrintPreviewPage = lazy(() => import('./features/print/PrintPreviewPage').then(m => ({ default: m.PrintPreviewPage })));
const CustomersPage = lazy(() => import('./features/customers/CustomersPage').then(m => ({ default: m.CustomersPage })));
const AnalyticsPage = lazy(() => import('./features/analytics/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const NotificationsPage = lazy(() => import('./features/notifications/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const BackupPage = lazy(() => import('./features/backup/BackupPage').then(m => ({ default: m.BackupPage })));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const InventoryPage = lazy(() => import('./features/inventory/InventoryPage').then(m => ({ default: m.InventoryPage })));
const PaymentModulePage = lazy(() => import('./features/payments/PaymentModulePage').then(m => ({ default: m.PaymentModulePage })));
const GeneralLedgerPage = lazy(() => import('./features/ledger/GeneralLedgerPage').then(m => ({ default: m.GeneralLedgerPage })));

/** Lightweight loading indicator while a chunk downloads. */
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full py-20">
      <div className="flex items-center gap-3 text-slate-400 text-sm">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        <span>Loading…</span>
      </div>
    </div>
  );
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

// Hash-based router: works identically under Vite dev (http) and Electron
// (file://) — a file URL cannot be matched by a path-based router.
export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <LazyPage><DashboardPage /></LazyPage> },
      { path: 'jobs', element: <LazyPage><JobListPage /></LazyPage> },
      { path: 'jobs/new', element: <LazyPage><AddJobPage /></LazyPage> },
      { path: 'jobs/:id', element: <LazyPage><JobDetailPage /></LazyPage> },
      { path: 'jobs/:id/edit', element: <LazyPage><EditJobPage /></LazyPage> },
      { path: 'jobs/:id/print', element: <LazyPage><PrintPreviewPage /></LazyPage> },
      { path: 'payments', element: <LazyPage><PaymentModulePage /></LazyPage> },
      { path: 'ledger', element: <LazyPage><GeneralLedgerPage /></LazyPage> },
      { path: 'inventory', element: <LazyPage><InventoryPage /></LazyPage> },
      { path: 'customers', element: <LazyPage><CustomersPage /></LazyPage> },
      { path: 'analytics', element: <LazyPage><AnalyticsPage /></LazyPage> },
      { path: 'notifications', element: <LazyPage><NotificationsPage /></LazyPage> },
      { path: 'backup', element: <LazyPage><BackupPage /></LazyPage> },
      { path: 'settings', element: <LazyPage><SettingsPage /></LazyPage> }
    ]
  }
]);
