import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { SocketProvider } from './context/SocketContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import ToastContainer from './components/ui/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { Spinner } from './components/ui';

// Lazy-load route components to reduce the initial ES-module evaluation depth.
// iOS Safari evaluates module imports recursively; eagerly importing 30+ heavy
// page components (each with their own deep dependency trees) overflows Safari's
// smaller call-stack limit, causing "RangeError: Maximum call stack size exceeded".
const LoginPage = lazy(() => import('./modules/auth/LoginPage'));
const HomePage = lazy(() => import('./modules/home/HomePage'));
const EmployeeList = lazy(() => import('./modules/employees/EmployeeList'));
const EmployeeDetail = lazy(() => import('./modules/employees/EmployeeDetail'));
const StoreList = lazy(() => import('./modules/stores/StoreList'));
const StoreDetail = lazy(() => import('./modules/stores/StoreDetail'));
const SystemCompanyManagement = lazy(() => import('./modules/companies/SystemCompanyManagement'));
const CompanyDetail = lazy(() => import('./modules/companies/CompanyDetail'));
const SystemPermissionsPanel = lazy(() => import('./modules/permissions/SystemPermissionsPanel'));
const PermissionsPanel = lazy(() => import('./modules/permissions/PermissionsPanel'));
const ProfilePage = lazy(() => import('./modules/profile/ProfilePage'));
const ShiftsPage = lazy(() => import('./modules/shifts/ShiftsPage'));
const ExternalAffluencePage = lazy(() => import('./modules/externalAffluence/ExternalAffluencePage'));
const AttendanceLogsPage = lazy(() => import('./modules/attendance/AttendanceLogsPage'));
const AnomaliesPage = lazy(() => import('./modules/attendance/AnomaliesPage'));
const QRPage = lazy(() => import('./modules/attendance/QRPage'));
const TerminalPage = lazy(() => import('./modules/attendance/TerminalPage'));
const TerminalList = lazy(() => import('./modules/terminals/TerminalList'));
const LeavePage = lazy(() => import('./modules/leave/LeavePage'));
const SettingsPage = lazy(() => import('./modules/settings/SettingsPage'));
const EmployeeCheckinPage = lazy(() => import('./modules/attendance/EmployeeCheckinPage'));
const ScanPage = lazy(() => import('./modules/attendance/ScanPage'));
const HRChatPage = lazy(() => import('./modules/messages/HRChatPage'));
const ATSPage = lazy(() => import('./modules/ats/ATSPage'));
const OnboardingPage = lazy(() => import('./modules/onboarding/OnboardingPage'));
const DocumentsPage = lazy(() => import('./modules/documents/DocumentsPage'));
const TransfersPage = lazy(() => import('./modules/transfers/TransfersPage'));
const DeviceRegistrationPage = lazy(() => import('./modules/device/DeviceRegistrationPage'));
const HrDeviceResetPage = lazy(() => import('./modules/device/HrDeviceResetPage'));
const EmailSettingsPage = lazy(() => import('./modules/email/EmailSettingsPage'));
const PublicCareersPage = lazy(() => import('./modules/publicCareers/PublicCareersPage'));
const PublicJobDetailPage = lazy(() => import('./modules/publicCareers/PublicJobDetailPage'));
const NotificationsCenterPage = lazy(() => import('./modules/notifications/NotificationsCenterPage'));

// Refresh permissions whenever the user navigates to a new route.
// This ensures that permission changes made by an admin are always picked up
// without the user needing to manually reload or wait for the 5-minute interval.
function PermissionsRefresher() {
  const { user, refreshPermissions } = useAuth();
  const location = useLocation();
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Only refresh when the path actually changes (not on initial render, which
    // is already covered by the session-restore logic in AuthContext).
    if (prevPath.current !== null && prevPath.current !== location.pathname) {
      void refreshPermissions();
    }
    prevPath.current = location.pathname;
  }, [location.pathname, user?.id]);

  return null;
}

// Terminal role gets a bare full-screen view — no header or sidebar
function HomeRoute() {
  const { user } = useAuth();
  const { t } = useTranslation();
  if (user?.role === 'store_terminal') return <HomePage />;
  return <Layout title={t('nav.dashboard')}><HomePage /></Layout>;
}

function AppRoutes() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <>
    <PermissionsRefresher />
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/careers" element={<PublicCareersPage />} />
      <Route path="/careers/:companySlug" element={<PublicCareersPage />} />
      <Route path="/careers/jobs/:jobId" element={<PublicJobDetailPage />} />
      <Route path="/careers/:companySlug/jobs/:jobId" element={<PublicJobDetailPage />} />

      <Route path="/" element={
        <ProtectedRoute>
          <HomeRoute />
        </ProtectedRoute>
      } />

      <Route path="/dipendenti" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager']} permissionKey="dipendenti">
          <Layout title={t('nav.employees')}><EmployeeList /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/dipendenti/reset-device" element={
        <ProtectedRoute roles={['admin', 'hr']} permissionKey="dipendenti">
          <Layout title={t('deviceReset.title')}><HrDeviceResetPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/dipendenti/:id" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager']} permissionKey="dipendenti">
          <Layout title={t('employees.colName')}><EmployeeDetail /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/negozi" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager']} permissionKey="negozi">
          <Layout title={t('nav.stores')}><StoreList /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/negozi/:slug" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager']} permissionKey="negozi">
          <Layout title={t('nav.stores')}><StoreDetail /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/terminali" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager', 'employee']} permissionKey="terminali">
          <Layout title={t('nav.terminals')}><TerminalList /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/aziende" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager']}>
          <Layout title={t('nav.companies')}><SystemCompanyManagement /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/aziende/:slug" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager']}>
          <Layout title={t('nav.companies')}><CompanyDetail /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/impostazioni/permessi" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager']} permissionKey="gestione_accessi">
          <Layout title={t('nav.permissions')}>
            {user?.isSuperAdmin ? <SystemPermissionsPanel /> : <PermissionsPanel />}
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/impostazioni" element={
        <ProtectedRoute roles={['admin']} permissionKey="impostazioni">
          <Layout title={t('settings.title')}><SettingsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/profilo" element={
        <ProtectedRoute>
          <Layout title={t('profile.title')}><ProfilePage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/notifiche" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager', 'employee']}>
          <Layout title={t('notifications.title')}><NotificationsCenterPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/hr-chat" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager', 'employee']} permissionKey="messaggi">
          <Layout title={t('nav.messaggi')}><HRChatPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/turni" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager', 'employee']} permissionKey="turni">
          <Layout title={t('nav.turni')}><ShiftsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/integrazioni/database-esterno" element={
        <ProtectedRoute roles={['admin']} permissionKey="turni">
          <Layout title={t('nav.externalAffluence', 'Database Integration')}><ExternalAffluencePage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/affluenza-esterna" element={<Navigate to="/integrazioni/database-esterno" replace />} />

      <Route path="/trasferimenti" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager']} permissionKey="trasferimenti">
          <Layout title={t('nav.trasferimenti', 'Trasferimenti')}><TransfersPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/presenze" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager']} permissionKey="presenze">
          <Layout title={t('nav.presenze')}><AttendanceLogsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/anomalie" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager']} permissionKey="anomalie">
          <Layout title={t('nav.anomalies', 'Anomalies')}><AnomaliesPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/qr" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager']} permissionKey="presenze">
          <Layout title={t('nav.qr')}><QRPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/terminale" element={
        <ProtectedRoute roles={['store_terminal']} permissionKey="presenze">
          <TerminalPage />
        </ProtectedRoute>
      } />

      <Route path="/presenze/checkin" element={
        <ProtectedRoute roles={['employee']}>
          <Layout title={t('checkin.title')}><EmployeeCheckinPage /></Layout>
        </ProtectedRoute>
      } />

      {/* QR scan landing page — opened by scanning the store terminal QR code */}
      <Route path="/presenze/scan" element={
        <ProtectedRoute roles={['employee']}>
          <ScanPage />
        </ProtectedRoute>
      } />

      <Route path="/device/register" element={
        <ProtectedRoute roles={['employee']}>
          <DeviceRegistrationPage />
        </ProtectedRoute>
      } />

      <Route path="/permessi" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager', 'employee']} permissionKey="permessi">
          <Layout title={t('nav.permessi')}><LeavePage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/ats" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager']} permissionKey="ats">
          <Layout title={t('nav.ats')}><ATSPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/onboarding" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager', 'employee']} permissionKey="onboarding">
          <Layout title={t('nav.onboarding')}><OnboardingPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/documenti" element={
        <ProtectedRoute roles={['admin', 'hr', 'area_manager', 'store_manager', 'employee']} permissionKey="documenti">
          <Layout title={t('nav.documenti')}><DocumentsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/impostazioni/email" element={
        <ProtectedRoute roles={['admin', 'hr']}>
          <Layout title={t('nav.email')}><EmailSettingsPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

function SuspenseFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--background)' }}>
      <Spinner size="lg" color="var(--primary)" />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SocketProvider>
          <OfflineSyncProvider>
            <BrowserRouter>
              <ToastContainer />
              <ErrorBoundary>
                <Suspense fallback={<SuspenseFallback />}>
                  <AppRoutes />
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </OfflineSyncProvider>
        </SocketProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
