import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMonths, differenceInDays } from 'date-fns';

interface DashboardStats {
  // Maquinistas
  maquinistasActivos: number;
  totalMaquinistas: number;
  
  // Certificaciones
  certificacionesVencidas: number;
  certificacionesProximas: number; // próximas a vencer (3 meses)
  certificacionesVigentes: number;
  totalCertificacionesVigiladas: number;
  porcentajeVigentes: number;
  
  // PE 16.03
  pe1603ExpedientesActivos: number;
  pe1603AccionesVencidas: number;
  pe1603AccionesPendientes: number;
  pe1603PorcentajeCumplimiento: number; // total: realizadas / total bloques
  pe1603PorcentajeCumplimientoHoy: number; // a fecha: realizadas / bloques con fin_ventana <= hoy
  pe1603BloquesExigiblesHoy: number;
  pe1603BloquesRealizadosHoy: number;
  
  // PE 12.01
  pe1201ExpedientesActivos: number;
  pe1201AccionesVencidas: number;
  pe1201AccionesPendientes: number;
  pe1201PorcentajeCumplimiento: number; // total: realizadas / bloques que proceden
  pe1201PorcentajeCumplimientoHoy: number; // a fecha: realizadas / bloques con fecha_objetivo <= hoy
  pe1201BloquesExigiblesHoy: number;
  pe1201BloquesRealizadosHoy: number;
  
  // Plan de Acción Anual
  planAnualMaquinistasCumplen: number;
  planAnualTotalEvaluados: number;
  planAnualPorcentaje: number;
  planAnualCoberturaDrogas: number;
}

const initialStats: DashboardStats = {
  maquinistasActivos: 0,
  totalMaquinistas: 0,
  certificacionesVencidas: 0,
  certificacionesProximas: 0,
  certificacionesVigentes: 0,
  totalCertificacionesVigiladas: 0,
  porcentajeVigentes: 0,
  pe1603ExpedientesActivos: 0,
  pe1603AccionesVencidas: 0,
  pe1603AccionesPendientes: 0,
  pe1603PorcentajeCumplimiento: 0,
  pe1603PorcentajeCumplimientoHoy: 0,
  pe1603BloquesExigiblesHoy: 0,
  pe1603BloquesRealizadosHoy: 0,
  pe1201ExpedientesActivos: 0,
  pe1201AccionesVencidas: 0,
  pe1201AccionesPendientes: 0,
  pe1201PorcentajeCumplimiento: 0,
  pe1201PorcentajeCumplimientoHoy: 0,
  pe1201BloquesExigiblesHoy: 0,
  pe1201BloquesRealizadosHoy: 0,
  planAnualMaquinistasCumplen: 0,
  planAnualTotalEvaluados: 0,
  planAnualPorcentaje: 0,
  planAnualCoberturaDrogas: 0,
};

export function useDashboardStats(baseFilter?: string) {
  const { user, isAdmin, assignedBases } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const newStats = { ...initialStats };
      const AVISO_MESES = 3; // 3 meses para "próxima a vencer"

      // 1. MAQUINISTAS
      let maquinistasQuery = supabase.from('maquinistas').select('id, activo, base');
      
      const { data: maquinistas } = await maquinistasQuery;
      
      if (maquinistas) {
        // Filtrar por base
        const maqsFiltrados = maquinistas.filter(m => {
          if (baseFilter && baseFilter !== 'all' && m.base !== baseFilter) return false;
          if (!isAdmin && !assignedBases.includes(m.base as typeof assignedBases[number])) return false;
          return true;
        });
        
        newStats.totalMaquinistas = maqsFiltrados.length;
        newStats.maquinistasActivos = maqsFiltrados.filter(m => m.activo).length;
        
        const maqIds = maqsFiltrados.map(m => m.id);

        // 2. CERTIFICACIONES
        if (maqIds.length > 0) {
          // Obtener las bases de los maquinistas filtrados para buscar sus configuraciones
          const basesDelFiltro = [...new Set(maqsFiltrados.map(m => m.base))];
          
          // Obtener IDs de las bases
          const { data: basesData } = await supabase
            .from('bases_conduccion')
            .select('id, nombre')
            .in('nombre', basesDelFiltro);
          
          const baseIdMap = new Map(basesData?.map(b => [b.nombre, b.id]) || []);
          const baseIds = basesData?.map(b => b.id) || [];

          const { data: maqCerts } = await supabase
            .from('maquinista_certificaciones')
            .select('id, maquinista_id, certificacion_id, fecha_ultimo_servicio, obtenida')
            .in('maquinista_id', maqIds);

          // Obtener configuraciones de base_certificaciones solo de las bases relevantes
          const { data: baseCerts } = await supabase
            .from('base_certificaciones')
            .select('base_id, certificacion_id, vigilar_vencimiento, periodo_inactividad_meses, aviso_dias')
            .in('base_id', baseIds);

          // Crear mapa base_id -> Map(certificacion_id -> config)
          const baseConfigMap = new Map<string, Map<string, typeof baseCerts[0]>>();
          for (const bc of baseCerts || []) {
            if (!baseConfigMap.has(bc.base_id)) {
              baseConfigMap.set(bc.base_id, new Map());
            }
            baseConfigMap.get(bc.base_id)!.set(bc.certificacion_id, bc);
          }

          // Crear mapa maquinista_id -> base
          const maqBaseMap = new Map(maqsFiltrados.map(m => [m.id, m.base]));

          if (maqCerts) {
            for (const mc of maqCerts) {
              // Obtener la base del maquinista
              const maqBase = maqBaseMap.get(mc.maquinista_id);
              if (!maqBase) continue;
              
              const maqBaseId = baseIdMap.get(maqBase);
              if (!maqBaseId) continue;
              
              // Buscar configuración de esta certificación en la base del maquinista
              const baseConfigs = baseConfigMap.get(maqBaseId);
              const config = baseConfigs?.get(mc.certificacion_id);
              
              if (!config?.vigilar_vencimiento || !mc.obtenida) continue;

              newStats.totalCertificacionesVigiladas++;

              if (!mc.fecha_ultimo_servicio) {
                newStats.certificacionesVencidas++;
              } else {
                const fechaVencimiento = addMonths(new Date(mc.fecha_ultimo_servicio), config.periodo_inactividad_meses || 12);
                const diasRestantes = differenceInDays(fechaVencimiento, new Date());
                const diasAviso = config.aviso_dias || 90;

                if (diasRestantes < 0) {
                  newStats.certificacionesVencidas++;
                } else if (diasRestantes <= diasAviso) {
                  newStats.certificacionesProximas++;
                } else {
                  newStats.certificacionesVigentes++;
                }
              }
            }
          }

          // Calcular porcentaje
          if (newStats.totalCertificacionesVigiladas > 0) {
            newStats.porcentajeVigentes = Math.round(
              (newStats.certificacionesVigentes / newStats.totalCertificacionesVigiladas) * 100
            );
          }

          // 3. PE 16.03
          const { data: expedientes1603 } = await supabase
            .from('expedientes_1603')
            .select('id, maquinista_id, estado, fecha_primer_servicio')
            .in('maquinista_id', maqIds);

          if (expedientes1603) {
            const expActivos = expedientes1603.filter(e => e.estado === 'abierto');
            newStats.pe1603ExpedientesActivos = expActivos.length;

            if (expActivos.length > 0) {
              const expIds = expActivos.map(e => e.id);
              
              const { data: planItems } = await supabase
                .from('plan_1603')
                .select('id, expediente_id, estado, actuacion_id, mes, tipo, inicio_ventana, fin_ventana, justificado_traslado')
                .in('expediente_id', expIds);

              if (planItems) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                for (const item of planItems) {
                  if (item.actuacion_id) continue; // ya realizada
                  if (item.justificado_traslado) continue; // justificada por traslado
                  
                  if (item.inicio_ventana && item.fin_ventana) {
                    const inicioVentana = new Date(item.inicio_ventana);
                    const finVentana = new Date(item.fin_ventana);
                    inicioVentana.setHours(0, 0, 0, 0);
                    finVentana.setHours(23, 59, 59, 999);
                    
                    if (today > finVentana) {
                      newStats.pe1603AccionesVencidas++;
                    } else if (today >= inicioVentana && today <= finVentana) {
                      newStats.pe1603AccionesPendientes++;
                    }
                  }
                }

                // Porcentaje cumplimiento TOTAL: realizadas / total bloques computables (excl. justificadas por traslado)
                const bloquesComputables = planItems.filter(p => !p.justificado_traslado);
                const realizadas = bloquesComputables.filter(p => p.actuacion_id).length;
                if (bloquesComputables.length > 0) {
                  newStats.pe1603PorcentajeCumplimiento = Math.round((realizadas / bloquesComputables.length) * 100);
                }

                // Porcentaje cumplimiento A DÍA DE HOY: realizadas / bloques cuya ventana ya cerró (fin_ventana <= hoy)
                // Las realizadas siempre cuentan aunque su ventana sea futura.
                const bloquesExigiblesHoy = bloquesComputables.filter(p => {
                  if (p.actuacion_id) return true; // realizada antes de tiempo
                  if (!p.fin_ventana) return false;
                  const fin = new Date(p.fin_ventana);
                  fin.setHours(23, 59, 59, 999);
                  return fin <= today;
                });
                const realizadasHoy = bloquesExigiblesHoy.filter(p => p.actuacion_id).length;
                newStats.pe1603BloquesExigiblesHoy = bloquesExigiblesHoy.length;
                newStats.pe1603BloquesRealizadosHoy = realizadasHoy;
                if (bloquesExigiblesHoy.length > 0) {
                  newStats.pe1603PorcentajeCumplimientoHoy = Math.round((realizadasHoy / bloquesExigiblesHoy.length) * 100);
                }
              }
            }
          }

          // 4. PE 12.01 - Usar tabla correcta expedientes_1201
          const { data: expedientes1201 } = await supabase
            .from('expedientes_1201')
            .select('id, maquinista_id, estado, fecha_primer_servicio')
            .in('maquinista_id', maqIds);

          if (expedientes1201) {
            const exp1201Activos = expedientes1201.filter(e => e.estado === 'abierto');
            newStats.pe1201ExpedientesActivos = exp1201Activos.length;

            if (exp1201Activos.length > 0) {
              const expIds1201 = exp1201Activos.map(e => e.id);
              
              const { data: planItems1201 } = await supabase
                .from('plan_1201')
                .select('id, expediente_id, estado, actuacion_id, dia_desde_origen, fecha_objetivo, obligatorio')
                .in('expediente_id', expIds1201);

              if (planItems1201) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                for (const item of planItems1201) {
                  if (item.actuacion_id || item.estado === 'no_procede') continue;
                  
                  // PE 12.01 NO tiene ventana - solo fecha exacta
                  if (item.fecha_objetivo) {
                    const fechaObjetivo = new Date(item.fecha_objetivo);
                    fechaObjetivo.setHours(0, 0, 0, 0);
                    
                    if (today > fechaObjetivo) {
                      newStats.pe1201AccionesVencidas++;
                    } else {
                      newStats.pe1201AccionesPendientes++;
                    }
                  }
                }

                // Porcentaje cumplimiento TOTAL: acciones registradas / bloques que proceden
                const bloquesProceden = planItems1201.filter(p => p.estado !== 'no_procede');
                const accionesRegistradas = bloquesProceden.filter(p => p.actuacion_id).length;
                if (bloquesProceden.length > 0) {
                  newStats.pe1201PorcentajeCumplimiento = Math.round((accionesRegistradas / bloquesProceden.length) * 100);
                }

                // Porcentaje cumplimiento A DÍA DE HOY: realizadas / bloques exigibles (fecha_objetivo <= hoy o ya realizados)
                const exigiblesHoy = bloquesProceden.filter(p => {
                  if (p.actuacion_id) return true;
                  if (!p.fecha_objetivo) return false;
                  const fo = new Date(p.fecha_objetivo);
                  fo.setHours(23, 59, 59, 999);
                  return fo <= today;
                });
                const realizadasHoy1201 = exigiblesHoy.filter(p => p.actuacion_id).length;
                newStats.pe1201BloquesExigiblesHoy = exigiblesHoy.length;
                newStats.pe1201BloquesRealizadosHoy = realizadasHoy1201;
                if (exigiblesHoy.length > 0) {
                  newStats.pe1201PorcentajeCumplimientoHoy = Math.round((realizadasHoy1201 / exigiblesHoy.length) * 100);
                }
              }
            }
          }
          // 5. PLAN DE ACCIÓN ANUAL
          const currentYear = new Date().getFullYear();
          const yearStart = `${currentYear}-01-01`;
          const yearEnd = `${currentYear}-12-31`;

          // Get base redes config for each base
          const { data: basesConduccion } = await supabase
            .from('bases_conduccion')
            .select('nombre, redes')
            .in('nombre', [...new Set(maqsFiltrados.map(m => m.base))]);

          const baseRedesMap = new Map<string, string[]>();
          for (const b of basesConduccion || []) {
            const r = b.redes === 'ambas' ? ['convencional', 'av'] : b.redes === 'av' ? ['av'] : ['convencional'];
            baseRedesMap.set(b.nombre, r);
          }

          // Fetch all plan_anual actuaciones for filtered maquinistas in current year
          const { data: allPlanAnual } = await supabase
            .from('actuaciones_plan_anual')
            .select('maquinista_id, tipo, red, km_recorridos')
            .in('maquinista_id', maqIds)
            .eq('anio', currentYear);

          // Fetch all 1603 actuaciones in current year for filtered maquinistas
          const { data: allExp1603ForPlan } = await supabase
            .from('expedientes_1603')
            .select('id, maquinista_id')
            .in('maquinista_id', maqIds);

          let all1603ActsForPlan: { expediente_id: string; tipo: string; km_recorridos: number | null }[] = [];
          if (allExp1603ForPlan && allExp1603ForPlan.length > 0) {
            const expIds1603Plan = allExp1603ForPlan.map(e => e.id);
            const { data: acts1603Plan } = await supabase
              .from('actuaciones_1603')
              .select('expediente_id, tipo, km_recorridos')
              .in('expediente_id', expIds1603Plan)
              .gte('fecha_real', yearStart)
              .lte('fecha_real', yearEnd);
            all1603ActsForPlan = acts1603Plan || [];
          }

          // Map expediente_id -> maquinista_id
          const expToMaqMap = new Map<string, string>();
          (allExp1603ForPlan || []).forEach(e => expToMaqMap.set(e.id, e.maquinista_id));

          // Check PE 12.01 in last 3 years per maquinista
          const threeYearsAgo = `${currentYear - 3}-01-01`;
          const { data: recientes1201 } = await supabase
            .from('expedientes_1201')
            .select('maquinista_id')
            .in('maquinista_id', maqIds)
            .gte('fecha_primer_servicio', threeYearsAgo);
          const maqsCon1201Reciente = new Set((recientes1201 || []).map(e => e.maquinista_id));

          // Drug coverage per base
          const maqsConDrogas = new Set<string>();
          (allPlanAnual || []).filter(a => a.tipo === 'drogas').forEach(a => maqsConDrogas.add(a.maquinista_id));
          all1603ActsForPlan.filter(a => a.tipo === 'drogas').forEach(a => {
            const maqId = expToMaqMap.get(a.expediente_id);
            if (maqId) maqsConDrogas.add(maqId);
          });

          const totalActivosBase = maqsFiltrados.filter(m => m.activo).length;
          const coberturaDrogas = totalActivosBase > 0 ? Math.round((maqsConDrogas.size / totalActivosBase) * 100) : 0;
          newStats.planAnualCoberturaDrogas = coberturaDrogas;

          // Evaluate per maquinista
          let totalEvaluados = 0;
          let maquinistasCumplen = 0;

          for (const maq of maqsFiltrados.filter(m => m.activo)) {
            const maqRedes = baseRedesMap.get(maq.base) || ['convencional'];
            const acompRequeridos = maqsCon1201Reciente.has(maq.id) ? 2 : 1;

            // Gather actuaciones for this maquinista
            const planActs = (allPlanAnual || []).filter(a => a.maquinista_id === maq.id);
            const pe1603Acts = all1603ActsForPlan
              .filter(a => expToMaqMap.get(a.expediente_id) === maq.id)
              .map(a => ({ ...a, red: null as string | null, source: 'pe1603' }));

            const allActs = [
              ...planActs.map(a => ({ tipo: a.tipo, red: a.red, km_recorridos: a.km_recorridos ? Number(a.km_recorridos) : null, source: 'plan_anual' })),
              ...pe1603Acts.map(a => ({ tipo: a.tipo, red: a.red, km_recorridos: a.km_recorridos ? Number(a.km_recorridos) : null, source: a.source })),
            ];

            let cumpleTodo = true;
            totalEvaluados++;

            for (const red of maqRedes) {
              // Registro: 100km cumulative
              const registros = allActs.filter(a => a.tipo === 'registro' && (a.red === red || (a.source === 'pe1603' && a.red === null)));
              const kmTotal = registros.reduce((sum, a) => sum + (a.km_recorridos ?? 0), 0);
              if (kmTotal < 100) cumpleTodo = false;

              // Acompañamiento
              const acomps = allActs.filter(a => a.tipo === 'acompanamiento' && (a.red === red || (a.source === 'pe1603' && a.red === null)));
              if (acomps.length < acompRequeridos) cumpleTodo = false;
            }

            // Alcohol
            const alcohols = allActs.filter(a => a.tipo === 'alcohol');
            if (alcohols.length < 1) cumpleTodo = false;

            if (cumpleTodo) maquinistasCumplen++;
          }

          newStats.planAnualTotalEvaluados = totalEvaluados;
          newStats.planAnualMaquinistasCumplen = maquinistasCumplen;
          newStats.planAnualPorcentaje = totalEvaluados > 0 ? Math.round((maquinistasCumplen / totalEvaluados) * 100) : 0;
        }
      }

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, assignedBases, baseFilter]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    refetch: fetchStats,
  };
}
