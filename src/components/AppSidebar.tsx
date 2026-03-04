import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Users, 
  Train, 
  Shield, 
  Settings, 
  LogOut,
  FileCheck,
  AlertTriangle,
  ClipboardList,
  FileBarChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { path: '/dashboard', label: 'Cuadro de Mando', icon: LayoutDashboard },
  { path: '/maquinistas', label: 'Maquinistas', icon: Users },
  { path: '/certificaciones', label: 'Certificaciones', icon: Train },
  { path: '/pe-1603', label: 'PE 16.03', icon: FileCheck },
  { path: '/pe-1201', label: 'PE 12.01', icon: AlertTriangle },
  { path: '/partes', label: 'Control de Partes', icon: ClipboardList },
  { path: '/auditoria', label: 'Auditoría', icon: FileBarChart },
];

const adminItems = [
  { path: '/admin', label: 'Administración', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { userAccess, signOut, isAdmin, isGestor } = useAuth();

  const displayName = userAccess?.profile 
    ? `${userAccess.profile.nombre || ''} ${userAccess.profile.apellidos || ''}`.trim() || userAccess.profile.email
    : 'Usuario';

  const displayRole = isAdmin ? 'Administrador' : isGestor ? 'Gestor de Base' : 'Mando';

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Logo / Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Train className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-sm">Gestión de Base</h1>
            <p className="text-xs text-sidebar-foreground/70">Renfe Viajeros</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="text-xs uppercase tracking-wider text-sidebar-foreground/50 px-3 py-2">
          Principal
        </p>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive 
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}

        {(isAdmin || isGestor) && (
          <>
            <p className="text-xs uppercase tracking-wider text-sidebar-foreground/50 px-3 py-2 mt-4">
              Administración
            </p>
            {adminItems.map((item) => {
              const isActive = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' 
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-sidebar-foreground/60">{displayRole}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={signOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
