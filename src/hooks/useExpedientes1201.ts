import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { addDays, differenceInDays, parseISO } from 'date-fns';

export type EstadoExpediente1201 = 'abierto' | 'cerrado';
export type EstadoBloque1201 = 'pendiente' | 'programado' | 'realizado' | 'no_procede';

export interface Expediente1201DB {
  id: string;
  maquinista_id: string;
  id_suceso: string;
  fecha_suceso: string | null;
  fecha_primer_servicio: string;
  descripcion_suceso: string | null;
  observaciones: string | null;
  estado: EstadoExpediente1201;
  cierre_manual: boolean | null;
  fecha_cierre: string | null;
  cerrado_por: string | null;
  fecha_fin_prevista: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface Plan1201DB {
  id: string;
  expediente_id: string;
  actuacion_id: string | null;
  tipo: string;
  etiqueta: string;
  dia_desde_origen: number;
  fecha_objetivo: string | null;
  estado: EstadoBloque1201;
  obligatorio: boolean;
  created_at: string;
}

export interface Actuacion1201DB {
  id: string;
  expediente_id: string;
  plan_id: string | null;
  fecha_programada: string | null;
  fecha_real: string | null;
  tipo_accion: string;
  descripcion: string | null;
  resultado: string | null;
  observaciones: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaquinistaResumen1201 {
  id: string;
  matricula: string;
  nombre_apellidos: string;
  base: string;
}

export interface ExpedienteConPlan1201 {
  expediente: Expediente1201DB;
  maquinista: MaquinistaResumen1201 | null;
  plan: Plan1201DB[];
  resumen: {
    pendientes: number;
    realizados: number;
    diasHastaCierre: number;
    fechaCierreRecomendada: Date | null;
  };
}

export function useExpedientes1201() {
  const { user, isAdmin, assignedBases } = useAuth();
  const { toast } = useToast();
  const [expedientes, setExpedientes] = useState<ExpedienteConPlan1201[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpedientes = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch expedientes
      const { data: expedientesData, error: expError } = await supabase
        .from('expedientes_1201')
        .select('*')
        .order('created_at', { ascending: false });

      if (expError) {
        console.error('Error fetching expedientes 1201:', expError);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los expedientes PE 12.01',
          variant: 'destructive',
        });
        setExpedientes([]);
        return;
      }

      if (!expedientesData || expedientesData.length === 0) {
        setExpedientes([]);
        return;
      }

      // Fetch maquinistas
      const maquinistaIds = [...new Set(expedientesData.map(e => e.maquinista_id))];
      const { data: maquinistasData } = await supabase
        .from('maquinistas')
        .select('id, matricula, nombre, apellidos, base')
        .in('id', maquinistaIds);

      // Fetch planes
      const expedienteIds = expedientesData.map(e => e.id);
      const { data: planesData } = await supabase
        .from('plan_1201')
        .select('*')
        .in('expediente_id', expedienteIds)
        .order('dia_desde_origen');

      // Build expedientes with plan and summary
      const expedientesConPlan: ExpedienteConPlan1201[] = expedientesData.map(exp => {
        const maq = maquinistasData?.find(m => m.id === exp.maquinista_id);
        const maquinista: MaquinistaResumen1201 | null = maq ? {
          id: maq.id,
          matricula: maq.matricula,
          nombre_apellidos: `${maq.nombre} ${maq.apellidos}`,
          base: maq.base,
        } : null;

        const planExpediente = (planesData || []).filter(p => p.expediente_id === exp.id) as Plan1201DB[];

        const pendientes = planExpediente.filter(b => b.estado === 'pendiente').length;
        const realizados = planExpediente.filter(b => b.estado === 'realizado').length;

        // Calculate days until close (40 days from primer servicio)
        const fechaCierreRecomendada = exp.fecha_primer_servicio 
          ? addDays(parseISO(exp.fecha_primer_servicio), 40)
          : null;
        const diasHastaCierre = fechaCierreRecomendada 
          ? differenceInDays(fechaCierreRecomendada, new Date())
          : 0;

        return {
          expediente: {
            ...exp,
            estado: exp.estado as EstadoExpediente1201,
          },
          maquinista,
          plan: planExpediente,
          resumen: { 
            pendientes, 
            realizados, 
            diasHastaCierre,
            fechaCierreRecomendada,
          }
        };
      });

      // Filter by bases if not admin
      const filteredExpedientes = isAdmin 
        ? expedientesConPlan 
        : expedientesConPlan.filter(e => 
            e.maquinista && assignedBases.includes(e.maquinista.base as typeof assignedBases[number])
          );

      setExpedientes(filteredExpedientes);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, assignedBases, toast]);

  useEffect(() => {
    if (user) {
      fetchExpedientes();
    }
  }, [user, fetchExpedientes]);

  // KPIs
  const kpis = {
    totalAbiertas: expedientes.filter(e => e.expediente.estado === 'abierto').length,
    conPendientes: expedientes.filter(e => e.resumen.pendientes > 0 && e.expediente.estado === 'abierto').length,
    proximasCierre: expedientes.filter(e => 
      e.expediente.estado === 'abierto' && e.resumen.diasHastaCierre <= 7
    ).length,
  };

  return {
    expedientes,
    loading,
    kpis,
    refetch: fetchExpedientes,
  };
}
