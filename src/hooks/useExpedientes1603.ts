import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isBefore, isWithinInterval, isAfter, differenceInDays, addYears } from 'date-fns';

export type TipoActuacion1603 = 'acompanamiento' | 'registro' | 'alcohol' | 'drogas';
export type EstadoBloque1603 = 'pendiente' | 'programado' | 'realizado';
export type EstadoExpediente = 'abierto' | 'cerrado';

export interface Expediente1603DB {
  id: string;
  maquinista_id: string;
  tipo: 'nuevo_acceso' | 'reincorporacion';
  fecha_inicio: string;
  fecha_primer_servicio: string | null;
  estado: EstadoExpediente;
  observaciones: string | null;
  cierre_manual: boolean | null;
  fecha_cierre: string | null;
  cerrado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plan1603DB {
  id: string;
  expediente_id: string;
  actuacion_id: string | null;
  tipo: TipoActuacion1603;
  etiqueta: string | null;
  orden: number | null;
  mes: number;
  inicio_ventana: string | null;
  fin_ventana: string | null;
  estado: EstadoBloque1603;
  created_at: string;
}

export interface Actuacion1603DB {
  id: string;
  expediente_id: string;
  tipo: TipoActuacion1603;
  fecha_programada: string | null;
  fecha_real: string | null;
  resultado: string | null;
  indice_prever: number | null;
  observaciones: string | null;
  registrado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaquinistaResumen {
  id: string;
  matricula: string;
  nombre_apellidos: string;
  base: string;
}

export interface ExpedienteConPlan {
  expediente: Expediente1603DB;
  maquinista: MaquinistaResumen | null;
  plan: (Plan1603DB & { estadoCalculado: string })[];
  resumen: {
    vencidas: number;
    enVentana: number;
    cumplidas: number;
    pendientes: number;
    diasRestantes: number;
  };
}

export function useExpedientes1603() {
  const { user, isAdmin, assignedBases } = useAuth();
  const { toast } = useToast();
  const [expedientes, setExpedientes] = useState<ExpedienteConPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpedientes = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch expedientes
      const { data: expedientesData, error: expError } = await supabase
        .from('expedientes_1603')
        .select('*')
        .order('created_at', { ascending: false });

      if (expError) {
        console.error('Error fetching expedientes:', expError);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los expedientes PE 16.03',
          variant: 'destructive',
        });
        return;
      }

      if (!expedientesData || expedientesData.length === 0) {
        setExpedientes([]);
        return;
      }

      // Fetch maquinistas relacionados
      const maquinistaIds = [...new Set(expedientesData.map(e => e.maquinista_id))];
      const { data: maquinistasData } = await supabase
        .from('maquinistas')
        .select('id, matricula, nombre, apellidos, base')
        .in('id', maquinistaIds);

      // Fetch planes
      const expedienteIds = expedientesData.map(e => e.id);
      const { data: planesData } = await supabase
        .from('plan_1603')
        .select('*')
        .in('expediente_id', expedienteIds)
        .order('tipo')
        .order('mes');

      // Construir expedientes con plan y resumen
      const expedientesConPlan: ExpedienteConPlan[] = expedientesData.map(exp => {
        const maq = maquinistasData?.find(m => m.id === exp.maquinista_id);
        const maquinista: MaquinistaResumen | null = maq ? {
          id: maq.id,
          matricula: maq.matricula,
          nombre_apellidos: `${maq.nombre} ${maq.apellidos}`,
          base: maq.base,
        } : null;

        const planExpediente = (planesData || []).filter(p => p.expediente_id === exp.id);
        
        // Calculate estado for each bloque based on ventana dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let vencidas = 0;
        let enVentana = 0;
        let cumplidas = 0;
        let pendientes = 0;
        
        const planConEstado = planExpediente.map(bloque => {
          let estadoCalculado = 'pendiente';
          
          if (bloque.justificado_traslado) {
            estadoCalculado = 'justificada';
          } else if (bloque.actuacion_id) {
            estadoCalculado = 'realizado';
            cumplidas++;
          } else if (bloque.inicio_ventana && bloque.fin_ventana) {
            const inicioVentana = new Date(bloque.inicio_ventana);
            const finVentana = new Date(bloque.fin_ventana);
            inicioVentana.setHours(0, 0, 0, 0);
            finVentana.setHours(23, 59, 59, 999);
            
            if (today > finVentana) {
              estadoCalculado = 'vencida';
              vencidas++;
            } else if (today >= inicioVentana && today <= finVentana) {
              estadoCalculado = 'en_ventana';
              enVentana++;
            } else {
              // Aún no abre (futuro)
              pendientes++;
            }
          } else {
            pendientes++;
          }
          
          return {
            ...bloque,
            tipo: bloque.tipo as TipoActuacion1603,
            estado: bloque.estado as EstadoBloque1603,
            estadoCalculado
          };
        });

        // Calculate days remaining (3 years from fecha_primer_servicio)
        let diasRestantes = 0;
        if (exp.fecha_primer_servicio) {
          const fechaFin = addYears(new Date(exp.fecha_primer_servicio), 3);
          diasRestantes = differenceInDays(fechaFin, new Date());
        }

        return {
          expediente: {
            ...exp,
            tipo: exp.tipo as 'nuevo_acceso' | 'reincorporacion',
            estado: exp.estado as EstadoExpediente,
          },
          maquinista,
          plan: planConEstado as (Plan1603DB & { estadoCalculado: string })[],
          resumen: { 
            vencidas, 
            enVentana, 
            cumplidas, 
            pendientes, 
            diasRestantes 
          }
        };
      });

      // Filtrar por bases si no es admin
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
    totalActivos: expedientes.filter(e => e.expediente.estado === 'abierto').length,
    conVencidas: expedientes.filter(e => e.resumen.vencidas > 0).length,
    conEnVentana: expedientes.filter(e => e.resumen.enVentana > 0).length,
  };

  return {
    expedientes,
    loading,
    kpis,
    refetch: fetchExpedientes,
  };
}
