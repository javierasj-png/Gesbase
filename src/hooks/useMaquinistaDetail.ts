import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { isBefore, isWithinInterval, isAfter } from 'date-fns';

export type EstadoBloque1603 = 'Pendiente' | 'En ventana' | 'Vencida' | 'Cumplida';
export type TipoActuacion1603 = 'Acompañamiento' | 'Registro' | 'Alcohol' | 'Drogas';

export interface MaquinistaDB {
  id: string;
  matricula: string;
  nombre_apellidos: string;
  base: string;
  activo: boolean;
  bajo_pe_1603: boolean;
  fecha_primer_servicio: string | null;
  observaciones: string | null;
  created_at: string;
}

export interface Expediente1603Detail {
  id: string;
  maquinista_id: string;
  fecha_primer_servicio: string;
  fecha_inicio: string;
  fecha_fin_prevista: string;
  estado: 'Activo' | 'Cerrado';
  observaciones: string | null;
}

export interface PlanBloque1603 {
  id: string;
  expediente_id: string;
  tipo: TipoActuacion1603;
  etiqueta: string;
  orden: number;
  inicio_ventana: string;
  fin_ventana: string;
  estado: EstadoBloque1603;
  actuacion_id: string | null;
  estadoCalculado: EstadoBloque1603;
}

function calcularEstadoBloque(
  inicioVentana: Date, 
  finVentana: Date, 
  actuacionId: string | null
): EstadoBloque1603 {
  if (actuacionId) return 'Cumplida';
  
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  const inicio = new Date(inicioVentana);
  inicio.setHours(0, 0, 0, 0);
  
  const fin = new Date(finVentana);
  fin.setHours(23, 59, 59, 999);
  
  if (isBefore(hoy, inicio)) {
    return 'Pendiente';
  } else if (isWithinInterval(hoy, { start: inicio, end: fin })) {
    return 'En ventana';
  } else if (isAfter(hoy, fin)) {
    return 'Vencida';
  }
  
  return 'Pendiente';
}

export function useMaquinistaDetail(id: string | undefined) {
  const { toast } = useToast();
  const [maquinista, setMaquinista] = useState<MaquinistaDB | null>(null);
  const [expediente1603, setExpediente1603] = useState<Expediente1603Detail | null>(null);
  const [plan1603, setPlan1603] = useState<PlanBloque1603[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch maquinista
      const { data: maqData, error: maqError } = await supabase
        .from('maquinistas')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (maqError) {
        console.error('Error fetching maquinista:', maqError);
        setError('No se pudo cargar el maquinista');
        toast({
          title: 'Error',
          description: 'No se pudo cargar el maquinista',
          variant: 'destructive',
        });
        return;
      }

      if (!maqData) {
        setError('Maquinista no encontrado');
        return;
      }

      setMaquinista(maqData as MaquinistaDB);

      // Fetch expediente 1603
      const { data: expData, error: expError } = await supabase
        .from('expedientes_1603')
        .select('*')
        .eq('maquinista_id', id)
        .maybeSingle();

      if (expError) {
        console.error('Error fetching expediente:', expError);
      }

      if (expData) {
        setExpediente1603(expData as Expediente1603Detail);

        // Fetch plan
        const { data: planData, error: planError } = await supabase
          .from('plan_1603')
          .select('*')
          .eq('expediente_id', expData.id)
          .order('tipo')
          .order('orden');

        if (planError) {
          console.error('Error fetching plan:', planError);
        }

        if (planData) {
          const planConEstado = planData.map(bloque => ({
            ...bloque,
            tipo: bloque.tipo as TipoActuacion1603,
            estado: bloque.estado as EstadoBloque1603,
            estadoCalculado: calcularEstadoBloque(
              new Date(bloque.inicio_ventana),
              new Date(bloque.fin_ventana),
              bloque.actuacion_id
            )
          }));
          setPlan1603(planConEstado);
        }
      } else {
        setExpediente1603(null);
        setPlan1603([]);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    maquinista,
    expediente1603,
    plan1603,
    loading,
    error,
    refetch: fetchData,
  };
}
