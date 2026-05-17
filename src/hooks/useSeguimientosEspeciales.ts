import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addDays, addWeeks, addMonths } from 'date-fns';

export type EstadoSeguimiento = 'abierto' | 'cerrado';
export type TipoAccionSeg = 'acompanamiento' | 'registro' | 'formativa';
export type EstadoAccionSeg = 'pendiente' | 'cumplida' | 'vencida';
export type Periodicidad = 'semanal' | 'quincenal' | 'mensual' | 'trimestral' | 'semestral';
export type TipoPlanAcciones = 'acompanamiento' | 'registro' | 'formativa' | 'ambos' | 'ninguno';

export interface BloquePlan {
  tipo: TipoAccionSeg;
  // Para acompañamiento / registro: rango con periodicidad
  periodicidad?: Periodicidad;
  fecha_inicio?: string;
  fecha_fin?: string;
  // Para formativa: fecha única + ID SAP SF
  fecha_unica?: string;
  id_sap_sf?: string;
}

export interface SeguimientoEspecial {
  id: string;
  maquinista_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  motivo: string;
  indice_prever: number | null;
  fecha_anomalia: string | null;
  email_destinatario: string | null;
  email_asunto: string | null;
  email_cuerpo: string | null;
  email_enviado_at: string | null;
  estado: EstadoSeguimiento;
  fecha_cierre: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface AccionSeguimiento {
  id: string;
  seguimiento_id: string;
  tipo: TipoAccionSeg;
  fecha_objetivo: string;
  estado: EstadoAccionSeg;
  fecha_real: string | null;
  resultado: string | null;
  observaciones: string | null;
  comentario_vencida: string | null;
}

export interface NuevoSeguimientoInput {
  maquinista_id: string;
  motivo: string;
  indice_prever?: number | null;
  fecha_anomalia?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  observaciones?: string | null;
  email_destinatario?: string | null;
  email_asunto?: string | null;
  email_cuerpo?: string | null;
  marcar_email_enviado?: boolean;
  plan?: {
    tipo: TipoPlanAcciones;
    periodicidad: Periodicidad;
  };
}

export interface DisenarPlanInput {
  seguimiento_id: string;
  bloques: BloquePlan[];
  reemplazar_pendientes?: boolean;
}

function generarFechasPlan(inicio: Date, fin: Date, periodicidad: Periodicidad): Date[] {
  const fechas: Date[] = [];
  let actual = new Date(inicio);
  const stop = new Date(fin);
  const step = (d: Date): Date => {
    switch (periodicidad) {
      case 'semanal': return addWeeks(d, 1);
      case 'quincenal': return addDays(d, 15);
      case 'mensual': return addMonths(d, 1);
      case 'trimestral': return addMonths(d, 3);
      case 'semestral': return addMonths(d, 6);
    }
  };
  let guard = 0;
  while (actual <= stop && guard < 500) {
    fechas.push(new Date(actual));
    actual = step(actual);
    guard++;
  }
  return fechas;
}

export function useSeguimientosEspeciales(maquinistaId?: string) {
  const { user } = useAuth();
  const [seguimientos, setSeguimientos] = useState<SeguimientoEspecial[]>([]);
  const [acciones, setAcciones] = useState<Record<string, AccionSeguimiento[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!maquinistaId) return;
    setLoading(true);
    try {
      const { data: segs } = await supabase
        .from('seguimientos_especiales')
        .select('*')
        .eq('maquinista_id', maquinistaId)
        .order('created_at', { ascending: false });

      const list = (segs || []) as SeguimientoEspecial[];
      setSeguimientos(list);

      if (list.length) {
        const { data: acc } = await supabase
          .from('plan_seguimiento_especial')
          .select('*')
          .in('seguimiento_id', list.map(s => s.id))
          .order('fecha_objetivo', { ascending: true });

        const byId: Record<string, AccionSeguimiento[]> = {};
        ((acc || []) as AccionSeguimiento[]).forEach(a => {
          (byId[a.seguimiento_id] ||= []).push(a);
        });
        setAcciones(byId);
      } else {
        setAcciones({});
      }
    } finally {
      setLoading(false);
    }
  }, [maquinistaId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const crear = async (input: NuevoSeguimientoInput) => {
    if (!user) throw new Error('No autenticado');
    const { plan, marcar_email_enviado, ...rest } = input;
    const insertPayload = {
      ...rest,
      email_enviado_at: marcar_email_enviado ? new Date().toISOString() : null,
      created_by: user.id,
      updated_by: user.id,
    };
    const { data: seg, error } = await supabase
      .from('seguimientos_especiales')
      .insert(insertPayload)
      .select()
      .single();
    if (error || !seg) throw error || new Error('Error al crear');

    if (plan && plan.tipo !== 'ninguno' && input.fecha_fin) {
      const fechas = generarFechasPlan(new Date(input.fecha_inicio), new Date(input.fecha_fin), plan.periodicidad);
      const tipos: TipoAccionSeg[] =
        plan.tipo === 'ambos' ? ['acompanamiento', 'registro']
        : [plan.tipo as TipoAccionSeg];

      const rows = fechas.flatMap(f => tipos.map(t => ({
        seguimiento_id: seg.id,
        tipo: t,
        fecha_objetivo: f.toISOString().slice(0, 10),
        estado: 'pendiente',
        registrado_por: user.id,
      })));
      if (rows.length) {
        await supabase.from('plan_seguimiento_especial').insert(rows);
      }
    }
    await fetchData();
    return seg as SeguimientoEspecial;
  };

  const disenarPlan = async (input: DisenarPlanInput) => {
    if (!user) throw new Error('No autenticado');

    if (input.reemplazar_pendientes) {
      await supabase.from('plan_seguimiento_especial')
        .delete()
        .eq('seguimiento_id', input.seguimiento_id)
        .eq('estado', 'pendiente');
    }

    const rows = input.bloques.flatMap(b => {
      if (b.tipo === 'formativa') {
        if (!b.fecha_unica) return [];
        return [{
          seguimiento_id: input.seguimiento_id,
          tipo: 'formativa' as const,
          fecha_objetivo: b.fecha_unica,
          estado: 'pendiente',
          registrado_por: user.id,
          observaciones: b.id_sap_sf ? `ID SAP SF: ${b.id_sap_sf}` : null,
        }];
      }
      if (!b.fecha_inicio || !b.fecha_fin || !b.periodicidad) return [];
      const fechas = generarFechasPlan(new Date(b.fecha_inicio), new Date(b.fecha_fin), b.periodicidad);
      return fechas.map(f => ({
        seguimiento_id: input.seguimiento_id,
        tipo: b.tipo,
        fecha_objetivo: f.toISOString().slice(0, 10),
        estado: 'pendiente',
        registrado_por: user.id,
        observaciones: null,
      }));
    });
    if (rows.length) {
      await supabase.from('plan_seguimiento_especial').insert(rows);
    }

    // Update fecha_fin del seguimiento al máximo fin de los bloques (incluida fecha única)
    const maxFin = input.bloques.reduce((max, b) => {
      const cand = b.fecha_fin || b.fecha_unica || '';
      return cand > max ? cand : max;
    }, '');
    if (maxFin) {
      await supabase.from('seguimientos_especiales').update({
        fecha_fin: maxFin,
        updated_by: user.id,
      }).eq('id', input.seguimiento_id);
    }
    await fetchData();
  };

  const cerrar = async (id: string, observaciones?: string) => {
    if (!user) return;
    await supabase.from('seguimientos_especiales').update({
      estado: 'cerrado',
      fecha_cierre: new Date().toISOString(),
      cerrado_por: user.id,
      observaciones: observaciones ?? undefined,
      updated_by: user.id,
    }).eq('id', id);
    await fetchData();
  };

  const eliminar = async (id: string) => {
    await supabase.from('seguimientos_especiales').delete().eq('id', id);
    await fetchData();
  };

  const registrarAccion = async (accionId: string, fechaReal: string, resultado?: string) => {
    await supabase.from('plan_seguimiento_especial').update({
      estado: 'cumplida',
      fecha_real: fechaReal,
      resultado: resultado ?? null,
    }).eq('id', accionId);
    await fetchData();
  };

  const marcarVencida = async (accionId: string, comentario: string) => {
    await supabase.from('plan_seguimiento_especial').update({
      estado: 'vencida',
      comentario_vencida: comentario,
    }).eq('id', accionId);
    await fetchData();
  };

  return { seguimientos, acciones, loading, crear, disenarPlan, cerrar, eliminar, registrarAccion, marcarVencida, refetch: fetchData };
}
