import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isBefore, isWithinInterval, isAfter, differenceInDays } from 'date-fns';

export type TipoActuacion1603 = 'Acompañamiento' | 'Registro' | 'Alcohol' | 'Drogas';
export type EstadoBloque1603 = 'Pendiente' | 'En ventana' | 'Vencida' | 'Cumplida';
export type EstadoExpediente = 'Activo' | 'Cerrado';

export interface Expediente1603DB {
  id: string;
  maquinista_id: string;
  fecha_primer_servicio: string;
  fecha_inicio: string;
  fecha_fin_prevista: string;
  estado: EstadoExpediente;
  observaciones: string | null;
  cierre_manual: boolean | null;
  fecha_cierre: string | null;
  cerrado_por: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface Plan1603DB {
  id: string;
  expediente_id: string;
  tipo: TipoActuacion1603;
  etiqueta: string;
  orden: number;
  inicio_ventana: string;
  fin_ventana: string;
  estado: EstadoBloque1603;
  actuacion_id: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface Actuacion1603DB {
  id: string;
  expediente_id: string;
  tipo: TipoActuacion1603;
  fecha_real: string;
  resultado: string | null;
  observaciones: string | null;
  adjuntos: string[] | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
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
  plan: (Plan1603DB & { estadoCalculado: EstadoBloque1603 })[];
  resumen: {
    vencidas: number;
    enVentana: number;
    cumplidas: number;
    pendientes: number;
    diasRestantes: number;
  };
}

function calcularEstadoBloque(
  inicioVentana: Date, 
  finVentana: Date, 
  actuacionId: string | null
): EstadoBloque1603 {
  if (actuacionId) return 'Cumplida';
  
  const hoy = new Date();
  
  if (isBefore(hoy, inicioVentana)) {
    return 'Pendiente';
  } else if (isWithinInterval(hoy, { start: inicioVentana, end: finVentana })) {
    return 'En ventana';
  } else if (isAfter(hoy, finVentana)) {
    return 'Vencida';
  }
  
  return 'Pendiente';
}

export function useExpedientes1603() {
  const { user, isAdmin, assignedBases } = useAuth();
  const { toast } = useToast();
  const [expedientes, setExpedientes] = useState<ExpedienteConPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpedientes = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch expedientes con maquinistas
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
        .select('id, matricula, nombre_apellidos, base')
        .in('id', maquinistaIds);

      // Fetch planes
      const expedienteIds = expedientesData.map(e => e.id);
      const { data: planesData } = await supabase
        .from('plan_1603')
        .select('*')
        .in('expediente_id', expedienteIds)
        .order('tipo')
        .order('orden');

      // Construir expedientes con plan y resumen
      const expedientesConPlan: ExpedienteConPlan[] = expedientesData.map(exp => {
        const maquinista = maquinistasData?.find(m => m.id === exp.maquinista_id) || null;
        const planExpediente = (planesData || []).filter(p => p.expediente_id === exp.id);
        
        // Calcular estado dinámico de cada bloque
        const planConEstado = planExpediente.map(bloque => ({
          ...bloque,
          estadoCalculado: calcularEstadoBloque(
            new Date(bloque.inicio_ventana),
            new Date(bloque.fin_ventana),
            bloque.actuacion_id
          )
        }));

        const vencidas = planConEstado.filter(b => b.estadoCalculado === 'Vencida').length;
        const enVentana = planConEstado.filter(b => b.estadoCalculado === 'En ventana').length;
        const cumplidas = planConEstado.filter(b => b.estadoCalculado === 'Cumplida').length;
        const pendientes = planConEstado.filter(b => b.estadoCalculado === 'Pendiente').length;
        const diasRestantes = differenceInDays(new Date(exp.fecha_fin_prevista), new Date());

        return {
          expediente: exp as Expediente1603DB,
          maquinista,
          plan: planConEstado as (Plan1603DB & { estadoCalculado: EstadoBloque1603 })[],
          resumen: { vencidas, enVentana, cumplidas, pendientes, diasRestantes }
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
    totalActivos: expedientes.filter(e => e.expediente.estado === 'Activo').length,
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
