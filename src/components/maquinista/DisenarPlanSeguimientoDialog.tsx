import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Users, ClipboardList, GraduationCap } from 'lucide-react';
import { DisenarPlanInput, Periodicidad, TipoAccionSeg, BloquePlan } from '@/hooks/useSeguimientosEspeciales';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seguimientoId: string;
  fechaInicioDefault: string;
  hasPendingActions: boolean;
  onDisenar: (input: DisenarPlanInput) => Promise<unknown>;
}

interface BloqueState {
  enabled: boolean;
  periodicidad: Periodicidad;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_unica: string;
  id_sap_sf: string;
}

const TIPOS: { key: TipoAccionSeg; label: string; icon: any; color: string }[] = [
  { key: 'acompanamiento', label: 'Acompañamientos', icon: Users, color: 'text-blue-600' },
  { key: 'registro', label: 'Registros', icon: ClipboardList, color: 'text-emerald-600' },
  { key: 'formativa', label: 'Acción formativa', icon: GraduationCap, color: 'text-amber-600' },
];

export function DisenarPlanSeguimientoDialog({ open, onOpenChange, seguimientoId, fechaInicioDefault, hasPendingActions, onDisenar }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [reemplazar, setReemplazar] = useState(true);

  const initBloque = (): BloqueState => ({
    enabled: false,
    periodicidad: 'mensual',
    fecha_inicio: fechaInicioDefault,
    fecha_fin: '',
    fecha_unica: fechaInicioDefault,
    id_sap_sf: '',
  });

  const [bloques, setBloques] = useState<Record<TipoAccionSeg, BloqueState>>({
    acompanamiento: initBloque(),
    registro: initBloque(),
    formativa: initBloque(),
  });

  const update = (tipo: TipoAccionSeg, patch: Partial<BloqueState>) => {
    setBloques(prev => ({ ...prev, [tipo]: { ...prev[tipo], ...patch } }));
  };

  const handle = async () => {
    const activos: BloquePlan[] = [];
    for (const t of TIPOS) {
      const b = bloques[t.key];
      if (!b.enabled) continue;
      if (t.key === 'formativa') {
        if (!b.fecha_unica) { toast({ title: 'Falta fecha en Acción formativa', variant: 'destructive' }); return; }
        activos.push({ tipo: 'formativa', fecha_unica: b.fecha_unica, id_sap_sf: b.id_sap_sf.trim() || undefined });
        continue;
      }
      if (!b.fecha_fin) { toast({ title: `Falta fecha fin en ${t.label}`, variant: 'destructive' }); return; }
      if (new Date(b.fecha_fin) < new Date(b.fecha_inicio)) {
        toast({ title: `Fecha fin anterior al inicio en ${t.label}`, variant: 'destructive' }); return;
      }
      activos.push({
        tipo: t.key,
        periodicidad: b.periodicidad,
        fecha_inicio: b.fecha_inicio,
        fecha_fin: b.fecha_fin,
      });
    }
    if (activos.length === 0) {
      toast({ title: 'Activa al menos un tipo de acción', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await onDisenar({ seguimiento_id: seguimientoId, bloques: activos, reemplazar_pendientes: reemplazar });
      toast({ title: 'Plan generado' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Diseñar plan de acciones</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Activa cada tipo de acción y configura su periodicidad y ventana de forma independiente.
          </p>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {TIPOS.map(t => {
            const b = bloques[t.key];
            const Icon = t.icon;
            return (
              <div key={t.key} className={`border rounded-lg p-3 ${b.enabled ? 'bg-card' : 'bg-muted/30'}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={b.enabled} onCheckedChange={v => update(t.key, { enabled: !!v })} />
                  <Icon className={`w-4 h-4 ${t.color}`} />
                  <span className="font-medium">{t.label}</span>
                </label>
                {b.enabled && (
                  <div className="grid grid-cols-3 gap-3 mt-3 pl-6">
                    <div>
                      <Label className="text-xs">Fecha inicio</Label>
                      <Input type="date" value={b.fecha_inicio} onChange={e => update(t.key, { fecha_inicio: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Fecha fin</Label>
                      <Input type="date" value={b.fecha_fin} onChange={e => update(t.key, { fecha_fin: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Periodicidad</Label>
                      <Select value={b.periodicidad} onValueChange={v => update(t.key, { periodicidad: v as Periodicidad })}>
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
                )}
              </div>
            );
          })}

          {hasPendingActions && (
            <label className="flex items-center gap-2 text-sm pt-2">
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
