import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTiposAccionVigilancia,
  type AccionPlanVigilancia,
  type PlanVigilanciaConProgreso,
} from '@/hooks/usePlanesVigilancia';
import { CalendarRange, CheckCircle2, Loader2, Mail, Save, Shuffle } from 'lucide-react';

import { ComunicacionNoConformidadesDialog } from './ComunicacionNoConformidadesDialog';

interface Props {
  plan: PlanVigilanciaConProgreso | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}

interface Fila extends AccionPlanVigilancia {
  maquinistaNombre: string;
}

const dias = (a: string, b: string) =>
  Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

const sumarDias = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function PlanVigilanciaDetalle({ plan, open, onOpenChange, onChanged }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tipos } = useTiposAccionVigilancia();

  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [comunicacionOpen, setComunicacionOpen] = useState(false);

  const nombreTipo = (id: string) => tipos.find((t) => t.id === id)?.nombre ?? id;

  const cargar = useCallback(async () => {
    if (!plan) return;
    setLoading(true);
    const { data } = await supabase
      .from('planes_vigilancia_acciones')
      .select('*, maquinistas(nombre, apellidos)')
      .eq('plan_id', plan.id)
      .order('fecha_prevista');
    const list: Fila[] = ((data as any[]) || []).map((a) => ({
      ...(a as AccionPlanVigilancia),
      maquinistaNombre: a.maquinistas
        ? `${a.maquinistas.apellidos}, ${a.maquinistas.nombre}`
        : '—',
    }));
    list.sort((a, b) =>
      a.maquinistaNombre.localeCompare(b.maquinistaNombre, 'es') ||
      a.fecha_prevista.localeCompare(b.fecha_prevista)
    );
    setFilas(list);
    setLoading(false);
  }, [plan]);

  useEffect(() => {
    if (open) cargar();
  }, [open, cargar]);

  const generarPropuesta = () => {
    if (!plan) return;
    const span = dias(plan.fecha_inicio, plan.fecha_fin);
    const total = filas.length || 1;
    const nuevas = filas.map((f, i) => {
      let offset: number;
      if (plan.distribucion === 'aleatoria') {
        offset = Math.floor(Math.random() * (span + 1));
      } else {
        offset = Math.round(((i + 0.5) * span) / total);
      }
      return { ...f, fecha_prevista: sumarDias(plan.fecha_inicio, offset) };
    });
    setFilas(nuevas);
    toast({ title: 'Propuesta generada', description: 'Revisa las fechas y guarda la propuesta.' });
  };

  const setFila = (id: string, patch: Partial<Fila>) =>
    setFilas((s) => s.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const guardar = async (nuevoEstado?: 'propuesta' | 'validado') => {
    if (!plan) return;
    setSaving(true);
    try {
      for (const f of filas) {
        const { error } = await supabase
          .from('planes_vigilancia_acciones')
          .update({
            fecha_prevista: f.fecha_prevista,
            fecha_real: f.fecha_real,
            estado: f.estado,
            resultado: f.resultado,
            observaciones: f.observaciones,
            updated_by: user?.id ?? null,
          } as any)
          .eq('id', f.id);
        if (error) throw error;
      }

      if (nuevoEstado) {
        const { error } = await supabase
          .from('planes_vigilancia')
          .update({ estado: nuevoEstado, updated_by: user?.id ?? null } as any)
          .eq('id', plan.id);
        if (error) throw error;
      }

      toast({
        title: nuevoEstado === 'validado' ? 'Plan validado' : 'Cambios guardados',
      });
      onChanged();
      await cargar();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron guardar los cambios.' });
    } finally {
      setSaving(false);
    }
  };

  const resumen = useMemo(() => {
    const realizadas = filas.filter((f) => f.estado === 'realizada').length;
    const pendientes = filas.filter((f) => f.estado === 'pendiente').length;
    return { total: filas.length, realizadas, pendientes };
  }, [filas]);

  const noConformidades = useMemo(
    () =>
      filas
        .filter((f) => f.resultado === 'no_conforme')
        .map((f) => ({
          maquinista: f.maquinistaNombre,
          accion: f.tipo_accion_libre || nombreTipo(f.tipo_accion),
          fecha: f.fecha_real || f.fecha_prevista,
          observaciones: f.observaciones,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filas, tipos]
  );

  if (!plan) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{plan.nombre}</DialogTitle>
          <DialogDescription>
            {plan.base} · {plan.fecha_inicio} – {plan.fecha_fin} · distribución {plan.distribucion} ·{' '}
            {resumen.realizadas}/{resumen.total} realizadas · {resumen.pendientes} pendientes
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={generarPropuesta} disabled={saving || plan.estado === 'archivado'}>
            {plan.distribucion === 'aleatoria' ? <Shuffle className="w-4 h-4 mr-1" /> : <CalendarRange className="w-4 h-4 mr-1" />}
            Generar propuesta de fechas
          </Button>
          <Button size="sm" onClick={() => guardar('validado')} disabled={saving}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Validar plan
          </Button>

          {noConformidades.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setComunicacionOpen(true)}>
              <Mail className="w-4 h-4 mr-1" /> Comunicación ({noConformidades.length}) · opcional
            </Button>
          )}
        </div>

        <ComunicacionNoConformidadesDialog
          open={comunicacionOpen}
          onOpenChange={setComunicacionOpen}
          planNombre={plan.nombre}
          base={plan.base}
          items={noConformidades}
        />

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando acciones...
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-2 py-1.5 font-medium">Maquinista</th>
                  <th className="px-2 py-1.5 font-medium">Acción</th>
                  <th className="px-2 py-1.5 font-medium">Prevista</th>
                  <th className="px-2 py-1.5 font-medium">Estado</th>
                  <th className="px-2 py-1.5 font-medium">Fecha real</th>
                  <th className="px-2 py-1.5 font-medium">Resultado</th>
                  <th className="px-2 py-1.5 font-medium">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filas.map((f) => (
                  <tr key={f.id}>
                    <td className="px-2 py-1 whitespace-nowrap">{f.maquinistaNombre}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {f.tipo_accion_libre || nombreTipo(f.tipo_accion)}
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="date"
                        className="h-7 w-[130px] text-xs"
                        value={f.fecha_prevista}
                        onChange={(e) => setFila(f.id, { fecha_prevista: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Select
                        value={f.estado}
                        onValueChange={(v) => setFila(f.id, { estado: v as Fila['estado'] })}
                      >
                        <SelectTrigger className="h-7 w-[125px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendiente">Pendiente</SelectItem>
                          <SelectItem value="realizada">Realizada</SelectItem>
                          <SelectItem value="no_realizada">No realizada</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="date"
                        className="h-7 w-[130px] text-xs"
                        value={f.fecha_real || ''}
                        onChange={(e) => setFila(f.id, { fecha_real: e.target.value || null })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <Select
                        value={f.resultado || 'sin'}
                        onValueChange={(v) => setFila(f.id, { resultado: v === 'sin' ? null : (v as Fila['resultado']) })}
                      >
                        <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sin">—</SelectItem>
                          <SelectItem value="conforme">Conforme</SelectItem>
                          <SelectItem value="no_conforme">No conforme</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        className="h-7 text-xs min-w-[160px]"
                        value={f.observaciones || ''}
                        onChange={(e) => setFila(f.id, { observaciones: e.target.value || null })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
