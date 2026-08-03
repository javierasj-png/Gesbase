import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Base, UserProfile, UserWithAccess } from '@/types';

export type UserStatus = 'pending' | 'active';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userAccess: UserWithAccess | null;
  userStatus: UserStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isGestor: boolean;
  isPending: boolean;
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
  const [userStatus, setUserStatus] = useState<UserStatus>('pending');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile, roles and base assignments
  const fetchUserAccess = async (userId: string, authUser?: User | null): Promise<UserWithAccess | null> => {
    try {
      // Fetch profile - profiles.user_id = auth.users.id
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      // Self-heal: create the profile if it is missing (no DB trigger guarantees it)
      if (!profileData && authUser) {
        const meta = (authUser.user_metadata || {}) as any;
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({
            user_id: userId,
            email: authUser.email || '',
            nombre: meta.nombre || (authUser.email || '').split('@')[0],
            apellidos: meta.apellidos || null,
          } as any)
          .select()
          .maybeSingle();

        if (createError) {
          console.error('Error creating missing profile:', createError);
        } else {
          profileData = created;
        }
      }


      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      }

      // Fetch base assignments - handle both 'base' and 'base_nombre' column names
      const { data: basesData, error: basesError } = await supabase
        .from('base_assignments')
        .select('*')
        .eq('user_id', userId);

      if (basesError) {
        console.error('Error fetching base assignments:', basesError);
      }

      const roles = (rolesData || []).map(r => r.role as AppRole);
      // Support both 'base' and 'base_nombre' column names
      const assignedBases = (basesData || []).map(b => ((b as any).base_nombre || (b as any).base) as Base);
      const isAdmin = roles.includes('admin');
      const isGestor = roles.includes('gestor');

      const profile: UserProfile = {
        id: profileData?.id || userId,
        email: profileData?.email || '',
        nombre: profileData?.nombre || undefined,
        apellidos: profileData?.apellidos || undefined,
      };

      const status: UserStatus = ((profileData as any)?.status as UserStatus) || 'pending';

      return {
        profile,
        roles,
        assignedBases,
        isAdmin,
        isGestor,
        status,
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
            const access = await fetchUserAccess(session.user.id, session.user);
            setUserAccess(access);
            setUserStatus((access as any)?.status || 'pending');
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
        fetchUserAccess(session.user.id, session.user).then(access => {
          setUserAccess(access);
          setUserStatus((access as any)?.status || 'pending');
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
      try {
        // Try upsert with the schema that exists (id = user_id)
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              email: emailTrimmed,
              nombre: nombre || null,
              apellidos: apellidos || null,
            } as any,
            { onConflict: 'id' }
          );
        
        if (profileError) {
          console.error('Error creating/updating profile after signup:', profileError);
        }
      } catch (e) {
        console.error('Error in profile upsert:', e);
      }
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserAccess(null);
    setUserStatus('pending');
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
        userStatus,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: userAccess?.isAdmin ?? false,
        isGestor: userAccess?.isGestor ?? false,
        isPending: userAccess !== null && userStatus === 'pending',
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
