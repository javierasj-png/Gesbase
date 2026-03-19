import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BaseConduccion {
  id: string;
  nombre: string;
  codigo: string | null;
  redes: string;
  activa: boolean;
  created_at: string;
}

export function BasesManagement() {
  const { toast } = useToast();
  const [bases, setBases] = useState<BaseConduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBase, setEditingBase] = useState<BaseConduccion | null>(null);
  const [formData, setFormData] = useState({ nombre: '', codigo: '', redes: 'convencional' });

  useEffect(() => {
    fetchBases();
  }, []);

  const fetchBases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bases_conduccion')
        .select('*')
        .order('nombre');

      if (error) throw error;
      setBases(data || []);
    } catch (error) {
      console.error('Error fetching bases:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las bases de conducción',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (base?: BaseConduccion) => {
    if (base) {
      setEditingBase(base);
      setFormData({ nombre: base.nombre, codigo: base.codigo || '', redes: base.redes || 'convencional' });
    } else {
      setEditingBase(null);
      setFormData({ nombre: '', codigo: '', redes: 'convencional' });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nombre.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'El nombre de la base es obligatorio',
      });
      return;
    }

    setSaving(true);
    try {
      if (editingBase) {
        // Update
        const { error } = await supabase
          .from('bases_conduccion')
          .update({
            nombre: formData.nombre.trim(),
            codigo: formData.codigo.trim() || null,
            redes: formData.redes,
          })
          .eq('id', editingBase.id);

        if (error) throw error;

        toast({
          title: 'Base actualizada',
          description: `${formData.nombre} se ha actualizado correctamente`,
        });
      } else {
        // Insert
        const { error } = await supabase
          .from('bases_conduccion')
          .insert({
            nombre: formData.nombre.trim(),
            codigo: formData.codigo.trim() || null,
            redes: formData.redes,
          });

        if (error) throw error;

        toast({
          title: 'Base creada',
          description: `${formData.nombre} se ha creado correctamente`,
        });
      }

      setDialogOpen(false);
      fetchBases();
    } catch (error: any) {
      console.error('Error saving base:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message?.includes('unique') 
          ? 'Ya existe una base con ese nombre'
          : 'No se pudo guardar la base',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (base: BaseConduccion) => {
    try {
      const { error } = await supabase
        .from('bases_conduccion')
        .update({ activa: !base.activa })
        .eq('id', base.id);

      if (error) throw error;

      setBases(prev => prev.map(b => 
        b.id === base.id ? { ...b, activa: !b.activa } : b
      ));

      toast({
        title: base.activa ? 'Base desactivada' : 'Base activada',
        description: `${base.nombre} se ha ${base.activa ? 'desactivado' : 'activado'}`,
      });
    } catch (error) {
      console.error('Error toggling base:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cambiar el estado de la base',
      });
    }
  };

  const handleDelete = async (base: BaseConduccion) => {
    if (!confirm(`¿Estás seguro de eliminar la base "${base.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bases_conduccion')
        .delete()
        .eq('id', base.id);

      if (error) throw error;

      setBases(prev => prev.filter(b => b.id !== base.id));

      toast({
        title: 'Base eliminada',
        description: `${base.nombre} se ha eliminado correctamente`,
      });
    } catch (error) {
      console.error('Error deleting base:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar la base. Puede que tenga asignaciones asociadas.',
      });
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
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Bases de Conducción</CardTitle>
              <CardDescription>
                Gestiona las bases de conducción del sistema
              </CardDescription>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Base
          </Button>
        </CardHeader>
        <CardContent>
          {bases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay bases de conducción registradas
            </p>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                     <th className="text-left p-3 font-medium text-sm">Nombre</th>
                     <th className="text-left p-3 font-medium text-sm">Código</th>
                     <th className="text-left p-3 font-medium text-sm">Redes</th>
                     <th className="text-left p-3 font-medium text-sm">Estado</th>
                     <th className="text-left p-3 font-medium text-sm">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bases.map((base) => (
                    <tr key={base.id} className="border-b last:border-b-0">
                      <td className="p-3 text-sm font-medium">{base.nombre}</td>
                      <td className="p-3 text-sm text-muted-foreground font-mono">
                        {base.codigo || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted">
                          {base.redes === 'ambas' ? 'Conv. + AV' : base.redes === 'av' ? 'AV' : 'Convencional'}
                        </span>
                      </td>
                      <td className="p-3">
                        <Switch
                          checked={base.activa}
                          onCheckedChange={() => handleToggleActive(base)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleOpenDialog(base)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(base)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBase ? 'Editar Base' : 'Nueva Base de Conducción'}
            </DialogTitle>
            <DialogDescription>
              {editingBase 
                ? 'Modifica los datos de la base de conducción'
                : 'Añade una nueva base de conducción al sistema'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej: Málaga-María Zambrano"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo">Código (opcional)</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="Ej: MLG"
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="redes">Redes</Label>
              <Select
                value={formData.redes}
                onValueChange={(value) => setFormData(prev => ({ ...prev, redes: value }))}
              >
                <SelectTrigger id="redes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="convencional">Convencional</SelectItem>
                  <SelectItem value="av">Alta Velocidad (AV)</SelectItem>
                  <SelectItem value="ambas">Ambas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBase ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}