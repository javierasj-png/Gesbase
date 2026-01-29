import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CertificacionDB {
  id: string;
  tipo: 'vehiculo' | 'linea';
  nombre: string;
  descripcion: string | null;
  created_at: string;
}

export interface CertificacionInput {
  id: string;
  tipo: 'vehiculo' | 'linea';
  nombre: string;
  descripcion?: string | null;
}

export function useCertificaciones() {
  const { toast } = useToast();
  const [certificaciones, setCertificaciones] = useState<CertificacionDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCertificaciones = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('certificaciones')
        .select('*')
        .order('tipo', { ascending: true })
        .order('nombre', { ascending: true });

      if (error) throw error;
      // Cast the tipo field since Supabase returns string but we know it's constrained
      const typedData = (data || []).map(cert => ({
        ...cert,
        tipo: cert.tipo as 'vehiculo' | 'linea',
      }));
      setCertificaciones(typedData);
    } catch (error) {
      console.error('Error fetching certificaciones:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las certificaciones',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCertificaciones();
  }, [fetchCertificaciones]);

  const createCertificacion = async (input: CertificacionInput): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('certificaciones')
        .insert({
          id: input.id,
          tipo: input.tipo,
          nombre: input.nombre,
          descripcion: input.descripcion || null,
        });

      if (error) throw error;

      toast({
        title: 'Certificación creada',
        description: `Se ha añadido "${input.nombre}" al catálogo`,
      });
      await fetchCertificaciones();
      return true;
    } catch (error: any) {
      console.error('Error creating certificacion:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message?.includes('duplicate') 
          ? 'Ya existe una certificación con ese ID'
          : 'No se pudo crear la certificación',
      });
      return false;
    }
  };

  const updateCertificacion = async (id: string, input: Partial<CertificacionInput>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('certificaciones')
        .update({
          tipo: input.tipo,
          nombre: input.nombre,
          descripcion: input.descripcion,
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Certificación actualizada',
        description: 'Los cambios se han guardado correctamente',
      });
      await fetchCertificaciones();
      return true;
    } catch (error: any) {
      console.error('Error updating certificacion:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message?.includes('duplicate') 
          ? 'Ya existe una certificación con ese nombre'
          : 'No se pudo actualizar la certificación',
      });
      return false;
    }
  };

  const deleteCertificacion = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('certificaciones')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Certificación eliminada',
      });
      await fetchCertificaciones();
      return true;
    } catch (error) {
      console.error('Error deleting certificacion:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo eliminar la certificación',
      });
      return false;
    }
  };

  return {
    certificaciones,
    loading,
    refetch: fetchCertificaciones,
    createCertificacion,
    updateCertificacion,
    deleteCertificacion,
  };
}
