import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users, Shield, Building2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppRole } from '@/types';

interface UserWithDetails {
  id: string;
  user_id: string;
  email: string;
  nombre?: string;
  apellidos?: string;
  roles: AppRole[];
  bases: string[];
}

interface BaseConduccion {
  id: string;
  nombre: string;
  activa: boolean;
}

export function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [allBases, setAllBases] = useState<BaseConduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch bases de conducción
      const { data: basesConduccion, error: basesConduccionError } = await supabase
        .from('bases_conduccion')
        .select('id, nombre, activa')
        .eq('activa', true)
        .order('nombre');

      if (basesConduccionError) throw basesConduccionError;
      setAllBases(basesConduccion || []);

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Fetch base assignments - handle both 'base' and 'base_nombre' column names
      const { data: bases, error: basesError } = await supabase
        .from('base_assignments')
        .select('*');

      // Si falla, no bloqueamos la carga de usuarios/roles (permite al menos ver los mandos)
      if (basesError) {
        console.error('Error fetching base assignments:', basesError);
      }

      // Combine data - profiles.id is the user_id in this schema
      const usersWithDetails: UserWithDetails[] = (profiles || []).map(profile => {
        const profileUserId = (profile as any).user_id || profile.id;
        return {
          id: profile.id,
          user_id: profileUserId,
          email: profile.email,
          nombre: profile.nombre || undefined,
          apellidos: profile.apellidos || undefined,
          roles: (roles || [])
            .filter(r => r.user_id === profileUserId)
            .map(r => r.role as AppRole),
          bases: (bases || [])
            .filter(b => b.user_id === profileUserId)
            .map(b => ((b as any).base_nombre || (b as any).base) as string),
        };
      });

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los datos',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (userId: string, role: AppRole) => {
    setSaving(userId);
    const user = users.find(u => u.user_id === userId);
    if (!user) return;

    const hasRole = user.roles.includes(role);

    try {
      if (hasRole) {
        // Remove role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);

        if (error) throw error;
      } else {
        // Add role
        const { error } = await supabase
          .from('user_roles')
          .insert([{ user_id: userId, role }]);

        if (error) throw error;
      }

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.user_id === userId) {
          return {
            ...u,
            roles: hasRole 
              ? u.roles.filter(r => r !== role)
              : [...u.roles, role],
          };
        }
        return u;
      }));

      toast({
        title: hasRole ? 'Rol eliminado' : 'Rol asignado',
        description: `${role} ${hasRole ? 'eliminado de' : 'asignado a'} ${user.email}`,
      });
    } catch (error) {
      console.error('Error toggling role:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar el rol',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleToggleBase = async (userId: string, baseName: string) => {
    setSaving(userId);
    const user = users.find(u => u.user_id === userId);
    if (!user) return;

    const hasBase = user.bases.includes(baseName);

    try {
      if (hasBase) {
        // Remove base - handle both column names
        const { error } = await supabase
          .from('base_assignments')
          .delete()
          .eq('user_id', userId)
          .or(`base.eq.${baseName},base_nombre.eq.${baseName}`);

        if (error) throw error;
      } else {
        // Add base - use base_nombre column
        const { error } = await supabase
          .from('base_assignments')
          .insert([{ user_id: userId, base_nombre: baseName }]);

        if (error) throw error;
      }

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.user_id === userId) {
          return {
            ...u,
            bases: hasBase 
              ? u.bases.filter(b => b !== baseName)
              : [...u.bases, baseName],
          };
        }
        return u;
      }));

      toast({
        title: hasBase ? 'Base eliminada' : 'Base asignada',
        description: `${baseName} ${hasBase ? 'eliminada de' : 'asignada a'} ${user.email}`,
      });
    } catch (error) {
      console.error('Error toggling base:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la base',
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <CardTitle>Gestión de Mandos</CardTitle>
        </div>
        <CardDescription>
          Asigna roles y bases a los mandos del sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay usuarios registrados
          </p>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-4">
              {users.map(user => (
                <div 
                  key={user.id} 
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="font-medium">
                        {user.nombre || user.apellidos 
                          ? `${user.nombre || ''} ${user.apellidos || ''}`.trim()
                          : user.email}
                      </p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {user.roles.includes('admin') && (
                        <Badge className="bg-primary">Admin</Badge>
                      )}
                      {user.roles.includes('gestor') && (
                        <Badge className="bg-amber-600">Gestor</Badge>
                      )}
                      {user.roles.includes('mando') && (
                        <Badge variant="secondary">Mando</Badge>
                      )}
                      {user.roles.length === 0 && (
                        <Badge variant="outline">Sin rol</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Roles */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Roles
                      </Label>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Administrador</span>
                          <Switch
                            checked={user.roles.includes('admin')}
                            onCheckedChange={() => handleToggleRole(user.user_id, 'admin')}
                            disabled={saving === user.user_id}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Gestor de Base</span>
                          <Switch
                            checked={user.roles.includes('gestor')}
                            onCheckedChange={() => handleToggleRole(user.user_id, 'gestor')}
                            disabled={saving === user.user_id}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Mando</span>
                          <Switch
                            checked={user.roles.includes('mando')}
                            onCheckedChange={() => handleToggleRole(user.user_id, 'mando')}
                            disabled={saving === user.user_id}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          <strong>Gestor de Base:</strong> Permisos de admin solo para sus bases asignadas
                        </p>
                      </div>
                    </div>

                    {/* Bases */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        Bases Asignadas
                        {user.roles.includes('admin') && (
                          <span className="text-xs text-muted-foreground">(Admin tiene acceso global)</span>
                        )}
                      </Label>
                      <div className="space-y-2">
                        {allBases.map(base => (
                          <div key={base.id} className="flex items-center justify-between">
                            <span className="text-sm">{base.nombre}</span>
                            <Switch
                              checked={user.bases.includes(base.nombre) || user.roles.includes('admin')}
                              onCheckedChange={() => handleToggleBase(user.user_id, base.nombre)}
                              disabled={saving === user.user_id || user.roles.includes('admin')}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
