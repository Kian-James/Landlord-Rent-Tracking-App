import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Skeleton } from './Skeleton.jsx';

export default function ProtectedRoute({ children }) {
  const { landlord, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }
  if (!landlord) return <Navigate to="/login" replace />;
  return children;
}