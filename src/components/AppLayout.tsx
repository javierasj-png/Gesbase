import { ReactNode } from 'react';
import { AppSidebar } from '@/components/AppSidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
