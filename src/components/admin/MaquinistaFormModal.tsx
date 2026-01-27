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
import { useAuth } from '@/contexts/AuthContext';
import { Maquinista, Base } from '@/types';
import { format } from 'date-fns';

interface MaquinistaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maquinista?: Maquinista | null;
  onSave: (maquinista: Maquinista & { bajoPE1603?: boolean; fechaPrimerServicio?: Date }) => void;
}

interface BaseConduccion {
  id: string;
  nombre: string;
}

export function MaquinistaFormModal({ open, onOpenChange, maquinista, onSave }: MaquinistaFormModalProps) {
  const { toast } = useToast();
  const { isAdmin, assignedBases } = useAuth();
  const [loading, setLoading] = useState(false);
  const [allBases, setAllBases] = useState<BaseConduccion[]>([]);
  
  const [formData, setFormData] = useState({
    matricula: '',
    nombreApellidos: '',
    base: '' as Base | '',
    activo: true,
    observaciones: '',
    bajoPE1603: false,
    fechaPrimerServicio: '',
  });

  // Filtrar bases según permisos del usuario
  const availableBases = isAdmin 
    ? allBases 
    : allBases.filter(b => assignedBases.includes(b.nombre as Base));

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
          bajoPE1603: false,
          fechaPrimerServicio: '',
        });
      } else {
        // Si el mando solo tiene una base asignada, preseleccionarla
        const defaultBase = !isAdmin && assignedBases.length === 1 ? assignedBases[0] : '';
        setFormData({
          matricula: '',
          nombreApellidos: '',
          base: defaultBase,
          activo: true,
          observaciones: '',
          bajoPE1603: false,
          fechaPrimerServicio: '',
        });
      }
    }
  }, [open, maquinista, isAdmin, assignedBases]);

  const fetchBases = async () => {
    const { data, error } = await supabase
      .from('bases_conduccion')
      .select('id, nombre')
      .eq('activa', true)
      .order('nombre');

    if (!error && data) {
      setAllBases(data);
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

    if (formData.bajoPE1603 && !formData.fechaPrimerServicio) {
      toast({
        title: 'Fecha requerida',
        description: 'Debe indicar la fecha del primer servicio para PE 16.03',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const result = {
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
        bajoPE1603: formData.bajoPE1603,
        fechaPrimerServicio: formData.fechaPrimerServicio ? new Date(formData.fechaPrimerServicio) : undefined,
      };

      onSave(result);
      toast({
        title: maquinista ? 'Maquinista actualizado' : 'Maquinista creado',
        description: formData.bajoPE1603 
          ? `${result.nombreApellidos} guardado y asignado a vigilancia PE 16.03`
          : `${result.nombreApellidos} guardado correctamente`,
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
                {availableBases.map((base) => (
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

          {/* PE 16.03 */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="bajoPE1603" className="font-medium">Bajo PE 16.03</Label>
                <p className="text-xs text-muted-foreground">Nuevo acceso (&lt;3 años en producción)</p>
              </div>
              <Switch
                id="bajoPE1603"
                checked={formData.bajoPE1603}
                onCheckedChange={(checked) => setFormData({ ...formData, bajoPE1603: checked, fechaPrimerServicio: checked ? formData.fechaPrimerServicio : '' })}
              />
            </div>

            {formData.bajoPE1603 && (
              <div className="space-y-2">
                <Label htmlFor="fechaPrimerServicio">Fecha primer servicio en producción *</Label>
                <Input
                  id="fechaPrimerServicio"
                  type="date"
                  value={formData.fechaPrimerServicio}
                  onChange={(e) => setFormData({ ...formData, fechaPrimerServicio: e.target.value })}
                  max={format(new Date(), 'yyyy-MM-dd')}
                />
                <p className="text-xs text-muted-foreground">
                  Se generará el plan de vigilancia de 3 años desde esta fecha
                </p>
              </div>
            )}
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
