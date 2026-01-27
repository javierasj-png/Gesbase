import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users, Shield, Building2, Plus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AppRole, Base } from '@/types';

interface UserWithDetails {
  id: string;
  email: string;
  nombre?: string;
  apellidos?: string;
  roles: AppRole[];
  bases: Base[];
}

const ALL_BASES: Base[] = [
  'Madrid-Chamartín',
  'Barcelona-Sants',
  'Sevilla-Santa Justa',
  'Valencia-Joaquín Sorolla'
];

export function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
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

      // Fetch base assignments
      const { data: bases, error: basesError } = await supabase
        .from('base_assignments')
        .select('*');

      if (basesError) throw basesError;

      // Combine data
      const usersWithDetails: UserWithDetails[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        nombre: profile.nombre,
        apellidos: profile.apellidos,
        roles: (roles || [])
          .filter(r => r.user_id === profile.id)
          .map(r => r.role as AppRole),
        bases: (bases || [])
          .filter(b => b.user_id === profile.id)
          .map(b => b.base as Base),
      }));

      setUsers(usersWithDetails);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los usuarios',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRole = async (userId: string, role: AppRole) => {
    setSaving(userId);
    const user = users.find(u => u.id === userId);
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
          .insert({ user_id: userId, role });

        if (error) throw error;
      }

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
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

  const handleToggleBase = async (userId: string, base: Base) => {
    setSaving(userId);
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const hasBase = user.bases.includes(base);

    try {
      if (hasBase) {
        // Remove base
        const { error } = await supabase
          .from('base_assignments')
          .delete()
          .eq('user_id', userId)
          .eq('base', base);

        if (error) throw error;
      } else {
        // Add base
        const { error } = await supabase
          .from('base_assignments')
          .insert({ user_id: userId, base });

        if (error) throw error;
      }

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          return {
            ...u,
            bases: hasBase 
              ? u.bases.filter(b => b !== base)
              : [...u.bases, base],
          };
        }
        return u;
      }));

      toast({
        title: hasBase ? 'Base eliminada' : 'Base asignada',
        description: `${base} ${hasBase ? 'eliminada de' : 'asignada a'} ${user.email}`,
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
                    <div className="flex gap-2">
                      {user.roles.includes('admin') && (
                        <Badge className="bg-primary">Admin</Badge>
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
                            onCheckedChange={() => handleToggleRole(user.id, 'admin')}
                            disabled={saving === user.id}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Mando</span>
                          <Switch
                            checked={user.roles.includes('mando')}
                            onCheckedChange={() => handleToggleRole(user.id, 'mando')}
                            disabled={saving === user.id}
                          />
                        </div>
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
                        {ALL_BASES.map(base => (
                          <div key={base} className="flex items-center justify-between">
                            <span className="text-sm">{base}</span>
                            <Switch
                              checked={user.bases.includes(base) || user.roles.includes('admin')}
                              onCheckedChange={() => handleToggleBase(user.id, base)}
                              disabled={saving === user.id || user.roles.includes('admin')}
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
