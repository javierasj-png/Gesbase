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
  isGestor: boolean;
  assignedBases: Base[];
  canAccessBase: (base: Base) => boolean;
  canAdminBase: (base: Base) => boolean;
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
      // Fetch profile - use user_id column, not id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
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

      // Fetch base assignments - column is base_nombre, not base
      const { data: basesData, error: basesError } = await supabase
        .from('base_assignments')
        .select('base_nombre')
        .eq('user_id', userId);

      if (basesError) {
        console.error('Error fetching base assignments:', basesError);
      }

      const roles = (rolesData || []).map(r => r.role as AppRole);
      const assignedBases = (basesData || []).map(b => b.base_nombre as Base);
      const isAdmin = roles.includes('admin');
      const isGestor = roles.includes('gestor');

      const profile: UserProfile = {
        id: profileData?.id || userId,
        email: profileData?.email || '',
        nombre: profileData?.nombre || undefined,
        apellidos: profileData?.apellidos || undefined,
      };

      return {
        profile,
        roles,
        assignedBases,
        isAdmin,
        isGestor,
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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, nombre?: string, apellidos?: string) => {
    const emailTrimmed = email.trim();
    const { error, data } = await supabase.auth.signUp({
      email: emailTrimmed,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nombre, apellidos }
      }
    });

    // Ensure profile exists (avoid relying on DB triggers)
    // Works when auto-confirm is enabled and session is created immediately.
    if (!error && data.user && data.session) {
      const { error: profileUpsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            user_id: data.user.id,
            email: emailTrimmed,
            nombre: nombre || null,
            apellidos: apellidos || null,
          },
          { onConflict: 'user_id' }
        );

      if (profileUpsertError) {
        console.error('Error creating/updating profile after signup:', profileUpsertError);
      }
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

  // Check if user can admin a specific base (admin or gestor with that base assigned)
  const canAdminBase = (base: Base): boolean => {
    if (!userAccess) return false;
    if (userAccess.isAdmin) return true;
    if (userAccess.isGestor) {
      return userAccess.assignedBases.includes(base);
    }
    return false;
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
        isGestor: userAccess?.isGestor ?? false,
        assignedBases: userAccess?.assignedBases ?? [],
        canAccessBase,
        canAdminBase,
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
