import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { DisenarPlanInput, Periodicidad, TipoPlanAcciones } from '@/hooks/useSeguimientosEspeciales';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seguimientoId: string;
  fechaInicioDefault: string;
  hasPendingActions: boolean;
  onDisenar: (input: DisenarPlanInput) => Promise<unknown>;
}

export function DisenarPlanSeguimientoDialog({ open, onOpenChange, seguimientoId, fechaInicioDefault, hasPendingActions, onDisenar }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(fechaInicioDefault);
  const [fechaFin, setFechaFin] = useState('');
  const [tipo, setTipo] = useState<Exclude<TipoPlanAcciones, 'ninguno'>>('acompanamiento');
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('mensual');
  const [reemplazar, setReemplazar] = useState(true);

  const handle = async () => {
    if (!fechaFin) { toast({ title: 'Indica fecha fin', variant: 'destructive' }); return; }
    if (new Date(fechaFin) < new Date(fechaInicio)) { toast({ title: 'Fecha fin anterior al inicio', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await onDisenar({ seguimiento_id: seguimientoId, fecha_inicio: fechaInicio, fecha_fin: fechaFin, tipo, periodicidad, reemplazar_pendientes: reemplazar });
      toast({ title: 'Plan generado' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Diseñar plan de acciones</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fecha inicio</Label>
              <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label>Fecha fin</Label>
              <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="acompanamiento">Acompañamientos</SelectItem>
                  <SelectItem value="registro">Registros</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Periodicidad</Label>
              <Select value={periodicidad} onValueChange={v => setPeriodicidad(v as Periodicidad)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {hasPendingActions && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={reemplazar} onCheckedChange={v => setReemplazar(!!v)} />
              Reemplazar acciones pendientes existentes
            </label>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handle} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Generar plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
