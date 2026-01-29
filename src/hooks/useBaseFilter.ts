import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Base, Maquinista } from '@/types';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para filtrar datos según las bases asignadas al usuario actual.
 * - Admin: ve todas las bases activas de bases_conduccion
 * - Mando: solo ve datos de sus bases asignadas
 */
export function useBaseFilter() {
  const { isAdmin, assignedBases, canAccessBase } = useAuth();
  const [basesFromDB, setBasesFromDB] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar bases desde la BD
  useEffect(() => {
    async function fetchBases() {
      const { data, error } = await supabase
        .from('bases_conduccion')
        .select('nombre')
        .eq('activa', true)
        .order('nombre');

      if (!error && data) {
        setBasesFromDB(data.map(b => b.nombre));
      }
      setLoading(false);
    }

    fetchBases();
  }, []);

  const filterByBase = useMemo(() => {
    return <T extends { base?: Base | string }>(items: T[]): T[] => {
      if (isAdmin) return items;
      return items.filter(item => {
        if (!item.base) return false;
        return assignedBases.includes(item.base as Base);
      });
    };
  }, [isAdmin, assignedBases]);

  const filterMaquinistas = useMemo(() => {
    return (maquinistas: Maquinista[]): Maquinista[] => {
      if (isAdmin) return maquinistas;
      return maquinistas.filter(m => assignedBases.includes(m.base));
    };
  }, [isAdmin, assignedBases]);

  const getAccessibleBases = useMemo(() => {
    if (isAdmin) return basesFromDB;
    // Para mandos, filtrar solo las bases asignadas que existan en BD
    return assignedBases.filter(b => basesFromDB.includes(b));
  }, [isAdmin, assignedBases, basesFromDB]);

  return {
    filterByBase,
    filterMaquinistas,
    getAccessibleBases,
    canAccessBase,
    isAdmin,
    assignedBases,
    loading,
  };
}
