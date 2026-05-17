import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Users, ClipboardList, GraduationCap, Plus, Trash2 } from 'lucide-react';
import { DisenarPlanInput, Periodicidad, BloquePlan } from '@/hooks/useSeguimientosEspeciales';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seguimientoId: string;
  fechaInicioDefault: string;
  hasPendingActions: boolean;
  onDisenar: (input: DisenarPlanInput) => Promise<unknown>;
}

interface RangoState {
  enabled: boolean;
  periodicidad: Periodicidad;
  fecha_inicio: string;
  fecha_fin: string;
}

interface FormativaItem {
  titulo: string;
  fecha_unica: string;
  id_sap_sf: string;
}

export function DisenarPlanSeguimientoDialog({ open, onOpenChange, seguimientoId, fechaInicioDefault, hasPendingActions, onDisenar }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [reemplazar, setReemplazar] = useState(true);

  const initRango = (): RangoState => ({
    enabled: false,
    periodicidad: 'mensual',
    fecha_inicio: fechaInicioDefault,
    fecha_fin: '',
  });

  const [acompanamiento, setAcompanamiento] = useState<RangoState>(initRango());
  const [registro, setRegistro] = useState<RangoState>(initRango());
  const [formativaEnabled, setFormativaEnabled] = useState(false);
  const [formativas, setFormativas] = useState<FormativaItem[]>([
    { titulo: '', fecha_unica: fechaInicioDefault, id_sap_sf: '' },
  ]);

  const addFormativa = () => setFormativas(prev => [...prev, { titulo: '', fecha_unica: fechaInicioDefault, id_sap_sf: '' }]);
  const removeFormativa = (i: number) => setFormativas(prev => prev.filter((_, idx) => idx !== i));
  const updateFormativa = (i: number, patch: Partial<FormativaItem>) =>
    setFormativas(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));

  const validateRango = (b: RangoState, label: string): BloquePlan | null | 'error' => {
    if (!b.enabled) return null;
    if (!b.fecha_fin) { toast({ title: `Falta fecha fin en ${label}`, variant: 'destructive' }); return 'error'; }
    if (new Date(b.fecha_fin) < new Date(b.fecha_inicio)) {
      toast({ title: `Fecha fin anterior al inicio en ${label}`, variant: 'destructive' }); return 'error';
    }
    return { tipo: label === 'Acompañamientos' ? 'acompanamiento' : 'registro', periodicidad: b.periodicidad, fecha_inicio: b.fecha_inicio, fecha_fin: b.fecha_fin };
  };

  const handle = async () => {
    const activos: BloquePlan[] = [];
    const a = validateRango(acompanamiento, 'Acompañamientos');
    if (a === 'error') return;
    if (a) activos.push(a);
    const r = validateRango(registro, 'Registros');
    if (r === 'error') return;
    if (r) activos.push(r);

    if (formativaEnabled) {
      for (const f of formativas) {
        if (!f.fecha_unica) { toast({ title: 'Falta fecha en una acción formativa', variant: 'destructive' }); return; }
        activos.push({
          tipo: 'formativa',
          fecha_unica: f.fecha_unica,
          titulo: f.titulo.trim() || undefined,
          id_sap_sf: f.id_sap_sf.trim() || undefined,
        });
      }
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

  const renderRango = (
    label: string,
    Icon: any,
    color: string,
    state: RangoState,
    setState: (s: RangoState) => void,
  ) => (
    <div className={`border rounded-lg p-3 ${state.enabled ? 'bg-card' : 'bg-muted/30'}`}>
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox checked={state.enabled} onCheckedChange={v => setState({ ...state, enabled: !!v })} />
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="font-medium">{label}</span>
      </label>
      {state.enabled && (
        <div className="grid grid-cols-3 gap-3 mt-3 pl-6">
          <div>
            <Label className="text-xs">Fecha inicio</Label>
            <Input type="date" value={state.fecha_inicio} onChange={e => setState({ ...state, fecha_inicio: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Fecha fin</Label>
            <Input type="date" value={state.fecha_fin} onChange={e => setState({ ...state, fecha_fin: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Periodicidad</Label>
            <Select value={state.periodicidad} onValueChange={v => setState({ ...state, periodicidad: v as Periodicidad })}>
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
          {renderRango('Acompañamientos', Users, 'text-blue-600', acompanamiento, setAcompanamiento)}
          {renderRango('Registros', ClipboardList, 'text-emerald-600', registro, setRegistro)}

          <div className={`border rounded-lg p-3 ${formativaEnabled ? 'bg-card' : 'bg-muted/30'}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={formativaEnabled} onCheckedChange={v => setFormativaEnabled(!!v)} />
              <GraduationCap className="w-4 h-4 text-amber-600" />
              <span className="font-medium">Acciones formativas</span>
            </label>
            {formativaEnabled && (
              <div className="mt-3 pl-6 space-y-2">
                {formativas.map((f, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2 bg-background">
                    <div className="col-span-5">
                      <Label className="text-xs">Título del curso</Label>
                      <Input value={f.titulo} onChange={e => updateFormativa(i, { titulo: e.target.value })} placeholder="p.ej. Reciclaje frenado" />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">Fecha</Label>
                      <Input type="date" value={f.fecha_unica} onChange={e => updateFormativa(i, { fecha_unica: e.target.value })} />
                    </div>
                    <div className="col-span-3">
                      <Label className="text-xs">ID SAP SF</Label>
                      <Input value={f.id_sap_sf} onChange={e => updateFormativa(i, { id_sap_sf: e.target.value })} placeholder="1234567" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeFormativa(i)} disabled={formativas.length === 1}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addFormativa}>
                  <Plus className="w-4 h-4 mr-1" /> Añadir acción formativa
                </Button>
              </div>
            )}
          </div>

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
