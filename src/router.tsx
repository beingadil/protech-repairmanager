import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
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

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'jobs', element: <JobListPage /> },
      { path: 'jobs/new', element: <AddJobPage /> },
      { path: 'jobs/:id', element: <JobDetailPage /> },
      { path: 'jobs/:id/edit', element: <EditJobPage /> },
      { path: 'jobs/:id/print', element: <PrintPreviewPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'backup', element: <BackupPage /> },
      { path: 'settings', element: <SettingsPage /> }
    ]
  }
]);
