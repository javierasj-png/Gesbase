import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CategoriaPlan = 'especifico' | 'campania';
export type ModoAlcance = 'concretos' | 'porcentaje' | 'todos';
export type DistribucionPlan = 'uniforme' | 'aleatoria' | 'manual';
export type EstadoPlan = 'borrador' | 'propuesta' | 'validado' | 'completado' | 'archivado';

export interface TipoAccionVigilancia {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo_plan_anual: string | null;
  activo: boolean;
  orden: number;
}

export interface PlanVigilancia {
  id: string;
  categoria: CategoriaPlan;
  nombre: string;
  descripcion: string | null;
  responsable: string | null;
  base: string;
  modo_alcance: ModoAlcance;
  porcentaje: number | null;
  fecha_inicio: string;
  fecha_fin: string;
  distribucion: DistribucionPlan;
  estado: EstadoPlan;
  archived_at: string | null;
  created_at: string;
}

export interface AccionPlanVigilancia {
  id: string;
  plan_id: string;
  maquinista_id: string;
  tipo_accion: string;
  tipo_accion_libre: string | null;
  fecha_prevista: string;
  fecha_real: string | null;
  estado: 'pendiente' | 'realizada' | 'no_realizada';
  resultado: 'conforme' | 'no_conforme' | null;
  observaciones: string | null;
  actuacion_plan_anual_id?: string | null;
}

export interface PlanVigilanciaConProgreso extends PlanVigilancia {
  totalAcciones: number;
  accionesRealizadas: number;
  progreso: number;
  tipos: string[];
  maquinistas: number;
}

export function useTiposAccionVigilancia() {
  const [tipos, setTipos] = useState<TipoAccionVigilancia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('tipos_accion_vigilancia')
        .select('*')
        .eq('activo', true)
        .order('orden');
      setTipos((data as TipoAccionVigilancia[]) || []);
      setLoading(false);
    })();
  }, []);

  return { tipos, loading };
}

export function usePlanesVigilancia() {
  const [planes, setPlanes] = useState<PlanVigilanciaConProgreso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlanes = useCallback(async () => {
    setLoading(true);
    try {
      const { data: planesData, error: planesError } = await supabase
        .from('planes_vigilancia')
        .select('*')
        .order('created_at', { ascending: false });
      if (planesError) throw planesError;

      const ids = (planesData || []).map((p) => p.id);
      let acciones: AccionPlanVigilancia[] = [];
      if (ids.length > 0) {
        const { data: accData } = await supabase
          .from('planes_vigilancia_acciones')
          .select('id, plan_id, maquinista_id, tipo_accion, tipo_accion_libre, fecha_prevista, fecha_real, estado, resultado, observaciones')
          .in('plan_id', ids);
        acciones = (accData as AccionPlanVigilancia[]) || [];
      }

      const enriched: PlanVigilanciaConProgreso[] = ((planesData as PlanVigilancia[]) || []).map((p) => {
        const propias = acciones.filter((a) => a.plan_id === p.id);
        const realizadas = propias.filter((a) => a.estado === 'realizada').length;
        return {
          ...p,
          totalAcciones: propias.length,
          accionesRealizadas: realizadas,
          progreso: propias.length ? Math.round((realizadas / propias.length) * 100) : 0,
          tipos: Array.from(new Set(propias.map((a) => a.tipo_accion))),
          maquinistas: new Set(propias.map((a) => a.maquinista_id)).size,
        };
      });

      setPlanes(enriched);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando planes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanes();
  }, [fetchPlanes]);

  return { planes, loading, error, refetch: fetchPlanes };
}
