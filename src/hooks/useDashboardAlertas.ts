import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addMonths, differenceInDays, isAfter, isWithinInterval, isBefore } from 'date-fns';

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
}

export type Alerta = AlertaCertificacion | Alerta1603 | Alerta1201;

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

      // 1. CERTIFICACIONES: Obtener todas las certificaciones con sus maquinistas
      const { data: maqCerts, error: certError } = await supabase
        .from('maquinista_certificaciones')
        .select(`
          id,
          maquinista_id,
          certificacion_id,
          vigilar_vencimiento,
          periodo_inactividad_meses,
          aviso_dias,
          fecha_ultimo_servicio
        `);

      if (!certError && maqCerts) {
        // Obtener maquinistas
        const maqIds = [...new Set(maqCerts.map(mc => mc.maquinista_id))];
        const { data: maquinistas } = await supabase
          .from('maquinistas')
          .select('id, nombre_apellidos, base, activo')
          .in('id', maqIds)
          .eq('activo', true);

        // Obtener catálogo de certificaciones
        const certIds = [...new Set(maqCerts.map(mc => mc.certificacion_id))];
        const { data: catalogo } = await supabase
          .from('certificaciones')
          .select('id, nombre, tipo')
          .in('id', certIds);

        const maqMap = new Map(maquinistas?.map(m => [m.id, m]) || []);
        const certMap = new Map(catalogo?.map(c => [c.id, c]) || []);

        for (const mc of maqCerts) {
          if (!mc.vigilar_vencimiento) continue;
          
          const maq = maqMap.get(mc.maquinista_id);
          if (!maq) continue;

          // Filtrar por base
          if (!isAdmin && !assignedBases.includes(maq.base as typeof assignedBases[number])) continue;
          if (baseFilter && baseFilter !== 'all' && maq.base !== baseFilter) continue;

          const cert = certMap.get(mc.certificacion_id);
          if (!cert) continue;

          let estado: 'Próxima a vencer' | 'Vencida' | null = null;
          let diasRestantes: number | null = null;
          let fechaVencimiento: Date | null = null;

          if (!mc.fecha_ultimo_servicio) {
            estado = 'Vencida';
          } else {
            fechaVencimiento = addMonths(new Date(mc.fecha_ultimo_servicio), mc.periodo_inactividad_meses);
            diasRestantes = differenceInDays(fechaVencimiento, new Date());

            if (diasRestantes < 0) {
              estado = 'Vencida';
            } else if (diasRestantes <= mc.aviso_dias) {
              estado = 'Próxima a vencer';
            }
          }

          if (estado) {
            allAlertas.push({
              tipo: 'certificacion',
              id: mc.id,
              maquinista_id: mc.maquinista_id,
              maquinista_nombre: maq.nombre_apellidos,
              maquinista_base: maq.base,
              certificacion_nombre: cert.nombre,
              certificacion_tipo: cert.tipo as 'vehiculo' | 'linea',
              estado,
              dias_restantes: diasRestantes,
              fecha_vencimiento: fechaVencimiento,
            });
          }
        }
      }

      // 2. PE 16.03: Obtener bloques en ventana o vencidos
      const { data: planes1603, error: planError } = await supabase
        .from('plan_1603')
        .select(`
          id,
          expediente_id,
          tipo,
          etiqueta,
          inicio_ventana,
          fin_ventana,
          actuacion_id
        `);

      if (!planError && planes1603) {
        // Obtener expedientes
        const expIds = [...new Set(planes1603.map(p => p.expediente_id))];
        const { data: expedientes } = await supabase
          .from('expedientes_1603')
          .select('id, maquinista_id, estado')
          .in('id', expIds)
          .eq('estado', 'Activo');

        if (expedientes) {
          const expMap = new Map(expedientes.map(e => [e.id, e]));

          // Obtener maquinistas de expedientes
          const maqExpIds = [...new Set(expedientes.map(e => e.maquinista_id))];
          const { data: maquinistasExp } = await supabase
            .from('maquinistas')
            .select('id, nombre_apellidos, base')
            .in('id', maqExpIds);

          const maqExpMap = new Map(maquinistasExp?.map(m => [m.id, m]) || []);

          const hoy = new Date();

          for (const bloque of planes1603) {
            if (bloque.actuacion_id) continue; // Ya cumplido

            const exp = expMap.get(bloque.expediente_id);
            if (!exp) continue;

            const maq = maqExpMap.get(exp.maquinista_id);
            if (!maq) continue;

            // Filtrar por base
            if (!isAdmin && !assignedBases.includes(maq.base as typeof assignedBases[number])) continue;
            if (baseFilter && baseFilter !== 'all' && maq.base !== baseFilter) continue;

            const inicioVentana = new Date(bloque.inicio_ventana);
            const finVentana = new Date(bloque.fin_ventana);
            const diasRestantes = differenceInDays(finVentana, hoy);

            let estado: 'En ventana' | 'Vencida' | null = null;

            if (isAfter(hoy, finVentana)) {
              estado = 'Vencida';
            } else if (isWithinInterval(hoy, { start: inicioVentana, end: finVentana })) {
              estado = 'En ventana';
            }

            if (estado) {
              allAlertas.push({
                tipo: 'pe1603',
                id: exp.id,
                bloque_id: bloque.id,
                maquinista_id: exp.maquinista_id,
                maquinista_nombre: maq.nombre_apellidos,
                maquinista_base: maq.base,
                etiqueta: bloque.etiqueta,
                tipo_actuacion: bloque.tipo,
                estado,
                dias_restantes: diasRestantes,
                fin_ventana: finVentana,
              });
            }
          }
        }
      }

      // 3. PE 12.01: Para ahora usamos mock (cuando se implemente real se actualiza)
      // TODO: Implementar cuando PE 12.01 esté en BD

      // Ordenar: primero vencidas, luego por días restantes
      allAlertas.sort((a, b) => {
        const esVencidaA = a.estado === 'Vencida';
        const esVencidaB = b.estado === 'Vencida';
        if (esVencidaA !== esVencidaB) return esVencidaA ? -1 : 1;
        
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

  const kpis = {
    totalAlertas: alertas.length,
    vencidas: alertas.filter(a => a.estado === 'Vencida').length,
    proximasOEnVentana: alertas.filter(a => a.estado !== 'Vencida').length,
    certificaciones: alertas.filter(a => a.tipo === 'certificacion').length,
    pe1603: alertas.filter(a => a.tipo === 'pe1603').length,
    pe1201: alertas.filter(a => a.tipo === 'pe1201').length,
  };

  return {
    alertas,
    loading,
    kpis,
    refetch: fetchAlertas,
  };
}
