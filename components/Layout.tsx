
import React from 'react';
import { useLocalAuth } from '@/contexts/LocalAuthContext';
import Navigation from '@/components/Navigation';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user } = useLocalAuth();

  if (!user) {
    return null; // This should not render if user is not authenticated
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

export default Layout;
