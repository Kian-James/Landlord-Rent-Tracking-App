import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Each screen is its own file that downloads when it's first opened, so the first
// load only fetches what that screen needs (and the charts library only loads for
// the Dashboard). Layout.jsx quietly pre-loads the other screens once the app is idle.
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const AuthCallback = lazy(() => import('./pages/AuthCallback.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Properties = lazy(() => import('./pages/Properties.jsx'));
const Tenants = lazy(() => import('./pages/Tenants.jsx'));
const BillChecklist = lazy(() => import('./pages/BillChecklist.jsx'));
const Calendar = lazy(() => import('./pages/Calendar.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
// Public legal pages - readable without an account (tenants, new sign-ups).
const Terms = lazy(() => import('./pages/Terms.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const TenantNotice = lazy(() => import('./pages/TenantNotice.jsx'));

export default function App() {
  return (
    <Suspense fallback={null}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/tenant-notice" element={<TenantNotice />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="properties" element={<Properties />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="bills" element={<BillChecklist />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
