import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CriteriosPlanAnual {
  anio: number;
  registro_km_minimo: number;
  acompanamientos_por_red: number;
  acompanamientos_con_1201: number;
  alcohol_anual: number;
  drogas_cobertura_pct: number;
  vigencia_1201_anios: number;
  notas: string | null;
}

/** Fallback usado cuando no hay fila para ese año en BBDD. */
export const CRITERIOS_DEFAULT: Omit<CriteriosPlanAnual, 'anio' | 'notas'> = {
  registro_km_minimo: 100,
  acompanamientos_por_red: 1,
  acompanamientos_con_1201: 2,
  alcohol_anual: 1,
  drogas_cobertura_pct: 25,
  vigencia_1201_anios: 3,
};

/** Devuelve los criterios vigentes para el año dado. Si no existe fila, devuelve defaults. */
export function useCriteriosPlanAnual(anio: number) {
  const [criterios, setCriterios] = useState<CriteriosPlanAnual>({
    anio,
    ...CRITERIOS_DEFAULT,
    notas: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCriterios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('criterios_plan_anual')
        .select('*')
        .eq('anio', anio)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setCriterios(data as CriteriosPlanAnual);
      } else {
        setCriterios({ anio, ...CRITERIOS_DEFAULT, notas: null });
      }
    } catch (e: any) {
      console.error('Error cargando criterios plan anual:', e);
      setError(e?.message || 'Error cargando criterios');
      setCriterios({ anio, ...CRITERIOS_DEFAULT, notas: null });
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    fetchCriterios();
  }, [fetchCriterios]);

  return { criterios, loading, error, refetch: fetchCriterios };
}

/** Carga en un solo batch los criterios de varios años (para dashboard multi-year, si se usa). */
export async function fetchCriteriosPorAnio(anio: number): Promise<CriteriosPlanAnual> {
  const { data } = await supabase
    .from('criterios_plan_anual')
    .select('*')
    .eq('anio', anio)
    .maybeSingle();
  if (data) return data as CriteriosPlanAnual;
  return { anio, ...CRITERIOS_DEFAULT, notas: null };
}
