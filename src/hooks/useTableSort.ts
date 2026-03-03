import { useState, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

export function useTableSort<T>(items: T[], defaultKey?: keyof T | string) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultKey || '',
    direction: null,
  });

  const requestSort = (key: keyof T | string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        // Cycle: asc → desc → null
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: '', direction: null };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortedItems = useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) return items;

    return [...items].sort((a, b) => {
      const key = sortConfig.key as string;
      // Support nested keys with dot notation or direct access
      const aVal = (a as any)[key];
      const bVal = (b as any)[key];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (typeof aVal === 'boolean' && typeof bVal === 'boolean') {
        comparison = aVal === bVal ? 0 : aVal ? -1 : 1;
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' });
      }

      return sortConfig.direction === 'desc' ? -comparison : comparison;
    });
  }, [items, sortConfig]);

  return { sortedItems, sortConfig, requestSort };
}
