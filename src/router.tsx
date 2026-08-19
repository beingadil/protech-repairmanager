import { createHashRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { JobListPage } from './features/jobs/JobListPage';
import { AddJobPage } from './features/jobs/AddJobPage';
import { JobDetailPage } from './features/jobs/JobDetailPage';
import { EditJobPage } from './features/jobs/EditJobPage';
import { PrintPreviewPage } from './features/print/PrintPreviewPage';
import { CustomersPage } from './features/customers/CustomersPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { BackupPage } from './features/backup/BackupPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { InventoryPage } from './features/inventory/InventoryPage';
import { PaymentModulePage } from './features/payments/PaymentModulePage';

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
      { index: true, element: <DashboardPage /> },
      { path: 'jobs', element: <JobListPage /> },
      { path: 'jobs/new', element: <AddJobPage /> },
      { path: 'jobs/:id', element: <JobDetailPage /> },
      { path: 'jobs/:id/edit', element: <EditJobPage /> },
      { path: 'jobs/:id/print', element: <PrintPreviewPage /> },
      { path: 'payments', element: <PaymentModulePage /> },
      { path: 'inventory', element: <InventoryPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'backup', element: <BackupPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  }
]);

