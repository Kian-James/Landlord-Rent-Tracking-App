import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
// Fix import paths: Use relative './pages/' if App.jsx is inside the src directory
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}