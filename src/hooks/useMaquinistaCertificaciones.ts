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
      // Obtener certificaciones asignadas al maquinista
      const { data: asignadas, error: errorAsignadas } = await supabase
        .from('maquinista_certificaciones')
        .select('*')
        .eq('maquinista_id', maquinistaId);

      if (errorAsignadas) throw errorAsignadas;

      // Obtener el catálogo de certificaciones
      const { data: catalogo, error: errorCatalogo } = await supabase
        .from('certificaciones')
        .select('*')
        .eq('activo', true);

      if (errorCatalogo) throw errorCatalogo;

      // Obtener la base y sus certificaciones configuradas
      const { data: baseData, error: errorBase } = await supabase
        .from('bases_conduccion')
        .select('id')
        .eq('nombre', baseName)
        .maybeSingle();

      if (errorBase) throw errorBase;

      let baseCertificaciones: any[] = [];
      if (baseData) {
        const { data: baseCerts, error: errorBaseCerts } = await supabase
          .from('base_certificaciones')
          .select('*')
          .eq('base_id', baseData.id);

        if (!errorBaseCerts) {
          baseCertificaciones = baseCerts || [];
        }
      }

      // Procesar certificaciones asignadas con su estado
      const certificacionesConEstado: CertificacionConEstado[] = (asignadas || []).map(mc => {
        const cert = catalogo?.find(c => c.id === mc.certificacion_id);
        const { estado, diasRestantes, fechaVencimiento } = calcularEstado(
          mc.fecha_ultimo_servicio,
          mc.vigilar_vencimiento,
          mc.periodo_inactividad_meses,
          mc.aviso_dias
        );

        return {
          ...mc,
          certificacion_nombre: cert?.nombre || 'Desconocida',
          certificacion_tipo: (cert?.tipo as 'vehiculo' | 'linea') || 'vehiculo',
          estado,
          dias_restantes: diasRestantes,
          fecha_vencimiento: fechaVencimiento,
        };
      });

      // Crear lista de certificaciones disponibles (del catálogo que están en la base)
      const disponiblesData: CertificacionDisponible[] = (catalogo || []).map(cert => {
        const baseCert = baseCertificaciones.find(bc => bc.certificacion_id === cert.id);
        const asignada = asignadas?.find(a => a.certificacion_id === cert.id);

        return {
          id: cert.id,
          nombre: cert.nombre,
          tipo: cert.tipo as 'vehiculo' | 'linea',
          obligatoria: baseCert?.obligatoria ?? false,
          vigilar_vencimiento: baseCert?.vigilar_vencimiento ?? true,
          periodo_inactividad_meses: baseCert?.periodo_inactividad_meses ?? 12,
          aviso_dias: baseCert?.aviso_dias ?? 30,
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
      const { error } = await supabase
        .from('maquinista_certificaciones')
        .update({ fecha_ultimo_servicio: fechaServicio })
        .eq('maquinista_id', maquinistaId)
        .eq('certificacion_id', certificacionId);

      if (error) throw error;

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
