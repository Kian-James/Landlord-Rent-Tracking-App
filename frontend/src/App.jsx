import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Properties from './pages/Properties.jsx';
import Tenants from './pages/Tenants.jsx';
import BillChecklist from './pages/BillChecklist.jsx';
import Calendar from './pages/Calendar.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

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
      </Route>
    </Routes>
  );
}
