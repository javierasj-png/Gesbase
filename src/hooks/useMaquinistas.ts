import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Base } from '@/types';

export interface MaquinistaDB {
  id: string;
  matricula: string;
  nombre_apellidos: string;
  base: string;
  activo: boolean;
  observaciones: string | null;
  bajo_pe_1603: boolean;
  fecha_primer_servicio: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface MaquinistaInput {
  matricula: string;
  nombreApellidos: string;
  base: Base;
  activo: boolean;
  observaciones?: string;
  bajoPE1603?: boolean;
  fechaPrimerServicio?: Date;
}

export function useMaquinistas() {
  const { user, isAdmin, assignedBases } = useAuth();
  const { toast } = useToast();
  const [maquinistas, setMaquinistas] = useState<MaquinistaDB[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaquinistas = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('maquinistas')
        .select('*')
        .order('nombre_apellidos');

      // Si no es admin, filtrar por bases asignadas
      if (!isAdmin && assignedBases.length > 0) {
        query = query.in('base', assignedBases);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching maquinistas:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los maquinistas',
          variant: 'destructive',
        });
        return;
      }

      setMaquinistas(data || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, assignedBases, toast]);

  useEffect(() => {
    if (user) {
      fetchMaquinistas();
    }
  }, [user, fetchMaquinistas]);

  const createMaquinista = async (input: MaquinistaInput): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('maquinistas')
        .insert({
          matricula: input.matricula,
          nombre_apellidos: input.nombreApellidos,
          base: input.base,
          activo: input.activo,
          observaciones: input.observaciones || null,
          bajo_pe_1603: input.bajoPE1603 || false,
          fecha_primer_servicio: input.fechaPrimerServicio 
            ? input.fechaPrimerServicio.toISOString().split('T')[0] 
            : null,
          created_by: user?.id,
          updated_by: user?.id,
        });

      if (error) {
        console.error('Error creating maquinista:', error);
        if (error.code === '23505') {
          toast({
            title: 'Error',
            description: 'Ya existe un maquinista con esa matrícula',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error',
            description: 'No se pudo crear el maquinista',
            variant: 'destructive',
          });
        }
        return false;
      }

      toast({
        title: 'Maquinista creado',
        description: input.bajoPE1603 
          ? `${input.nombreApellidos} guardado y asignado a vigilancia PE 16.03`
          : `${input.nombreApellidos} guardado correctamente`,
      });

      await fetchMaquinistas();
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  const updateMaquinista = async (id: string, input: Partial<MaquinistaInput>): Promise<boolean> => {
    try {
      const updateData: Record<string, unknown> = {
        updated_by: user?.id,
      };

      if (input.matricula !== undefined) updateData.matricula = input.matricula;
      if (input.nombreApellidos !== undefined) updateData.nombre_apellidos = input.nombreApellidos;
      if (input.base !== undefined) updateData.base = input.base;
      if (input.activo !== undefined) updateData.activo = input.activo;
      if (input.observaciones !== undefined) updateData.observaciones = input.observaciones || null;
      if (input.bajoPE1603 !== undefined) updateData.bajo_pe_1603 = input.bajoPE1603;
      if (input.fechaPrimerServicio !== undefined) {
        updateData.fecha_primer_servicio = input.fechaPrimerServicio 
          ? input.fechaPrimerServicio.toISOString().split('T')[0] 
          : null;
      }

      const { error } = await supabase
        .from('maquinistas')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('Error updating maquinista:', error);
        toast({
          title: 'Error',
          description: 'No se pudo actualizar el maquinista',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Maquinista actualizado',
        description: 'Cambios guardados correctamente',
      });

      await fetchMaquinistas();
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  const deleteMaquinista = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('maquinistas')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting maquinista:', error);
        toast({
          title: 'Error',
          description: 'No se pudo eliminar el maquinista',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Maquinista eliminado',
        description: 'El maquinista ha sido eliminado',
      });

      await fetchMaquinistas();
      return true;
    } catch (error) {
      console.error('Error:', error);
      return false;
    }
  };

  const toggleActivo = async (id: string, currentActivo: boolean): Promise<boolean> => {
    return updateMaquinista(id, { activo: !currentActivo });
  };

  return {
    maquinistas,
    loading,
    createMaquinista,
    updateMaquinista,
    deleteMaquinista,
    toggleActivo,
    refetch: fetchMaquinistas,
  };
}
