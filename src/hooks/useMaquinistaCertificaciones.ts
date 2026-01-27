import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { addMonths, differenceInDays } from 'date-fns';

export interface MaquinistaCertificacionDB {
  id: string;
  maquinista_id: string;
  certificacion_id: string;
  obligatoria: boolean;
  vigilar_vencimiento: boolean;
  periodo_inactividad_meses: number;
  aviso_dias: number;
  fecha_ultimo_servicio: string | null;
}

export interface CertificacionConEstado extends MaquinistaCertificacionDB {
  certificacion_nombre: string;
  certificacion_tipo: 'vehiculo' | 'linea';
  estado: 'Vigente' | 'Próxima a vencer' | 'Vencida' | 'No aplica';
  dias_restantes: number | null;
  fecha_vencimiento: Date | null;
}

export interface CertificacionDisponible {
  id: string;
  nombre: string;
  tipo: 'vehiculo' | 'linea';
  obligatoria: boolean;
  vigilar_vencimiento: boolean;
  periodo_inactividad_meses: number;
  aviso_dias: number;
  asignada: boolean;
  fecha_ultimo_servicio: string | null;
}

function calcularEstado(
  fechaUltimoServicio: string | null,
  vigilarVencimiento: boolean,
  periodoInactividadMeses: number,
  avisoDias: number
): { estado: CertificacionConEstado['estado']; diasRestantes: number | null; fechaVencimiento: Date | null } {
  if (!vigilarVencimiento) {
    return { estado: 'No aplica', diasRestantes: null, fechaVencimiento: null };
  }

  if (!fechaUltimoServicio) {
    return { estado: 'Vencida', diasRestantes: null, fechaVencimiento: null };
  }

  const fechaVencimiento = addMonths(new Date(fechaUltimoServicio), periodoInactividadMeses);
  const diasRestantes = differenceInDays(fechaVencimiento, new Date());

  if (diasRestantes < 0) {
    return { estado: 'Vencida', diasRestantes, fechaVencimiento };
  }

  if (diasRestantes <= avisoDias) {
    return { estado: 'Próxima a vencer', diasRestantes, fechaVencimiento };
  }

  return { estado: 'Vigente', diasRestantes, fechaVencimiento };
}

export function useMaquinistaCertificaciones(maquinistaId: string | null, baseName: string | null) {
  const { toast } = useToast();
  const [certificaciones, setCertificaciones] = useState<CertificacionConEstado[]>([]);
  const [disponibles, setDisponibles] = useState<CertificacionDisponible[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!maquinistaId || !baseName) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Obtener la base
      const { data: baseData, error: errorBase } = await supabase
        .from('bases_conduccion')
        .select('id')
        .eq('nombre', baseName)
        .maybeSingle();

      if (errorBase) throw errorBase;
      if (!baseData) {
        console.log('Base no encontrada:', baseName);
        setCertificaciones([]);
        setDisponibles([]);
        setLoading(false);
        return;
      }

      // 2. Obtener certificaciones configuradas para esta base
      const { data: baseCerts, error: errorBaseCerts } = await supabase
        .from('base_certificaciones')
        .select('*')
        .eq('base_id', baseData.id);

      if (errorBaseCerts) throw errorBaseCerts;
      
      const baseCertificaciones = baseCerts || [];
      console.log('Certificaciones de la base:', baseCertificaciones);

      // 3. Obtener certificaciones ya asignadas al maquinista
      const { data: asignadas, error: errorAsignadas } = await supabase
        .from('maquinista_certificaciones')
        .select('*')
        .eq('maquinista_id', maquinistaId);

      if (errorAsignadas) throw errorAsignadas;

      // 4. Construir lista de certificaciones con estado
      // Usar las certificaciones de la base como fuente principal
      const certificacionesConEstado: CertificacionConEstado[] = baseCertificaciones.map(bc => {
        // Buscar si ya está asignada al maquinista
        const asignada = asignadas?.find(a => a.certificacion_id === bc.certificacion_id);
        
        const fechaServicio = asignada?.fecha_ultimo_servicio || null;
        const vigilar = asignada?.vigilar_vencimiento ?? bc.vigilar_vencimiento;
        const periodo = asignada?.periodo_inactividad_meses ?? bc.periodo_inactividad_meses;
        const aviso = asignada?.aviso_dias ?? bc.aviso_dias;

        const { estado, diasRestantes, fechaVencimiento } = calcularEstado(
          fechaServicio,
          vigilar,
          periodo,
          aviso
        );

        return {
          id: asignada?.id || bc.id,
          maquinista_id: maquinistaId,
          certificacion_id: bc.certificacion_id,
          obligatoria: bc.obligatoria,
          vigilar_vencimiento: vigilar,
          periodo_inactividad_meses: periodo,
          aviso_dias: aviso,
          fecha_ultimo_servicio: fechaServicio,
          certificacion_nombre: bc.certificacion_nombre,
          certificacion_tipo: bc.certificacion_tipo as 'vehiculo' | 'linea',
          estado,
          dias_restantes: diasRestantes,
          fecha_vencimiento: fechaVencimiento,
        };
      });

      // 5. Construir lista de disponibles para el selector
      const disponiblesData: CertificacionDisponible[] = baseCertificaciones.map(bc => {
        const asignada = asignadas?.find(a => a.certificacion_id === bc.certificacion_id);
        
        return {
          id: bc.certificacion_id,
          nombre: bc.certificacion_nombre,
          tipo: bc.certificacion_tipo as 'vehiculo' | 'linea',
          obligatoria: bc.obligatoria,
          vigilar_vencimiento: bc.vigilar_vencimiento,
          periodo_inactividad_meses: bc.periodo_inactividad_meses,
          aviso_dias: bc.aviso_dias,
          asignada: !!asignada,
          fecha_ultimo_servicio: asignada?.fecha_ultimo_servicio || null,
        };
      });

      setCertificaciones(certificacionesConEstado);
      setDisponibles(disponiblesData);
    } catch (error) {
      console.error('Error fetching maquinista certificaciones:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las certificaciones',
      });
    } finally {
      setLoading(false);
    }
  }, [maquinistaId, baseName, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const asignarCertificacion = async (
    certificacionId: string,
    config: {
      obligatoria: boolean;
      vigilar_vencimiento: boolean;
      periodo_inactividad_meses: number;
      aviso_dias: number;
      fecha_ultimo_servicio?: string | null;
    }
  ): Promise<boolean> => {
    if (!maquinistaId) return false;

    try {
      const { error } = await supabase
        .from('maquinista_certificaciones')
        .insert({
          maquinista_id: maquinistaId,
          certificacion_id: certificacionId,
          ...config,
        });

      if (error) throw error;

      toast({ title: 'Certificación asignada' });
      await fetchData();
      return true;
    } catch (error: any) {
      console.error('Error asignando certificación:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message?.includes('duplicate') 
          ? 'Esta certificación ya está asignada'
          : 'No se pudo asignar la certificación',
      });
      return false;
    }
  };

  const actualizarFechaServicio = async (
    certificacionId: string,
    fechaServicio: string
  ): Promise<boolean> => {
    if (!maquinistaId) return false;

    try {
      // Buscar la certificación en base_certificaciones para obtener la info
      const baseCert = disponibles.find(d => d.id === certificacionId);
      
      // Buscar si ya existe un registro para este maquinista con esta certificación
      const { data: existente } = await supabase
        .from('maquinista_certificaciones')
        .select('id')
        .eq('maquinista_id', maquinistaId)
        .eq('certificacion_id', certificacionId)
        .maybeSingle();

      if (existente) {
        // Si ya existe, actualizar
        const { error } = await supabase
          .from('maquinista_certificaciones')
          .update({ fecha_ultimo_servicio: fechaServicio })
          .eq('id', existente.id);

        if (error) throw error;
      } else if (baseCert) {
        // Si no existe, insertar nuevo registro
        const { error } = await supabase
          .from('maquinista_certificaciones')
          .insert({
            maquinista_id: maquinistaId,
            certificacion_id: certificacionId,
            obligatoria: baseCert.obligatoria,
            vigilar_vencimiento: baseCert.vigilar_vencimiento,
            periodo_inactividad_meses: baseCert.periodo_inactividad_meses,
            aviso_dias: baseCert.aviso_dias,
            fecha_ultimo_servicio: fechaServicio,
          });

        if (error) throw error;
      } else {
        throw new Error('Certificación no encontrada');
      }

      toast({ title: 'Fecha de servicio actualizada' });
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error actualizando fecha:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la fecha',
      });
      return false;
    }
  };

  const quitarCertificacion = async (certificacionId: string): Promise<boolean> => {
    if (!maquinistaId) return false;

    try {
      const { error } = await supabase
        .from('maquinista_certificaciones')
        .delete()
        .eq('maquinista_id', maquinistaId)
        .eq('certificacion_id', certificacionId);

      if (error) throw error;

      toast({ title: 'Certificación eliminada' });
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error quitando certificación:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo quitar la certificación',
      });
      return false;
    }
  };

  const guardarCertificaciones = async (
    seleccionadas: Array<{
      certificacion_id: string;
      obligatoria: boolean;
      vigilar_vencimiento: boolean;
      periodo_inactividad_meses: number;
      aviso_dias: number;
      fecha_ultimo_servicio: string | null;
    }>
  ): Promise<boolean> => {
    if (!maquinistaId) return false;

    try {
      // Eliminar todas las existentes
      const { error: deleteError } = await supabase
        .from('maquinista_certificaciones')
        .delete()
        .eq('maquinista_id', maquinistaId);

      if (deleteError) throw deleteError;

      // Insertar las seleccionadas
      if (seleccionadas.length > 0) {
        const toInsert = seleccionadas.map(s => ({
          maquinista_id: maquinistaId,
          ...s,
        }));

        const { error: insertError } = await supabase
          .from('maquinista_certificaciones')
          .insert(toInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Certificaciones guardadas',
        description: `${seleccionadas.length} certificación(es) asignada(s)`,
      });
      await fetchData();
      return true;
    } catch (error) {
      console.error('Error guardando certificaciones:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron guardar las certificaciones',
      });
      return false;
    }
  };

  // KPIs
  const kpis = {
    total: certificaciones.length,
    vigentes: certificaciones.filter(c => c.estado === 'Vigente').length,
    proximasVencer: certificaciones.filter(c => c.estado === 'Próxima a vencer').length,
    vencidas: certificaciones.filter(c => c.estado === 'Vencida').length,
    obligatoriasFaltantes: disponibles.filter(d => d.obligatoria && !d.asignada).length,
  };

  return {
    certificaciones,
    disponibles,
    loading,
    kpis,
    refetch: fetchData,
    asignarCertificacion,
    actualizarFechaServicio,
    quitarCertificacion,
    guardarCertificaciones,
  };
}
