import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Base, UserProfile, UserWithAccess } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userAccess: UserWithAccess | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  assignedBases: Base[];
  canAccessBase: (base: Base) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nombre?: string, apellidos?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userAccess, setUserAccess] = useState<UserWithAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile, roles and base assignments
  const fetchUserAccess = async (userId: string): Promise<UserWithAccess | null> => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return null;
      }

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      }

      // Fetch base assignments
      const { data: basesData, error: basesError } = await supabase
        .from('base_assignments')
        .select('base')
        .eq('user_id', userId);

      if (basesError) {
        console.error('Error fetching base assignments:', basesError);
      }

      const roles = (rolesData || []).map(r => r.role as AppRole);
      const assignedBases = (basesData || []).map(b => b.base as Base);
      const isAdmin = roles.includes('admin');

      const profile: UserProfile = {
        id: profileData?.id || userId,
        email: profileData?.email || '',
        nombre: profileData?.nombre,
        apellidos: profileData?.apellidos,
      };

      return {
        profile,
        roles,
        assignedBases,
        isAdmin,
      };
    } catch (error) {
      console.error('Error in fetchUserAccess:', error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase client
          setTimeout(async () => {
            const access = await fetchUserAccess(session.user.id);
            setUserAccess(access);
            setIsLoading(false);
          }, 0);
        } else {
          setUserAccess(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserAccess(session.user.id).then(access => {
          setUserAccess(access);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, nombre?: string, apellidos?: string) => {
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nombre, apellidos }
      }
    });

    // Update profile with nombre/apellidos after signup
    if (!error && data.user && (nombre || apellidos)) {
      await supabase
        .from('profiles')
        .update({ nombre, apellidos })
        .eq('id', data.user.id);
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserAccess(null);
  };

  const canAccessBase = (base: Base): boolean => {
    if (!userAccess) return false;
    if (userAccess.isAdmin) return true;
    return userAccess.assignedBases.includes(base);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userAccess,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: userAccess?.isAdmin ?? false,
        assignedBases: userAccess?.assignedBases ?? [],
        canAccessBase,
        signIn,
        signUp,
        signOut,
      }}
    >
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
