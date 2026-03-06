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
  pe1603PorcentajeCumplimiento: number;
  
  // PE 12.01
  pe1201ExpedientesActivos: number;
  pe1201AccionesVencidas: number;
  pe1201AccionesPendientes: number;
  pe1201PorcentajeCumplimiento: number;
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
  pe1201ExpedientesActivos: 0,
  pe1201AccionesVencidas: 0,
  pe1201AccionesPendientes: 0,
  pe1201PorcentajeCumplimiento: 0,
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

                // Porcentaje cumplimiento: excluir justificadas por traslado
                const bloquesComputables = planItems.filter(p => !p.justificado_traslado);
                const realizadas = bloquesComputables.filter(p => p.actuacion_id).length;
                if (bloquesComputables.length > 0) {
                  newStats.pe1603PorcentajeCumplimiento = Math.round((realizadas / bloquesComputables.length) * 100);
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

                // Porcentaje cumplimiento: acciones registradas / bloques que proceden
                const bloquesQueProceden = planItems1201.filter(p => p.estado !== 'no_procede').length;
                const accionesRegistradas = planItems1201.filter(p => p.actuacion_id && p.estado !== 'no_procede').length;
                if (bloquesQueProceden > 0) {
                  newStats.pe1201PorcentajeCumplimiento = Math.round((accionesRegistradas / bloquesQueProceden) * 100);
                }
              }
            }
          }
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
