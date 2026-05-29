import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type TipoActuacionPlanAnual = 'registro' | 'acompanamiento' | 'alcohol' | 'drogas';
export type RedType = 'convencional' | 'av';

export interface ActuacionPlanAnual {
  id: string;
  maquinista_id: string;
  anio: number;
  tipo: TipoActuacionPlanAnual;
  red: RedType | null;
  fecha_real: string;
  km_recorridos: number | null;
  indice_prever: number | null;
  resultado: string | null;
  observaciones: string | null;
  registrado_por: string | null;
  created_at: string | null;
  source: 'plan_anual' | 'pe1603';
}

export interface CriterioEstado {
  criterio: string;
  tipo: TipoActuacionPlanAnual;
  red: RedType | null;
  requerido: number;
  cumplido: number;
  cumple: boolean;
  actuaciones: ActuacionPlanAnual[];
}

export interface PlanAnualData {
  anio: number;
  redes: RedType[];
  criterios: CriterioEstado[];
  coberturaDrogas: {
    totalActivos: number;
    conControl: number;
    porcentaje: number;
    cumple: boolean;
  };
  tuvo1201Reciente: boolean;
  loading: boolean;
  error: string | null;
  actuaciones: ActuacionPlanAnual[];
  refetch: () => void;
}

export function usePlanAnual(maquinistaId: string, baseName: string, anio?: number): PlanAnualData {
  const currentYear = anio || new Date().getFullYear();
  const [redes, setRedes] = useState<RedType[]>(['convencional']);
  const [actuacionesPlanAnual, setActuacionesPlanAnual] = useState<ActuacionPlanAnual[]>([]);
  const [actuaciones1603, setActuaciones1603] = useState<ActuacionPlanAnual[]>([]);
  const [tuvo1201Reciente, setTuvo1201Reciente] = useState(false);
  const [coberturaDrogas, setCoberturaDrogas] = useState({ totalActivos: 0, conControl: 0, porcentaje: 0, cumple: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get base redes
      const { data: baseData } = await supabase
        .from('bases_conduccion')
        .select('redes')
        .eq('nombre', baseName)
        .maybeSingle();

      const baseRedes: RedType[] = baseData?.redes === 'ambas'
        ? ['convencional', 'av']
        : baseData?.redes === 'av'
          ? ['av']
          : ['convencional'];
      setRedes(baseRedes);

      // 2. Get actuaciones_plan_anual for this maquinista and year
      const { data: planData } = await supabase
        .from('actuaciones_plan_anual')
        .select('*')
        .eq('maquinista_id', maquinistaId)
        .eq('anio', currentYear)
        .order('fecha_real', { ascending: true });

      const planActuaciones: ActuacionPlanAnual[] = (planData || []).map(a => ({
        ...a,
        tipo: a.tipo as TipoActuacionPlanAnual,
        red: a.red as RedType | null,
        source: 'plan_anual' as const,
      }));
      setActuacionesPlanAnual(planActuaciones);

      // 3. Get PE 16.03 actuaciones for this maquinista in current year
      const yearStart = `${currentYear}-01-01`;
      const yearEnd = `${currentYear}-12-31`;

      const { data: expData } = await supabase
        .from('expedientes_1603')
        .select('id')
        .eq('maquinista_id', maquinistaId)
        .limit(10);

      let pe1603Acts: ActuacionPlanAnual[] = [];
      if (expData && expData.length > 0) {
        const expIds = expData.map(e => e.id);
        const { data: actsData } = await supabase
          .from('actuaciones_1603')
          .select('*')
          .in('expediente_id', expIds)
          .gte('fecha_real', yearStart)
          .lte('fecha_real', yearEnd)
          .order('fecha_real', { ascending: true });

        pe1603Acts = (actsData || []).map(a => ({
          id: a.id,
          maquinista_id: maquinistaId,
          anio: currentYear,
          tipo: a.tipo as TipoActuacionPlanAnual,
          red: null, // PE 16.03 doesn't track per-network
          fecha_real: a.fecha_real || '',
          km_recorridos: a.km_recorridos ? Number(a.km_recorridos) : null,
          indice_prever: a.indice_prever ? Number(a.indice_prever) : null,
          resultado: a.resultado,
          observaciones: a.observaciones,
          registrado_por: a.registrado_por,
          created_at: a.created_at,
          source: 'pe1603' as const,
        }));
      }
      setActuaciones1603(pe1603Acts);

      // 4. Check if maquinista had PE 12.01 in last 3 years
      const threeYearsAgo = `${currentYear - 3}-01-01`;
      const { data: exp1201, error: err1201 } = await supabase
        .from('expedientes_1201')
        .select('id')
        .eq('maquinista_id', maquinistaId)
        .gte('fecha_primer_servicio', threeYearsAgo)
        .limit(1);

      setTuvo1201Reciente(!err1201 && (exp1201?.length || 0) > 0);

      // 5. Drug coverage for the base
      const { data: maqsActivos } = await supabase
        .from('maquinistas')
        .select('id')
        .eq('base', baseName)
        .eq('activo', true);

      const totalActivos = maqsActivos?.length || 0;

      // Count maquinistas with drug control this year (from plan_anual + 1603)
      let maqsConDrogas = new Set<string>();

      if (totalActivos > 0) {
        const maqIds = maqsActivos!.map(m => m.id);

        // From plan_anual
        const { data: drogasPlan } = await supabase
          .from('actuaciones_plan_anual')
          .select('maquinista_id')
          .in('maquinista_id', maqIds)
          .eq('anio', currentYear)
          .eq('tipo', 'drogas');

        (drogasPlan || []).forEach(d => maqsConDrogas.add(d.maquinista_id));

        // From PE 16.03
        const { data: exps1603 } = await supabase
          .from('expedientes_1603')
          .select('id, maquinista_id')
          .in('maquinista_id', maqIds);

        if (exps1603 && exps1603.length > 0) {
          const expMap = new Map<string, string>();
          exps1603.forEach(e => expMap.set(e.id, e.maquinista_id));

          const { data: drogas1603 } = await supabase
            .from('actuaciones_1603')
            .select('expediente_id')
            .in('expediente_id', exps1603.map(e => e.id))
            .eq('tipo', 'drogas')
            .gte('fecha_real', yearStart)
            .lte('fecha_real', yearEnd);

          (drogas1603 || []).forEach(d => {
            const maqId = expMap.get(d.expediente_id);
            if (maqId) maqsConDrogas.add(maqId);
          });
        }
      }

      const conControl = maqsConDrogas.size;
      const porcentaje = totalActivos > 0 ? Math.round((conControl / totalActivos) * 100) : 0;
      setCoberturaDrogas({
        totalActivos,
        conControl,
        porcentaje,
        cumple: porcentaje >= 25,
      });

    } catch (err) {
      console.error('Error fetching plan anual:', err);
      setError('Error al cargar el Plan de Acción Anual');
    } finally {
      setLoading(false);
    }
  }, [maquinistaId, baseName, currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merge all actuaciones
  const allActuaciones = useMemo(() => {
    return [...actuacionesPlanAnual, ...actuaciones1603];
  }, [actuacionesPlanAnual, actuaciones1603]);

  // Compute criteria
  const criterios = useMemo((): CriterioEstado[] => {
    const result: CriterioEstado[] = [];
    const acompRequeridos = tuvo1201Reciente ? 2 : 1;

    // Per-network criteria
    for (const red of redes) {
      const redLabel = red === 'av' ? 'AV' : 'Convencional';

      // Registro per network — 100km is cumulative across all registros in the year
      const registrosRed = allActuaciones.filter(
        a => a.tipo === 'registro' && (a.red === red || (a.source === 'pe1603' && a.red === null))
      );
      const kmTotalRed = registrosRed.reduce((sum, a) => sum + (a.km_recorridos ?? 0), 0);
      result.push({
        criterio: `Registro ${redLabel} (≥100 km acumulados)`,
        tipo: 'registro',
        red,
        requerido: 100,
        cumplido: kmTotalRed,
        cumple: kmTotalRed >= 100,
        actuaciones: registrosRed,
      });

      // Acompañamiento per network
      const acompsRed = allActuaciones.filter(
        a => a.tipo === 'acompanamiento' && (a.red === red || (a.source === 'pe1603' && a.red === null))
      );
      result.push({
        criterio: `Acompañamiento ${redLabel}${tuvo1201Reciente ? ' (PE 12.01 reciente)' : ''}`,
        tipo: 'acompanamiento',
        red,
        requerido: acompRequeridos,
        cumplido: acompsRed.length,
        cumple: acompsRed.length >= acompRequeridos,
        actuaciones: acompsRed,
      });
    }

    // Alcohol - annual
    const alcohols = allActuaciones.filter(a => a.tipo === 'alcohol');
    result.push({
      criterio: 'Control de Alcohol',
      tipo: 'alcohol',
      red: null,
      requerido: 1,
      cumplido: alcohols.length,
      cumple: alcohols.length >= 1,
      actuaciones: alcohols,
    });

    // Drogas: NO se aplica criterio individual SGS (objetivo es ≥25% de la base).
    // Se evalúa únicamente a nivel base en la tarjeta de Cobertura de Drogas.


    return result;
  }, [allActuaciones, redes, tuvo1201Reciente]);

  return {
    anio: currentYear,
    redes,
    criterios,
    coberturaDrogas,
    tuvo1201Reciente,
    loading,
    error,
    actuaciones: allActuaciones,
    refetch: fetchData,
  };
}
