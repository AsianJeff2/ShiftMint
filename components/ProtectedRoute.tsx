
import React from 'react';
import { useLocalAuth } from '@/contexts/LocalAuthContext';
import { hasPermission, Permission, UserRole } from '@/lib/security/rbac';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: Permission;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, permission }) => {
  const { user, loading } = useLocalAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Auth handling is done at the App level
  }

  if (permission && !hasPermission(user.role as UserRole, permission)) {
    return <div className="p-6" role="alert">Your account does not have access to this page.</div>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
