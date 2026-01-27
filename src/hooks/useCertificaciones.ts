import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CertificacionDB {
  id: string;
  tipo: 'vehiculo' | 'linea';
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface CertificacionInput {
  tipo: 'vehiculo' | 'linea';
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
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
          tipo: input.tipo,
          nombre: input.nombre,
          descripcion: input.descripcion || null,
          activo: input.activo ?? true,
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
          ? 'Ya existe una certificación con ese nombre'
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
          ...input,
          updated_at: new Date().toISOString(),
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

  const toggleActivo = async (id: string, currentActivo: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('certificaciones')
        .update({ activo: !currentActivo })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: currentActivo ? 'Certificación desactivada' : 'Certificación activada',
      });
      await fetchCertificaciones();
      return true;
    } catch (error) {
      console.error('Error toggling certificacion:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo cambiar el estado',
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
    toggleActivo,
    deleteCertificacion,
  };
}
