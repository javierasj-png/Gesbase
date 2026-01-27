import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface BaseCertificacionDB {
  id: string;
  base_id: string;
  certificacion_id: string;
  certificacion_nombre: string;
  certificacion_tipo: 'vehiculo' | 'linea';
  obligatoria: boolean;
  vigilar_vencimiento: boolean;
  periodo_inactividad_meses: number;
  aviso_dias: number;
}

export interface BaseConduccionDB {
  id: string;
  nombre: string;
  codigo: string | null;
  activa: boolean;
}

export interface CertificacionPorBase {
  base: BaseConduccionDB;
  certificaciones: BaseCertificacionDB[];
  totalObligatorias: number;
  totalVigiladas: number;
}

export function useBaseCertificaciones() {
  const { isAdmin, assignedBases } = useAuth();
  const { toast } = useToast();
  const [certificacionesPorBase, setCertificacionesPorBase] = useState<CertificacionPorBase[]>([]);
  const [allCertificaciones, setAllCertificaciones] = useState<BaseCertificacionDB[]>([]);
  const [bases, setBases] = useState<BaseConduccionDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch bases activas
      const { data: basesData, error: basesError } = await supabase
        .from('bases_conduccion')
        .select('*')
        .eq('activa', true)
        .order('nombre');

      if (basesError) {
        console.error('Error fetching bases:', basesError);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las bases',
          variant: 'destructive',
        });
        return;
      }

      // Fetch todas las certificaciones asignadas
      const { data: certsData, error: certsError } = await supabase
        .from('base_certificaciones')
        .select('*');

      if (certsError) {
        console.error('Error fetching certificaciones:', certsError);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las certificaciones',
          variant: 'destructive',
        });
        return;
      }

      const allBases = (basesData || []) as BaseConduccionDB[];
      const allCerts = (certsData || []) as BaseCertificacionDB[];

      // Filtrar por bases accesibles si no es admin
      const accessibleBases = isAdmin 
        ? allBases 
        : allBases.filter(b => assignedBases.includes(b.nombre as typeof assignedBases[number]));

      // Agrupar certificaciones por base
      const porBase: CertificacionPorBase[] = accessibleBases.map(base => {
        const certs = allCerts.filter(c => c.base_id === base.id);
        return {
          base,
          certificaciones: certs,
          totalObligatorias: certs.filter(c => c.obligatoria).length,
          totalVigiladas: certs.filter(c => c.vigilar_vencimiento).length,
        };
      });

      setBases(accessibleBases);
      setAllCertificaciones(allCerts.filter(c => 
        accessibleBases.some(b => b.id === c.base_id)
      ));
      setCertificacionesPorBase(porBase);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, assignedBases, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPIs
  const kpis = {
    totalBases: bases.length,
    totalCertificaciones: allCertificaciones.length,
    totalObligatorias: allCertificaciones.filter(c => c.obligatoria).length,
    totalVigiladas: allCertificaciones.filter(c => c.vigilar_vencimiento).length,
  };

  return {
    certificacionesPorBase,
    allCertificaciones,
    bases,
    loading,
    kpis,
    refetch: fetchData,
  };
}
