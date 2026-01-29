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
          const { data: maqCerts } = await supabase
            .from('maquinista_certificaciones')
            .select('id, maquinista_id, certificacion_id, fecha_ultimo_servicio, obtenida')
            .in('maquinista_id', maqIds);

          const { data: baseCerts } = await supabase
            .from('base_certificaciones')
            .select('certificacion_id, vigilar_vencimiento, periodo_inactividad_meses, aviso_dias');

          const configMap = new Map(baseCerts?.map(bc => [bc.certificacion_id, bc]) || []);

          if (maqCerts) {
            for (const mc of maqCerts) {
              const config = configMap.get(mc.certificacion_id);
              if (!config?.vigilar_vencimiento || !mc.obtenida) continue;

              newStats.totalCertificacionesVigiladas++;

              if (!mc.fecha_ultimo_servicio) {
                newStats.certificacionesVencidas++;
              } else {
                const fechaVencimiento = addMonths(new Date(mc.fecha_ultimo_servicio), config.periodo_inactividad_meses);
                const diasRestantes = differenceInDays(fechaVencimiento, new Date());

                if (diasRestantes < 0) {
                  newStats.certificacionesVencidas++;
                } else if (diasRestantes <= 90) { // 3 meses ≈ 90 días
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
                .select('id, expediente_id, estado, actuacion_id, mes, tipo')
                .in('expediente_id', expIds);

              const { data: actuaciones } = await supabase
                .from('actuaciones_1603')
                .select('id, expediente_id, fecha_real')
                .in('expediente_id', expIds);

              if (planItems) {
                // Acciones pendientes = sin actuacion_id
                newStats.pe1603AccionesPendientes = planItems.filter(p => !p.actuacion_id).length;
                
                // Acciones vencidas = pendientes fuera de ventana
                const today = new Date();
                for (const item of planItems) {
                  if (item.actuacion_id) continue; // ya realizada
                  
                  const exp = expActivos.find(e => e.id === item.expediente_id);
                  if (!exp?.fecha_primer_servicio) continue;
                  
                  const inicio = new Date(exp.fecha_primer_servicio);
                  const finVentana = addMonths(inicio, item.mes);
                  
                  if (today > finVentana) {
                    newStats.pe1603AccionesVencidas++;
                  }
                }

                // Porcentaje cumplimiento
                const totalPlan = planItems.length;
                const realizadas = planItems.filter(p => p.actuacion_id).length;
                if (totalPlan > 0) {
                  newStats.pe1603PorcentajeCumplimiento = Math.round((realizadas / totalPlan) * 100);
                }
              }
            }
          }

          // 4. PE 12.01 - Por ahora solo expedientes activos (la tabla real no existe aún)
          // Usamos expedientes_1603 con tipo diferente si existe, o mostramos 0
          const { data: expedientes1201 } = await supabase
            .from('expedientes_1603')
            .select('id, maquinista_id, estado, tipo')
            .in('maquinista_id', maqIds)
            .eq('tipo', 'pe1201');

          if (expedientes1201) {
            const exp1201Activos = expedientes1201.filter(e => e.estado === 'abierto');
            newStats.pe1201ExpedientesActivos = exp1201Activos.length;
            
            // TODO: Cuando exista la tabla de actuaciones 12.01, calcular vencidas/pendientes
            newStats.pe1201AccionesVencidas = 0;
            newStats.pe1201AccionesPendientes = 0;
            newStats.pe1201PorcentajeCumplimiento = exp1201Activos.length > 0 ? 0 : 100;
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
