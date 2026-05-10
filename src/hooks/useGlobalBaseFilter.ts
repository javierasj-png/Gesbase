import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'gesbase:globalBaseFilter';
const EVENT_NAME = 'gesbase:globalBaseFilterChange';

function readInitial(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'all';
  } catch {
    return 'all';
  }
}

/**
 * Filtro de base persistente y compartido entre páginas (Dashboard, Maquinistas,
 * Certificaciones por base nombre, PE 16.03, PE 12.01, Auditoría).
 * Se sincroniza vía localStorage + evento custom para todas las pestañas/menus.
 */
export function useGlobalBaseFilter(): [string, (v: string) => void] {
  const [value, setValue] = useState<string>(readInitial);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === 'string') setValue(detail);
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setValue(e.newValue || 'all');
    };
    window.addEventListener(EVENT_NAME, handler as EventListener);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler as EventListener);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const update = useCallback((v: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
    setValue(v);
    window.dispatchEvent(new CustomEvent<string>(EVENT_NAME, { detail: v }));
  }, []);

  return [value, update];
}
