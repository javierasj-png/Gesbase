import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'gesbase:globalYearFilter';
const EVENT_NAME = 'gesbase:globalYearFilterChange';

function readInitial(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) return n;
    }
  } catch {
    /* ignore */
  }
  return new Date().getFullYear();
}

/**
 * Filtro de año persistente y compartido entre páginas para el Plan de Acción Anual
 * y el cuadro de mando. No afecta a PE 16.03 / PE 12.01 (que tienen su propia ventana temporal).
 */
export function useYearFilter(): [number, (v: number) => void] {
  const [value, setValue] = useState<number>(readInitial);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === 'number') setValue(detail);
    };
    const storageHandler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const n = parseInt(e.newValue, 10);
        if (!Number.isNaN(n)) setValue(n);
      }
    };
    window.addEventListener(EVENT_NAME, handler as EventListener);
    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler as EventListener);
      window.removeEventListener('storage', storageHandler);
    };
  }, []);

  const update = useCallback((v: number) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* ignore */
    }
    setValue(v);
    window.dispatchEvent(new CustomEvent<number>(EVENT_NAME, { detail: v }));
  }, []);

  return [value, update];
}

/** Lista de años disponibles en el selector (año actual ± unos años). */
export function getAvailableYears(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  // From 2024 (arranque del sistema) hasta año actual + 1
  for (let y = 2024; y <= current + 1; y++) years.push(y);
  return years.reverse(); // más reciente arriba
}
