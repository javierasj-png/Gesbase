import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Base, Maquinista } from '@/types';

/**
 * Hook para filtrar datos según las bases asignadas al usuario actual.
 * - Admin: ve todo
 * - Mando: solo ve datos de sus bases asignadas
 */
export function useBaseFilter() {
  const { isAdmin, assignedBases, canAccessBase } = useAuth();

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
    const allBases: Base[] = [
      'Madrid-Chamartín',
      'Barcelona-Sants',
      'Sevilla-Santa Justa',
      'Valencia-Joaquín Sorolla'
    ];
    
    if (isAdmin) return allBases;
    return assignedBases;
  }, [isAdmin, assignedBases]);

  return {
    filterByBase,
    filterMaquinistas,
    getAccessibleBases,
    canAccessBase,
    isAdmin,
    assignedBases,
  };
}
