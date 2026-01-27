import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Maquinista, Base } from '@/types';

interface MaquinistaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maquinista?: Maquinista | null;
  onSave: (maquinista: Maquinista) => void;
}

interface BaseConduccion {
  id: string;
  nombre: string;
}

export function MaquinistaFormModal({ open, onOpenChange, maquinista, onSave }: MaquinistaFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bases, setBases] = useState<BaseConduccion[]>([]);
  
  const [formData, setFormData] = useState({
    matricula: '',
    nombreApellidos: '',
    base: '' as Base | '',
    activo: true,
    observaciones: '',
  });

  useEffect(() => {
    if (open) {
      fetchBases();
      if (maquinista) {
        setFormData({
          matricula: maquinista.matricula,
          nombreApellidos: maquinista.nombreApellidos,
          base: maquinista.base,
          activo: maquinista.activo,
          observaciones: maquinista.observaciones || '',
        });
      } else {
        setFormData({
          matricula: '',
          nombreApellidos: '',
          base: '',
          activo: true,
          observaciones: '',
        });
      }
    }
  }, [open, maquinista]);

  const fetchBases = async () => {
    const { data, error } = await supabase
      .from('bases_conduccion')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre');

    if (!error && data) {
      setBases(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.matricula.trim() || !formData.nombreApellidos.trim() || !formData.base) {
      toast({
        title: 'Campos requeridos',
        description: 'Matrícula, nombre y base son obligatorios',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const newMaquinista: Maquinista = {
        id: maquinista?.id || `m-${Date.now()}`,
        matricula: formData.matricula.trim(),
        nombreApellidos: formData.nombreApellidos.trim(),
        base: formData.base as Base,
        activo: formData.activo,
        observaciones: formData.observaciones.trim() || undefined,
        createdAt: maquinista?.createdAt || now,
        createdBy: maquinista?.createdBy || 'current-user',
        updatedAt: now,
        updatedBy: 'current-user',
      };

      onSave(newMaquinista);
      toast({
        title: maquinista ? 'Maquinista actualizado' : 'Maquinista creado',
        description: `${newMaquinista.nombreApellidos} guardado correctamente`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el maquinista',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{maquinista ? 'Editar Maquinista' : 'Nuevo Maquinista'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="matricula">Matrícula *</Label>
            <Input
              id="matricula"
              value={formData.matricula}
              onChange={(e) => setFormData({ ...formData, matricula: e.target.value })}
              placeholder="Ej: 12345A"
              maxLength={20}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombreApellidos">Nombre y Apellidos *</Label>
            <Input
              id="nombreApellidos"
              value={formData.nombreApellidos}
              onChange={(e) => setFormData({ ...formData, nombreApellidos: e.target.value })}
              placeholder="Ej: Juan Pérez López"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="base">Base *</Label>
            <Select
              value={formData.base}
              onValueChange={(value) => setFormData({ ...formData, base: value as Base })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar base" />
              </SelectTrigger>
              <SelectContent>
                {bases.map((base) => (
                  <SelectItem key={base.id} value={base.nombre}>
                    {base.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones}
              onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
              placeholder="Notas adicionales..."
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="activo">Activo</Label>
            <Switch
              id="activo"
              checked={formData.activo}
              onCheckedChange={(checked) => setFormData({ ...formData, activo: checked })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
