import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMonths, differenceInDays, endOfYear, addDays, addYears } from 'date-fns';

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

export interface AlertaSegEspecial {
  tipo: 'seg_especial';
  id: string;
  accion_id: string;
  maquinista_id: string;
  maquinista_nombre: string;
  maquinista_base: string;
  hito: string;
  tipo_actuacion: 'acompanamiento' | 'registro' | 'formativa';
  estado: 'Pendiente' | 'Vencida';
  dias_restantes: number;
  fecha_objetivo: Date;
  grupo: GrupoAlerta;
}

export interface AlertaPlanEspecifico {
  tipo: 'plan_especifico';
  id: string;
  accion_id: string;
  plan_nombre: string;
  maquinista_id: string;
  maquinista_nombre: string;
  maquinista_base: string;
  accion: string;
  estado: 'Pendiente' | 'Vencida';
  dias_restantes: number;
  fecha_objetivo: Date;
  grupo: GrupoAlerta;
}

export interface AlertaLicencia {
  tipo: 'licencia';
  id: string;
  maquinista_id: string;
  maquinista_nombre: string;
  maquinista_base: string;
  estado: 'Próxima a caducar' | 'Caducada';
  dias_restantes: number;
  fecha_caducidad: Date;
  grupo: GrupoAlerta;
}

export type Alerta = AlertaCertificacion | Alerta1603 | Alerta1201 | AlertaSegEspecial | AlertaLicencia | AlertaPlanEspecifico;


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

      // 1. CERTIFICACIONES: Obtener TODAS las maquinista_certificaciones (paginado para superar el límite de 1000 de PostgREST)
      const maqCerts: any[] = [];
      let certError: any = null;
      {
        const PAGE = 1000;
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('maquinista_certificaciones')
            .select('id, maquinista_id, certificacion_id, certificacion_nombre, certificacion_tipo, fecha_ultimo_servicio, obtenida')
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) { certError = error; break; }
          if (!data || data.length === 0) break;
          maqCerts.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
      }


      if (!certError && maqCerts) {
        // Obtener base_certificaciones para config de vigilancia (clave: base_id + certificacion_id)
        const { data: baseCerts } = await supabase
          .from('base_certificaciones')
          .select('base_id, certificacion_id, vigilar_vencimiento, periodo_inactividad_meses, aviso_dias');

        // Mapa de nombre de base -> id para resolver la config correcta por base
        const { data: basesData } = await supabase
          .from('bases_conduccion')
          .select('id, nombre');
        const baseNombreToId = new Map<string, string>(
          (basesData || []).map((b: any) => [b.nombre, b.id])
        );

        const configMap = new Map(
          (baseCerts || []).map((bc: any) => [`${bc.base_id}|${bc.certificacion_id}`, bc])
        );

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

            const maq = maqMap.get(mc.maquinista_id);
            if (!maq) continue;

            const baseId = baseNombreToId.get(maq.base);
            const config = baseId ? configMap.get(`${baseId}|${mc.certificacion_id}`) : undefined;
            if (!config?.vigilar_vencimiento) continue;

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
          .select('id, expediente_id, tipo, etiqueta, mes, estado, actuacion_id, inicio_ventana, fin_ventana, justificado_traslado')
          .in('expediente_id', expIds)
          .is('actuacion_id', null)
          .neq('estado', 'no_procede')
          .or('justificado_traslado.is.null,justificado_traslado.eq.false');

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

      // 4. SEGUIMIENTO ESPECIAL
      const { data: segs } = await supabase
        .from('seguimientos_especiales')
        .select('id, maquinista_id, estado')
        .eq('estado', 'abierto');

      if (segs && segs.length > 0) {
        const maqIdsSeg = [...new Set(segs.map(s => s.maquinista_id))];
        const { data: maqsSeg } = await supabase
          .from('maquinistas')
          .select('id, nombre, apellidos, base')
          .in('id', maqIdsSeg);
        const maqMapSeg = new Map(maqsSeg?.map(m => [m.id, m]) || []);

        const segIds = segs.map(s => s.id);
        const { data: accs } = await supabase
          .from('plan_seguimiento_especial')
          .select('id, seguimiento_id, tipo, fecha_objetivo, estado')
          .in('seguimiento_id', segIds)
          .neq('estado', 'cumplida');

        if (accs) {
          for (const a of accs) {
            const seg = segs.find(s => s.id === a.seguimiento_id);
            if (!seg) continue;
            const maq = maqMapSeg.get(seg.maquinista_id);
            if (!maq) continue;
            if (!isAdmin && !assignedBases.includes(maq.base as typeof assignedBases[number])) continue;
            if (baseFilter && baseFilter !== 'all' && maq.base !== baseFilter) continue;

            const fechaObj = new Date(a.fecha_objetivo);
            fechaObj.setHours(0, 0, 0, 0);
            const grupo = calcularGrupoAlerta(fechaObj, today);
            if (!grupo) continue;

            const diasRestantes = differenceInDays(fechaObj, today);
            const estado: 'Pendiente' | 'Vencida' = grupo === 'vencidas' ? 'Vencida' : 'Pendiente';
            allAlertas.push({
              tipo: 'seg_especial',
              id: seg.id,
              accion_id: a.id,
              maquinista_id: seg.maquinista_id,
              maquinista_nombre: `${maq.nombre} ${maq.apellidos}`,
              maquinista_base: maq.base,
              hito: `Seg. Esp.`,
              tipo_actuacion: a.tipo as 'acompanamiento' | 'registro' | 'formativa',
              estado,
              dias_restantes: diasRestantes,
              fecha_objetivo: fechaObj,
              grupo,
            });
          }
        }
      }

      // 5. LICENCIA DE CONDUCCIÓN: 10 años desde obtención, aviso a 6 meses
      {
        let qLic = supabase
          .from('maquinistas')
          .select('id, nombre, apellidos, base, fecha_licencia_conduccion, activo')
          .eq('activo', true)
          .not('fecha_licencia_conduccion', 'is', null);
        const { data: maqsLic } = await qLic;
        if (maqsLic) {
          for (const m of maqsLic) {
            if (!isAdmin && !assignedBases.includes(m.base as typeof assignedBases[number])) continue;
            if (baseFilter && baseFilter !== 'all' && m.base !== baseFilter) continue;
            if (!m.fecha_licencia_conduccion) continue;

            const caducidad = addYears(new Date(m.fecha_licencia_conduccion), 10);
            caducidad.setHours(0, 0, 0, 0);
            const avisoDesde = addMonths(caducidad, -6);

            // Solo alertar si está caducada o dentro de los 6 meses de aviso
            if (caducidad >= today && avisoDesde > today) continue;

            // Para licencia, el aviso es a 6 meses (puede exceder el año en curso),
            // así que forzamos el grupo en función de la caducidad sin cortar por fin de año.
            let grupo: GrupoAlerta;
            if (caducidad < today) {
              grupo = 'vencidas';
            } else if (caducidad <= addDays(today, 90)) {
              grupo = 'proximas_3_meses';
            } else {
              grupo = 'resto_anio';
            }

            const diasRestantes = differenceInDays(caducidad, today);
            const estado: 'Próxima a caducar' | 'Caducada' =
              grupo === 'vencidas' ? 'Caducada' : 'Próxima a caducar';

            allAlertas.push({
              tipo: 'licencia',
              id: m.id,
              maquinista_id: m.id,
              maquinista_nombre: `${m.nombre} ${m.apellidos}`,
              maquinista_base: m.base,
              estado,
              dias_restantes: diasRestantes,
              fecha_caducidad: caducidad,
              grupo,
            });
          }
        }
      }

      // 6. PLANES ESPECÍFICOS DE VIGILANCIA (solo planes validados)
      {
        const { data: planesVal } = await supabase
          .from('planes_vigilancia')
          .select('id, nombre, base, estado')
          .eq('estado', 'validado');

        if (planesVal && planesVal.length > 0) {
          const planMap = new Map(planesVal.map((p) => [p.id, p]));
          const { data: accionesPV } = await supabase
            .from('planes_vigilancia_acciones')
            .select('id, plan_id, maquinista_id, tipo_accion, tipo_accion_libre, fecha_prevista, estado')
            .in('plan_id', planesVal.map((p) => p.id))
            .in('estado', ['pendiente', 'no_realizada']);


          const { data: tiposAcc } = await supabase
            .from('tipos_accion_vigilancia')
            .select('id, nombre');
          const tipoMap = new Map((tiposAcc || []).map((t) => [t.id, t.nombre]));

          if (accionesPV && accionesPV.length > 0) {
            const maqIdsPV = [...new Set(accionesPV.map((a) => a.maquinista_id))];
            const { data: maqsPV } = await supabase
              .from('maquinistas')
              .select('id, nombre, apellidos, base')
              .in('id', maqIdsPV);
            const maqMapPV = new Map((maqsPV || []).map((m) => [m.id, m]));

            for (const a of accionesPV) {
              const plan = planMap.get(a.plan_id);
              const maq = maqMapPV.get(a.maquinista_id);
              if (!plan || !maq) continue;
              if (!isAdmin && !assignedBases.includes(maq.base as typeof assignedBases[number])) continue;
              if (baseFilter && baseFilter !== 'all' && maq.base !== baseFilter) continue;

              const fechaObj = new Date(a.fecha_prevista);
              fechaObj.setHours(0, 0, 0, 0);
              const esNoRealizada = a.estado === 'no_realizada';
              const grupo = esNoRealizada ? 'vencidas' : calcularGrupoAlerta(fechaObj, today);
              if (!grupo) continue;

              allAlertas.push({
                tipo: 'plan_especifico',
                id: plan.id,
                accion_id: a.id,
                plan_nombre: plan.nombre,
                maquinista_id: a.maquinista_id,
                maquinista_nombre: `${maq.nombre} ${maq.apellidos}`,
                maquinista_base: maq.base,
                accion: a.tipo_accion_libre || tipoMap.get(a.tipo_accion) || a.tipo_accion,
                estado: esNoRealizada ? 'No realizada' : grupo === 'vencidas' ? 'Vencida' : 'Pendiente',
                dias_restantes: differenceInDays(fechaObj, today),
                fecha_objetivo: fechaObj,
                grupo,
              });

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
    segEspecial: alertas.filter(a => a.tipo === 'seg_especial').length,
    planEspecifico: alertas.filter(a => a.tipo === 'plan_especifico').length,

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
