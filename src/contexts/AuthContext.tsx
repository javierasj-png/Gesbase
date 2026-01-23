import { createContext, useContext, useState, ReactNode } from 'react';
import { Usuario, Rol, Base } from '@/types';
import { usuariosMock } from '@/data/mockData';

interface AuthContextType {
  usuario: Usuario | null;
  login: (rol: Rol) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const login = (rol: Rol) => {
    const user = usuariosMock.find(u => u.rol === rol) || usuariosMock[0];
    setUsuario(user);
  };

  const logout = () => {
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, login, logout, isAuthenticated: !!usuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
