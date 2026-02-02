import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMonths, differenceInDays, endOfYear, addDays } from 'date-fns';

export type GrupoAlerta = 'vencidas' | 'proximas_3_meses' | 'resto_anio';

export interface AlertaCertificacion {
  tipo: 'certificacion';
  id: string;
  maquinista_id: string;
  maquinista_nombre: string;
  maquinista_base: string;
  certificacion_nombre: string;
  certificacion_tipo: 'vehiculo' | 'linea';
  estado: 'Próxima a vencer' | 'Vencida';
  dias_restantes: number | null;
  fecha_vencimiento: Date | null;
  grupo: GrupoAlerta;
}

export interface Alerta1603 {
  tipo: 'pe1603';
  id: string;
  bloque_id: string;
  maquinista_id: string;
  maquinista_nombre: string;
  maquinista_base: string;
  etiqueta: string;
  tipo_actuacion: string;
  estado: 'En ventana' | 'Vencida';
  dias_restantes: number;
  fin_ventana: Date;
  grupo: GrupoAlerta;
}

export interface Alerta1201 {
  tipo: 'pe1201';
  id: string;
  maquinista_id: string;
  maquinista_nombre: string;
  maquinista_base: string;
  hito: string;
  estado: 'Pendiente' | 'Vencida';
  dias_restantes: number;
  fecha_objetivo: Date;
  grupo: GrupoAlerta;
}

export type Alerta = AlertaCertificacion | Alerta1603 | Alerta1201;

// Función para determinar el grupo de una alerta basándose en su fecha límite
function calcularGrupoAlerta(fechaLimite: Date | null, hoy: Date): GrupoAlerta | null {
  if (!fechaLimite) return 'vencidas'; // Sin fecha = vencida
  
  const finAnio = endOfYear(hoy);
  const limiteTresMeses = addDays(hoy, 90); // ~3 meses desde hoy
  
  // Si la fecha límite ya pasó = vencida
  if (fechaLimite < hoy) {
    return 'vencidas';
  }
  
  // Si la fecha límite está dentro de los próximos 3 meses
  if (fechaLimite <= limiteTresMeses) {
    return 'proximas_3_meses';
  }
  
  // Si la fecha límite está antes del fin de año
  if (fechaLimite <= finAnio) {
    return 'resto_anio';
  }
  
  // Después de fin de año = no mostrar
  return null;
}

export function useDashboardAlertas(baseFilter?: string) {
  const { user, isAdmin, assignedBases } = useAuth();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlertas = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const allAlertas: Alerta[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. CERTIFICACIONES: Obtener maquinista_certificaciones con fecha_ultimo_servicio
      const { data: maqCerts, error: certError } = await supabase
        .from('maquinista_certificaciones')
        .select('id, maquinista_id, certificacion_id, certificacion_nombre, certificacion_tipo, fecha_ultimo_servicio, obtenida');

      if (!certError && maqCerts) {
        // Obtener base_certificaciones para config de vigilancia
        const { data: baseCerts } = await supabase
          .from('base_certificaciones')
          .select('certificacion_id, vigilar_vencimiento, periodo_inactividad_meses, aviso_dias');

        const configMap = new Map(baseCerts?.map(bc => [bc.certificacion_id, bc]) || []);

        // Obtener maquinistas
        const maqIds = [...new Set(maqCerts.map(mc => mc.maquinista_id))];
        if (maqIds.length > 0) {
          const { data: maquinistas } = await supabase
            .from('maquinistas')
            .select('id, nombre, apellidos, base, activo')
            .in('id', maqIds)
            .eq('activo', true);

          const maqMap = new Map(maquinistas?.map(m => [m.id, m]) || []);

          for (const mc of maqCerts) {
            // Solo certificaciones obtenidas con vigilancia activa
            if (!mc.obtenida) continue;
            
            const config = configMap.get(mc.certificacion_id);
            if (!config?.vigilar_vencimiento) continue;

            const maq = maqMap.get(mc.maquinista_id);
            if (!maq) continue;

            // Filtrar por base
            if (!isAdmin && !assignedBases.includes(maq.base as typeof assignedBases[number])) continue;
            if (baseFilter && baseFilter !== 'all' && maq.base !== baseFilter) continue;

            let fechaVencimiento: Date | null = null;
            let diasRestantes: number | null = null;

            if (!mc.fecha_ultimo_servicio) {
              // Sin registro = vencida
              fechaVencimiento = null;
            } else {
              fechaVencimiento = addMonths(new Date(mc.fecha_ultimo_servicio), config.periodo_inactividad_meses || 12);
              diasRestantes = differenceInDays(fechaVencimiento, today);
            }

            const grupo = calcularGrupoAlerta(fechaVencimiento, today);
            
            // Solo agregar si tiene grupo válido (hasta fin de año)
            if (grupo) {
              const estado: 'Próxima a vencer' | 'Vencida' = 
                grupo === 'vencidas' ? 'Vencida' : 'Próxima a vencer';
              
              allAlertas.push({
                tipo: 'certificacion',
                id: mc.id,
                maquinista_id: mc.maquinista_id,
                maquinista_nombre: `${maq.nombre} ${maq.apellidos}`,
                maquinista_base: maq.base,
                certificacion_nombre: mc.certificacion_nombre,
                certificacion_tipo: mc.certificacion_tipo as 'vehiculo' | 'linea',
                estado,
                dias_restantes: diasRestantes,
                fecha_vencimiento: fechaVencimiento,
                grupo,
              });
            }
          }
        }
      }

      // 2. PE 16.03: Usar fin_ventana como fecha límite
      const { data: expedientes1603, error: expError } = await supabase
        .from('expedientes_1603')
        .select('id, maquinista_id, fecha_primer_servicio, estado')
        .eq('estado', 'abierto');

      if (!expError && expedientes1603 && expedientes1603.length > 0) {
        const maqIds1603 = [...new Set(expedientes1603.map(e => e.maquinista_id))];
        const { data: maquinistas1603 } = await supabase
          .from('maquinistas')
          .select('id, nombre, apellidos, base')
          .in('id', maqIds1603);

        const maqMap1603 = new Map(maquinistas1603?.map(m => [m.id, m]) || []);

        // Get plan items without actuacion
        const expIds = expedientes1603.map(e => e.id);
        const { data: planItems } = await supabase
          .from('plan_1603')
          .select('id, expediente_id, tipo, etiqueta, mes, estado, actuacion_id, inicio_ventana, fin_ventana')
          .in('expediente_id', expIds)
          .is('actuacion_id', null)
          .neq('estado', 'no_procede');

        if (planItems) {
          for (const item of planItems) {
            const exp = expedientes1603.find(e => e.id === item.expediente_id);
            if (!exp) continue;

            const maq = maqMap1603.get(exp.maquinista_id);
            if (!maq) continue;

            // Filtrar por base
            if (!isAdmin && !assignedBases.includes(maq.base as typeof assignedBases[number])) continue;
            if (baseFilter && baseFilter !== 'all' && maq.base !== baseFilter) continue;

            // Usar fin_ventana como fecha límite
            if (item.fin_ventana) {
              const finVentana = new Date(item.fin_ventana);
              finVentana.setHours(0, 0, 0, 0);
              
              const grupo = calcularGrupoAlerta(finVentana, today);
              
              if (grupo) {
                const diasRestantes = differenceInDays(finVentana, today);
                const estado: 'En ventana' | 'Vencida' = grupo === 'vencidas' ? 'Vencida' : 'En ventana';
                
                allAlertas.push({
                  tipo: 'pe1603',
                  id: exp.id,
                  bloque_id: item.id,
                  maquinista_id: exp.maquinista_id,
                  maquinista_nombre: `${maq.nombre} ${maq.apellidos}`,
                  maquinista_base: maq.base,
                  etiqueta: item.etiqueta || `${item.tipo} - Mes ${item.mes}`,
                  tipo_actuacion: item.tipo,
                  estado,
                  dias_restantes: diasRestantes,
                  fin_ventana: finVentana,
                  grupo,
                });
              }
            }
          }
        }
      }

      // 3. PE 12.01: Usar fecha_objetivo como fecha límite
      const { data: expedientes1201, error: exp1201Error } = await supabase
        .from('expedientes_1201')
        .select('id, maquinista_id, fecha_primer_servicio, estado')
        .eq('estado', 'abierto');

      if (!exp1201Error && expedientes1201 && expedientes1201.length > 0) {
        const maqIds1201 = [...new Set(expedientes1201.map(e => e.maquinista_id))];
        const { data: maquinistas1201 } = await supabase
          .from('maquinistas')
          .select('id, nombre, apellidos, base')
          .in('id', maqIds1201);

        const maqMap1201 = new Map(maquinistas1201?.map(m => [m.id, m]) || []);

        const expIds1201 = expedientes1201.map(e => e.id);
        const { data: planItems1201 } = await supabase
          .from('plan_1201')
          .select('id, expediente_id, tipo, etiqueta, dia_desde_origen, fecha_objetivo, estado, actuacion_id, obligatorio')
          .in('expediente_id', expIds1201)
          .is('actuacion_id', null)
          .neq('estado', 'no_procede');

        if (planItems1201) {
          for (const item of planItems1201) {
            const exp = expedientes1201.find(e => e.id === item.expediente_id);
            if (!exp) continue;

            const maq = maqMap1201.get(exp.maquinista_id);
            if (!maq) continue;

            // Filtrar por base
            if (!isAdmin && !assignedBases.includes(maq.base as typeof assignedBases[number])) continue;
            if (baseFilter && baseFilter !== 'all' && maq.base !== baseFilter) continue;

            if (item.fecha_objetivo) {
              const fechaObjetivo = new Date(item.fecha_objetivo);
              fechaObjetivo.setHours(0, 0, 0, 0);
              
              const grupo = calcularGrupoAlerta(fechaObjetivo, today);
              
              if (grupo) {
                const diasRestantes = differenceInDays(fechaObjetivo, today);
                const estado: 'Pendiente' | 'Vencida' = grupo === 'vencidas' ? 'Vencida' : 'Pendiente';
                
                allAlertas.push({
                  tipo: 'pe1201',
                  id: exp.id,
                  maquinista_id: exp.maquinista_id,
                  maquinista_nombre: `${maq.nombre} ${maq.apellidos}`,
                  maquinista_base: maq.base,
                  hito: `${item.tipo === 'acompanamiento' ? 'Acomp.' : 'Reg.'} ${item.etiqueta}`,
                  estado,
                  dias_restantes: diasRestantes,
                  fecha_objetivo: fechaObjetivo,
                  grupo,
                });
              }
            }
          }
        }
      }

      // Ordenar: primero vencidas, luego próximas 3 meses, luego resto año
      // Dentro de cada grupo, ordenar por días restantes
      const ordenGrupo: Record<GrupoAlerta, number> = {
        'vencidas': 0,
        'proximas_3_meses': 1,
        'resto_anio': 2,
      };

      allAlertas.sort((a, b) => {
        const ordenA = ordenGrupo[a.grupo];
        const ordenB = ordenGrupo[b.grupo];
        if (ordenA !== ordenB) return ordenA - ordenB;
        
        const diasA = a.dias_restantes ?? -999;
        const diasB = b.dias_restantes ?? -999;
        return diasA - diasB;
      });

      setAlertas(allAlertas);
    } catch (error) {
      console.error('Error fetching alertas:', error);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, assignedBases, baseFilter]);

  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]);

  // Agrupar alertas por categoría
  const alertasVencidas = alertas.filter(a => a.grupo === 'vencidas');
  const alertasProximas3Meses = alertas.filter(a => a.grupo === 'proximas_3_meses');
  const alertasRestoAnio = alertas.filter(a => a.grupo === 'resto_anio');

  const kpis = {
    totalAlertas: alertas.length,
    vencidas: alertasVencidas.length,
    proximas3Meses: alertasProximas3Meses.length,
    restoAnio: alertasRestoAnio.length,
    certificaciones: alertas.filter(a => a.tipo === 'certificacion').length,
    pe1603: alertas.filter(a => a.tipo === 'pe1603').length,
    pe1201: alertas.filter(a => a.tipo === 'pe1201').length,
  };

  return {
    alertas,
    alertasVencidas,
    alertasProximas3Meses,
    alertasRestoAnio,
    loading,
    kpis,
    refetch: fetchAlertas,
  };
}
