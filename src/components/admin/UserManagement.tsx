import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Shield, Building2, Loader2, CheckCircle, Clock, UserCheck, Pencil, Trash2, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types';

interface UserWithDetails {
  id: string;
  user_id: string;
  email: string;
  nombre?: string;
  apellidos?: string;
  roles: AppRole[];
  bases: string[];
  status: 'pending' | 'active';
}

interface BaseConduccion {
  id: string;
  nombre: string;
  activa: boolean;
}

export function UserManagement() {
  const { toast } = useToast();
  const { isAdmin, isGestor, assignedBases } = useAuth();
  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [allBases, setAllBases] = useState<BaseConduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Edit dialog state
  const [editUser, setEditUser] = useState<UserWithDetails | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editApellidos, setEditApellidos] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete dialog state
  const [deleteUser, setDeleteUser] = useState<UserWithDetails | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: basesConduccion, error: basesConduccionError } = await supabase
        .from('bases_conduccion')
        .select('id, nombre, activa')
        .eq('activa', true)
        .order('nombre');

      if (basesConduccionError) throw basesConduccionError;
      setAllBases(basesConduccion || []);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const { data: bases, error: basesError } = await supabase
        .from('base_assignments')
        .select('*');

      if (basesError) {
        console.error('Error fetching base assignments:', basesError);
      }

      const usersWithDetails: UserWithDetails[] = (profiles || []).map(profile => {
        const profileUserId = (profile as any).user_id || profile.id;
        return {
          id: profile.id,
          user_id: profileUserId,
          email: profile.email,
          nombre: profile.nombre || undefined,
          apellidos: profile.apellidos || undefined,
          status: ((profile as any).status as 'pending' | 'active') || 'pending',
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

  const handleActivateUser = async (userId: string) => {
    setSaving(userId);
    const user = users.find(u => u.user_id === userId);
    if (!user) return;

    try {
      const { error: statusError } = await supabase
        .from('profiles')
        .update({ status: 'active' } as any)
        .eq('user_id', userId);

      if (statusError) throw statusError;

      if (user.roles.length === 0) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert([{ user_id: userId, role: 'mando' as any }]);

        if (roleError) throw roleError;
      }

      setUsers(prev => prev.map(u => {
        if (u.user_id === userId) {
          return {
            ...u,
            status: 'active' as const,
            roles: u.roles.length === 0 ? ['mando' as AppRole] : u.roles,
          };
        }
        return u;
      }));

      toast({
        title: 'Usuario activado',
        description: `${user.email} puede acceder al sistema`,
      });
    } catch (error) {
      console.error('Error activating user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo activar el usuario',
      });
    } finally {
      setSaving(null);
    }
  };

  const handleToggleRole = async (userId: string, role: AppRole) => {
    setSaving(userId);
    const user = users.find(u => u.user_id === userId);
    if (!user) return;

    if (isGestor && !isAdmin && role !== 'mando') {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'Solo puedes asignar el rol Mando',
      });
      setSaving(null);
      return;
    }

    const hasRole = user.roles.includes(role);

    try {
      if (hasRole) {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', role);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .insert([{ user_id: userId, role }]);
        if (error) throw error;
      }

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

    if (isGestor && !isAdmin && !assignedBases.includes(baseName as any)) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'Solo puedes asignar tus propias bases',
      });
      setSaving(null);
      return;
    }

    const hasBase = user.bases.includes(baseName);

    try {
      if (hasBase) {
        const { error } = await supabase
          .from('base_assignments')
          .delete()
          .eq('user_id', userId)
          .eq('base_nombre', baseName);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('base_assignments')
          .insert([{ user_id: userId, base_nombre: baseName }]);
        if (error) throw error;
      }

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

  // ── Edit user ──
  const openEditDialog = (user: UserWithDetails) => {
    setEditUser(user);
    setEditNombre(user.nombre || '');
    setEditApellidos(user.apellidos || '');
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nombre: editNombre.trim(), apellidos: editApellidos.trim() } as any)
        .eq('user_id', editUser.user_id);

      if (error) throw error;

      setUsers(prev => prev.map(u =>
        u.user_id === editUser.user_id
          ? { ...u, nombre: editNombre.trim() || undefined, apellidos: editApellidos.trim() || undefined }
          : u
      ));

      toast({ title: 'Usuario actualizado' });
      setEditUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el usuario' });
    } finally {
      setEditSaving(false);
    }
  };

  // ── Reset password (admin) ──
  const handleResetPassword = async (user: UserWithDetails) => {
    setSaving(user.user_id);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({
        title: 'Correo enviado',
        description: `Se ha enviado un enlace de restablecimiento de contraseña a ${user.email}`,
      });
    } catch (error) {
      console.error('Error sending password reset:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo enviar el correo de restablecimiento' });
    } finally {
      setSaving(null);
    }
  };

  // ── Delete user ──
  const handleDeleteUser = async () => {
    if (!deleteUser) return;
    setDeleteSaving(true);
    try {
      // Delete base_assignments, user_roles, then profile (cascade)
      await supabase.from('base_assignments').delete().eq('user_id', deleteUser.user_id);
      await supabase.from('user_roles').delete().eq('user_id', deleteUser.user_id);
      const { error } = await supabase.from('profiles').delete().eq('user_id', deleteUser.user_id);
      if (error) throw error;

      setUsers(prev => prev.filter(u => u.user_id !== deleteUser.user_id));
      toast({ title: 'Usuario eliminado', description: `${deleteUser.email} ha sido eliminado del sistema` });
      setDeleteUser(null);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el usuario' });
    } finally {
      setDeleteSaving(false);
    }
  };

  const visibleBases = isAdmin 
    ? allBases.map(b => b.nombre)
    : assignedBases as string[];

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'active');

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const renderUserCard = (user: UserWithDetails) => (
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
        <div className="flex gap-2 flex-wrap items-center">
          {/* Admin-only edit & delete buttons */}
          {isAdmin && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Editar usuario"
                onClick={() => openEditDialog(user)}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Restablecer contraseña"
                disabled={saving === user.user_id}
                onClick={() => handleResetPassword(user)}
              >
                {saving === user.user_id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                title="Eliminar usuario"
                onClick={() => setDeleteUser(user)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {user.status === 'pending' ? (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300">
              <Clock className="w-3 h-3 mr-1" />
              Pendiente
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300">
              <CheckCircle className="w-3 h-3 mr-1" />
              Activo
            </Badge>
          )}
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

      {user.status === 'pending' && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Este usuario necesita ser activado para poder operar
          </p>
          <Button
            size="sm"
            onClick={() => handleActivateUser(user.user_id)}
            disabled={saving === user.user_id}
            className="gap-1"
          >
            {saving === user.user_id ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <UserCheck className="w-3 h-3" />
            )}
            Activar
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Roles
          </Label>
          <div className="space-y-2">
            {isAdmin && (
              <>
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
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm">Mando</span>
              <Switch
                checked={user.roles.includes('mando')}
                onCheckedChange={() => handleToggleRole(user.user_id, 'mando')}
                disabled={saving === user.user_id}
              />
            </div>
            {isGestor && !isAdmin && (
              <p className="text-xs text-muted-foreground mt-2">
                Como Gestor, solo puedes asignar el rol <strong>Mando</strong>
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Bases Asignadas
            {user.roles.includes('admin') && (
              <span className="text-xs text-muted-foreground">(Admin tiene acceso global)</span>
            )}
          </Label>
          <div className="space-y-2">
            {allBases
              .filter(base => isAdmin || visibleBases.includes(base.nombre))
              .map(base => (
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
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <CardTitle>Gestión de Usuarios</CardTitle>
          </div>
          <CardDescription>
            Valida usuarios pendientes y asigna roles y bases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={pendingUsers.length > 0 ? "pending" : "active"}>
            <TabsList className="mb-4">
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="w-4 h-4" />
                Pendientes
                {pendingUsers.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                    {pendingUsers.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="active" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Activos ({activeUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {pendingUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay usuarios pendientes de activación
                </p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto space-y-4 pr-1">
                  {pendingUsers.map(renderUserCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="active">
              {activeUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay usuarios activos
                </p>
              ) : (
                <div className="max-h-[600px] overflow-y-auto space-y-4 pr-1">
                  {activeUsers.map(renderUserCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-nombre">Nombre</Label>
              <Input id="edit-nombre" value={editNombre} onChange={e => setEditNombre(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-apellidos">Apellidos</Label>
              <Input id="edit-apellidos" value={editApellidos} onChange={e => setEditApellidos(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleEditSave} disabled={editSaving}>
              {editSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteUser?.email}</strong> del sistema, incluyendo sus roles y bases asignadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteSaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
