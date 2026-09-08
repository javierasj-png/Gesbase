import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type MotivoInactividad = 'baja_temporal' | 'traslado_externo';

export interface Inactividad {
  id: string;
  maquinista_id: string;
  motivo: MotivoInactividad;
  observaciones: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  created_at: string;
}

export const MOTIVO_LABEL: Record<MotivoInactividad, string> = {
  baja_temporal: 'Baja temporal (volverá a la residencia)',
  traslado_externo: 'Traslado fuera de la aplicación',
};

const iso = (d: Date) => d.toISOString().split('T')[0];

export function useInactividades(maquinistaId?: string) {
  const { toast } = useToast();
  const [periodos, setPeriodos] = useState<Inactividad[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPeriodos = useCallback(async () => {
    if (!maquinistaId) return;
    setLoading(true);
    const { data } = await supabase
      .from('maquinista_inactividades' as never)
      .select('*')
      .eq('maquinista_id', maquinistaId)
      .order('fecha_inicio', { ascending: false });
    setPeriodos((data as unknown as Inactividad[]) ?? []);
    setLoading(false);
  }, [maquinistaId]);

  useEffect(() => {
    fetchPeriodos();
  }, [fetchPeriodos]);

  /** Desactiva al maquinista y abre un periodo de inactividad. */
  const desactivar = async (
    id: string,
    motivo: MotivoInactividad,
    fechaInicio: Date,
    observaciones?: string
  ): Promise<boolean> => {
    const { error: e1 } = await supabase
      .from('maquinistas')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ activo: false } as any)
      .eq('id', id);

    if (e1) {
      toast({ title: 'Error', description: 'No se pudo desactivar al maquinista', variant: 'destructive' });
      return false;
    }

    const { data: userRes } = await supabase.auth.getUser();
    await supabase.from('maquinista_inactividades' as never).insert([
      {
        maquinista_id: id,
        motivo,
        fecha_inicio: iso(fechaInicio),
        observaciones: observaciones || null,
        created_by: userRes?.user?.id ?? null,
      },
    ] as never);

    toast({
      title: 'Maquinista inactivo',
      description: 'Sus acciones quedan fuera de la planificación mientras esté inactivo.',
    });
    await fetchPeriodos();
    return true;
  };

  /**
   * Reactiva al maquinista, cierra el periodo abierto y justifica automáticamente
   * las acciones que hayan vencido durante la inactividad.
   */
  const reactivar = async (id: string, fechaFin: Date): Promise<boolean> => {
    const { data: abiertos } = await supabase
      .from('maquinista_inactividades' as never)
      .select('*')
      .eq('maquinista_id', id)
      .is('fecha_fin', null)
      .order('fecha_inicio', { ascending: false })
      .limit(1);

    const periodo = (abiertos as unknown as Inactividad[])?.[0];
    const desde = periodo?.fecha_inicio ?? null;
    const hasta = iso(fechaFin);

    const { error: e1 } = await supabase
      .from('maquinistas')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ activo: true } as any)
      .eq('id', id);

    if (e1) {
      toast({ title: 'Error', description: 'No se pudo reactivar al maquinista', variant: 'destructive' });
      return false;
    }

    if (periodo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('maquinista_inactividades' as never) as any)
        .update({ fecha_fin: hasta })
        .eq('id', periodo.id);
    }

    let justificadas = 0;
    if (desde) {
      justificadas = await justificarAcciones(id, desde, hasta);
    }

    toast({
      title: 'Maquinista activo',
      description: justificadas
        ? `Se han recuperado sus planes y justificado ${justificadas} acción(es) vencidas durante la inactividad.`
        : 'Se han recuperado sus planes de vigilancia.',
    });
    await fetchPeriodos();
    return true;
  };

  return { periodos, loading, desactivar, reactivar, refetch: fetchPeriodos };
}

/** Marca como justificadas las acciones pendientes cuyo vencimiento cae dentro del periodo de inactividad. */
export async function justificarAcciones(
  maquinistaId: string,
  desde: string,
  hasta: string
): Promise<number> {
  const comentario = `Justificado automáticamente: maquinista inactivo del ${formatEs(desde)} al ${formatEs(hasta)}.`;
  let total = 0;

  // PE 16.03
  const { data: exp1603 } = await supabase
    .from('expedientes_1603')
    .select('id')
    .eq('maquinista_id', maquinistaId);
  const ids1603 = (exp1603 ?? []).map(e => e.id);
  if (ids1603.length) {
    const { data } = await supabase
      .from('plan_1603')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ justificado_inactividad: true, comentario_vencida: comentario } as any)
      .in('expediente_id', ids1603)
      .is('actuacion_id', null)
      .gte('fin_ventana', desde)
      .lte('fin_ventana', hasta)
      .select('id');
    total += data?.length ?? 0;
  }

  // PE 12.01
  const { data: exp1201 } = await supabase
    .from('expedientes_1201')
    .select('id')
    .eq('maquinista_id', maquinistaId);
  const ids1201 = (exp1201 ?? []).map(e => e.id);
  if (ids1201.length) {
    const { data } = await supabase
      .from('plan_1201')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ justificado_inactividad: true, comentario_vencida: comentario } as any)
      .in('expediente_id', ids1201)
      .is('actuacion_id', null)
      .gte('fecha_objetivo', desde)
      .lte('fecha_objetivo', hasta)
      .select('id');
    total += data?.length ?? 0;
  }

  // Seguimientos especiales
  const { data: seg } = await supabase
    .from('seguimientos_especiales')
    .select('id')
    .eq('maquinista_id', maquinistaId);
  const idsSeg = (seg ?? []).map(s => s.id);
  if (idsSeg.length) {
    const { data } = await supabase
      .from('plan_seguimiento_especial')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ justificado_inactividad: true, comentario_vencida: comentario } as any)
      .in('seguimiento_id', idsSeg)
      .neq('estado', 'realizado')
      .gte('fecha_objetivo', desde)
      .lte('fecha_objetivo', hasta)
      .select('id');
    total += data?.length ?? 0;
  }

  // Planes específicos de vigilancia
  {
    const { data } = await supabase
      .from('planes_vigilancia_acciones')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ justificado_inactividad: true } as any)
      .eq('maquinista_id', maquinistaId)
      .is('fecha_real', null)
      .gte('fecha_prevista', desde)
      .lte('fecha_prevista', hasta)
      .select('id');
    total += data?.length ?? 0;
  }

  return total;
}

function formatEs(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
