import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Base } from '@/types';

export interface MaquinistaDB {
  id: string;
  matricula: string;
  nombre: string;
  apellidos: string;
  base: string;
  email: string | null;
  telefono: string | null;
  fecha_ingreso: string | null;
  fecha_primer_servicio: string | null;
  fecha_licencia_conduccion: string | null;
  observaciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Computed field for convenience
export interface MaquinistaConNombre extends MaquinistaDB {
  nombre_apellidos: string;
  bajo_pe_1603?: boolean;
}

export interface MaquinistaInput {
  matricula: string;
  nombreApellidos: string;
  base: Base;
  activo: boolean;
  observaciones?: string;
  bajoPE1603?: boolean;
  fechaPrimerServicio?: Date;
  fechaLicencia?: Date;
}

// Divide un nombre completo en (nombre, apellidos) siguiendo la convención española:
// los 2 últimos tokens son apellidos; las partículas (de, del, la, los, las, y, da, do, dos)
// se agrupan con el siguiente apellido. Ej.: "Juan Carlos Pérez de la Rosa" => nombre "Juan Carlos", apellidos "Pérez de la Rosa".
function splitNombreApellidos(full: string): { nombre: string; apellidos: string } {
  const tokens = full.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return { nombre: tokens[0] || '', apellidos: '' };
  if (tokens.length === 2) return { nombre: tokens[0], apellidos: tokens[1] };

  const particulas = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'van', 'von']);
  // Buscamos el inicio del primer apellido recorriendo desde el final hasta dejar al menos 2 apellidos.
  // Estrategia: tomar los últimos 2 tokens "no partícula" y arrastrar las partículas previas.
  let apellidosCount = 0;
  let cutIndex = tokens.length; // índice desde el que empieza el apellido
  for (let i = tokens.length - 1; i >= 1; i--) {
    const t = tokens[i].toLowerCase();
    cutIndex = i;
    if (!particulas.has(t)) apellidosCount++;
    if (apellidosCount >= 2 && !particulas.has(tokens[i - 1]?.toLowerCase() ?? '')) break;
  }
  if (cutIndex < 1) cutIndex = tokens.length - 2;
  return {
    nombre: tokens.slice(0, cutIndex).join(' '),
    apellidos: tokens.slice(cutIndex).join(' '),
  };
}

export function useMaquinistas() {

  const { user, isAdmin, assignedBases } = useAuth();
  const { toast } = useToast();
  const [maquinistas, setMaquinistas] = useState<MaquinistaConNombre[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMaquinistas = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase

        .from('maquinistas')
        .select('*');

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

      // Add computed nombre_apellidos field
      const maquinistasConNombre: MaquinistaConNombre[] = (data || []).map(m => ({
        ...m,
        nombre_apellidos: `${m.nombre} ${m.apellidos}`.trim(),
        bajo_pe_1603: false, // Will be calculated from expedientes
      }));

      // Orden alfabético robusto en español (maneja acentos, mayúsculas y nombres compuestos)
      maquinistasConNombre.sort((a, b) => {
        const aKey = `${a.apellidos ?? ''} ${a.nombre ?? ''}`.trim();
        const bKey = `${b.apellidos ?? ''} ${b.nombre ?? ''}`.trim();
        return aKey.localeCompare(bKey, 'es', { sensitivity: 'base', ignorePunctuation: true });
      });

      setMaquinistas(maquinistasConNombre);

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
      // Split nombre y apellidos
      const parts = input.nombreApellidos.trim().split(' ');
      const nombre = parts[0] || '';
      const apellidos = parts.slice(1).join(' ') || '';

      const insertData = {
        matricula: input.matricula,
        nombre,
        apellidos,
        base: input.base,
        activo: input.activo,
        observaciones: input.observaciones || null,
        bajo_pe_1603: input.bajoPE1603 ?? false,
        fecha_primer_servicio: input.fechaPrimerServicio 
          ? input.fechaPrimerServicio.toISOString().split('T')[0] 
          : null,
        fecha_licencia_conduccion: input.fechaLicencia
          ? input.fechaLicencia.toISOString().split('T')[0]
          : null,
      };

      const { error } = await supabase
        .from('maquinistas')
        .insert([insertData]);

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
        description: `${input.nombreApellidos} guardado correctamente`,
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
      const updateData: Record<string, unknown> = {};

      if (input.matricula !== undefined) updateData.matricula = input.matricula;
      if (input.nombreApellidos !== undefined) {
        const parts = input.nombreApellidos.trim().split(' ');
        updateData.nombre = parts[0] || '';
        updateData.apellidos = parts.slice(1).join(' ') || '';
      }
      if (input.base !== undefined) updateData.base = input.base;
      if (input.activo !== undefined) updateData.activo = input.activo;
      if (input.observaciones !== undefined) updateData.observaciones = input.observaciones || null;
      if (input.bajoPE1603 !== undefined) updateData.bajo_pe_1603 = input.bajoPE1603;
      if (input.fechaPrimerServicio !== undefined) {
        updateData.fecha_primer_servicio = input.fechaPrimerServicio 
          ? input.fechaPrimerServicio.toISOString().split('T')[0] 
          : null;
      }
      if (input.fechaLicencia !== undefined) {
        updateData.fecha_licencia_conduccion = input.fechaLicencia
          ? input.fechaLicencia.toISOString().split('T')[0]
          : null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase
        .from('maquinistas')
        .update(updateData as any)
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
