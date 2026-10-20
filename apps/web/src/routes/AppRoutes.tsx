import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from '../components/Layout';
import { Spinner } from '../components/ui';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '../features/auth/AuthPages';
import { useAuth } from '../features/auth/AuthContext';

const Dashboard = lazy(() => import('../features/dashboard/DashboardPage'));
const Properties = lazy(() => import('../features/properties/PropertiesPage'));
const Units = lazy(() => import('../features/units/UnitsPage'));
const Tenants = lazy(() => import('../features/tenants/TenantsPage'));
const Leases = lazy(() => import('../features/leases/LeasesPage'));
const Rent = lazy(() => import('../features/rent/RentPage'));
const Receipt = lazy(() => import('../features/rent/ReceiptPage'));
const Expenses = lazy(() => import('../features/expenses/ExpensesPage'));
const Maintenance = lazy(() => import('../features/maintenance/MaintenancePage'));
const Reports = lazy(() => import('../features/reports/ReportsPage'));
const Notifications = lazy(() => import('../features/notifications/NotificationsPage'));
const Profile = lazy(() => import('../features/auth/ProfilePage'));

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Layout /> : <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<Protected />}>
          <Route index element={<Dashboard />} />
          <Route path="properties" element={<Properties />} />
          <Route path="units" element={<Units />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="leases" element={<Leases />} />
          <Route path="rent" element={<Rent />} />
          <Route path="receipts/:id" element={<Receipt />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
