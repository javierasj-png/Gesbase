import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { addYears, differenceInDays } from 'date-fns';

export type EstadoBloque1603 = 'pendiente' | 'programado' | 'realizado';
export type TipoActuacion1603 = 'acompanamiento' | 'registro' | 'alcohol' | 'drogas';

export interface MaquinistaDB {
  id: string;
  matricula: string;
  nombre: string;
  apellidos: string;
  base: string;
  email: string | null;
  telefono: string | null;
  fecha_ingreso: string | null;
  fecha_licencia_conduccion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Expediente1603Detail {
  id: string;
  maquinista_id: string;
  tipo: 'nuevo_acceso' | 'reincorporacion';
  fecha_inicio: string;
  fecha_primer_servicio: string | null;
  estado: 'abierto' | 'cerrado';
  observaciones: string | null;
  cierre_manual: boolean | null;
  fecha_cierre: string | null;
  cerrado_por: string | null;
}

export interface PlanBloque1603 {
  id: string;
  expediente_id: string;
  actuacion_id: string | null;
  tipo: TipoActuacion1603;
  mes: number;
  estado: EstadoBloque1603;
  created_at: string;
  etiqueta?: string | null;
  orden?: number | null;
  inicio_ventana?: string | null;
  fin_ventana?: string | null;
  justificado_traslado?: boolean;
  traslado_id?: string | null;
  comentario_vencida?: string | null;
}

export interface Traslado1603 {
  id: string;
  expediente_id: string;
  fecha_traslado: string;
  base_origen: string;
  base_destino: string;
  tipo: 'entrada' | 'salida';
  observaciones: string | null;
  registrado_por: string | null;
  created_at: string;
}

export function useMaquinistaDetail(id: string | undefined) {
  const { toast } = useToast();
  const [maquinista, setMaquinista] = useState<MaquinistaDB | null>(null);
  const [expediente1603, setExpediente1603] = useState<Expediente1603Detail | null>(null);
  const [plan1603, setPlan1603] = useState<PlanBloque1603[]>([]);
  const [traslados1603, setTraslados1603] = useState<Traslado1603[]>([]);
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

      setMaquinista(maqData);

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
        setExpediente1603({
          id: expData.id,
          maquinista_id: expData.maquinista_id,
          tipo: expData.tipo as 'nuevo_acceso' | 'reincorporacion',
          fecha_inicio: expData.fecha_inicio,
          fecha_primer_servicio: expData.fecha_primer_servicio,
          estado: expData.estado as 'abierto' | 'cerrado',
          observaciones: expData.observaciones,
          cierre_manual: expData.cierre_manual,
          fecha_cierre: expData.fecha_cierre,
          cerrado_por: expData.cerrado_por,
        });

        // Fetch plan
        const { data: planData, error: planError } = await supabase
          .from('plan_1603')
          .select('*')
          .eq('expediente_id', expData.id)
          .order('tipo')
          .order('mes');

        if (planError) {
          console.error('Error fetching plan:', planError);
        }

        if (planData) {
          const planTyped: PlanBloque1603[] = planData.map(bloque => ({
            ...bloque,
            tipo: bloque.tipo as TipoActuacion1603,
            estado: bloque.estado as EstadoBloque1603,
          }));
          setPlan1603(planTyped);
        }

        // Fetch traslados
        const { data: trasladosData } = await supabase
          .from('traslados_1603')
          .select('*')
          .eq('expediente_id', expData.id)
          .order('fecha_traslado', { ascending: true });

        setTraslados1603((trasladosData || []) as Traslado1603[]);
      } else {
        setExpediente1603(null);
        setPlan1603([]);
        setTraslados1603([]);
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
    traslados1603,
    loading,
    error,
    refetch: fetchData,
  };
}
