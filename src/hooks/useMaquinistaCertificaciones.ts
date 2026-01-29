import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { addMonths, differenceInDays } from 'date-fns';

export interface MaquinistaCertificacionDB {
  id: string;
  maquinista_id: string;
  certificacion_id: string;
  certificacion_nombre: string;
  certificacion_tipo: 'vehiculo' | 'linea';
  obtenida: boolean;
  fecha_obtencion: string | null;
  fecha_ultimo_servicio: string | null;
}

export interface CertificacionConEstado extends MaquinistaCertificacionDB {
  obligatoria: boolean;
  vigilar_vencimiento: boolean;
  periodo_inactividad_meses: number;
  aviso_dias: number;
  estado: 'Vigente' | 'Próxima a vencer' | 'Vencida' | 'No aplica' | 'Pendiente';
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
  obtenida: boolean,
  fechaUltimoServicio: string | null,
  vigilarVencimiento: boolean,
  periodoInactividadMeses: number,
  avisoDias: number
): { estado: CertificacionConEstado['estado']; diasRestantes: number | null; fechaVencimiento: Date | null } {
  if (!obtenida) {
    return { estado: 'Pendiente', diasRestantes: null, fechaVencimiento: null };
  }

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
      // 1. Get base ID
      const { data: baseData, error: errorBase } = await supabase
        .from('bases_conduccion')
        .select('id')
        .eq('nombre', baseName)
        .maybeSingle();

      if (errorBase) throw errorBase;
      if (!baseData) {
        setCertificaciones([]);
        setDisponibles([]);
        setLoading(false);
        return;
      }

      // 2. Get base_certificaciones config
      const { data: baseCerts, error: errorBaseCerts } = await supabase
        .from('base_certificaciones')
        .select('*')
        .eq('base_id', baseData.id);

      if (errorBaseCerts) throw errorBaseCerts;
      const baseCertificaciones = baseCerts || [];

      // 3. Get maquinista's assigned certificaciones
      const { data: asignadas, error: errorAsignadas } = await supabase
        .from('maquinista_certificaciones')
        .select('*')
        .eq('maquinista_id', maquinistaId);

      if (errorAsignadas) throw errorAsignadas;

      // 4. Build certificaciones with state
      const certificacionesConEstado: CertificacionConEstado[] = baseCertificaciones.map(bc => {
        const asignada = asignadas?.find(a => a.certificacion_id === bc.certificacion_id);
        const obtenida = asignada?.obtenida ?? false;
        
        const fechaServicio = asignada?.fecha_ultimo_servicio || null;
        const vigilar = bc.vigilar_vencimiento;
        const periodo = bc.periodo_inactividad_meses;
        const aviso = bc.aviso_dias;

        const { estado, diasRestantes, fechaVencimiento } = calcularEstado(
          obtenida,
          fechaServicio,
          vigilar,
          periodo,
          aviso
        );

        return {
          id: asignada?.id || bc.id,
          maquinista_id: maquinistaId,
          certificacion_id: bc.certificacion_id,
          certificacion_nombre: bc.certificacion_nombre,
          certificacion_tipo: bc.certificacion_tipo as 'vehiculo' | 'linea',
          obtenida,
          fecha_obtencion: asignada?.fecha_obtencion || null,
          fecha_ultimo_servicio: fechaServicio,
          obligatoria: bc.obligatoria,
          vigilar_vencimiento: vigilar,
          periodo_inactividad_meses: periodo,
          aviso_dias: aviso,
          estado,
          dias_restantes: diasRestantes,
          fecha_vencimiento: fechaVencimiento,
        };
      });

      // 5. Build disponibles list
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

  const actualizarFechaServicio = async (
    certificacionId: string,
    fechaServicio: string
  ): Promise<boolean> => {
    if (!maquinistaId) return false;

    try {
      const baseCert = disponibles.find(d => d.id === certificacionId);
      
      const { data: existente } = await supabase
        .from('maquinista_certificaciones')
        .select('id')
        .eq('maquinista_id', maquinistaId)
        .eq('certificacion_id', certificacionId)
        .maybeSingle();

      if (existente) {
        const { error } = await supabase
          .from('maquinista_certificaciones')
          .update({ fecha_ultimo_servicio: fechaServicio })
          .eq('id', existente.id);

        if (error) throw error;
      } else if (baseCert) {
        const { error } = await supabase
          .from('maquinista_certificaciones')
          .insert([{
            maquinista_id: maquinistaId,
            certificacion_id: certificacionId,
            certificacion_nombre: baseCert.nombre,
            certificacion_tipo: baseCert.tipo,
            obtenida: true,
            fecha_ultimo_servicio: fechaServicio,
          }]);

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

  const toggleObtenida = async (certificacionId: string, obtenida: boolean): Promise<boolean> => {
    if (!maquinistaId) return false;

    try {
      if (obtenida) {
        const baseCert = disponibles.find(d => d.id === certificacionId);
        if (!baseCert) throw new Error('Certificación no encontrada');

        const { error } = await supabase
          .from('maquinista_certificaciones')
          .insert([{
            maquinista_id: maquinistaId,
            certificacion_id: certificacionId,
            certificacion_nombre: baseCert.nombre,
            certificacion_tipo: baseCert.tipo,
            obtenida: true,
            fecha_ultimo_servicio: null,
          }]);

        if (error) throw error;
        toast({ title: 'Certificación marcada como obtenida' });
      } else {
        const { error } = await supabase
          .from('maquinista_certificaciones')
          .delete()
          .eq('maquinista_id', maquinistaId)
          .eq('certificacion_id', certificacionId);

        if (error) throw error;
        toast({ title: 'Certificación desmarcada' });
      }

      await fetchData();
      return true;
    } catch (error) {
      console.error('Error toggling obtenida:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar la certificación',
      });
      return false;
    }
  };

  // KPIs
  const kpis = {
    total: certificaciones.length,
    obtenidas: certificaciones.filter(c => c.obtenida).length,
    vigentes: certificaciones.filter(c => c.estado === 'Vigente').length,
    proximasVencer: certificaciones.filter(c => c.estado === 'Próxima a vencer').length,
    vencidas: certificaciones.filter(c => c.estado === 'Vencida').length,
    obligatoriasFaltantes: certificaciones.filter(c => c.obligatoria && !c.obtenida).length,
  };

  return {
    certificaciones,
    disponibles,
    loading,
    kpis,
    refetch: fetchData,
    actualizarFechaServicio,
    quitarCertificacion,
    toggleObtenida,
  };
}
