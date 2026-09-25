import { describe, it, expect } from 'vitest';
import { indicadoresDesdeDocs, indicadoresDesdeResumenes, agruparPorDocumento, docsDesdeDetalle, fmtPct } from '@/lib/docReglamentaria/resumen';

describe('resumen', () => {
  // Dos bases, dos documentos. A: 10 asignaciones/8 leídas (80%); B: 90/10 (11,1%).
  const filas = [
    { referencia: 'A', titulo: 'Doc A', incluidos: 1, recibidos: 0, abiertos: 1, leidos: 3 },
    { referencia: 'A', titulo: 'Doc A', incluidos: 0, recibidos: 0, abiertos: 0, leidos: 5 },
    { referencia: 'B', titulo: 'Doc B', incluidos: 40, recibidos: 30, abiertos: 10, leidos: 10 },
  ];
  it('porcentaje global = lecturas/asignaciones, no media de porcentajes', () => {
    const i = indicadoresDesdeDocs(filas)!;
    expect(i).toEqual({ asignaciones: 100, lecturas: 18, pendientes: 82, porcentaje: 0.18 });
    expect(fmtPct(i.porcentaje)).toMatch(/18,0/); // la media de 80% y 11,1% daría 45,6%
  });
  it('agrupa por documento', () => {
    const d = agruparPorDocumento(filas);
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ referencia: 'A', incluidos: 1, abiertos: 1, leidos: 8 });
  });
  it('sin datos ≠ cero', () => {
    expect(indicadoresDesdeDocs([])).toBeNull();
    const z = indicadoresDesdeDocs([{ incluidos: 0, recibidos: 0, abiertos: 0, leidos: 0 }])!;
    expect(z.asignaciones).toBe(0); expect(z.porcentaje).toBeNull(); expect(fmtPct(z.porcentaje)).toBe('—');
  });
  it('resúmenes y detalle', () => {
    expect(indicadoresDesdeResumenes([{ asignados: 4, leidos_total: 1 }, { asignados: 6, leidos_total: 6 }])).toEqual({ asignaciones: 10, lecturas: 7, pendientes: 3, porcentaje: 0.7 });
    const d = docsDesdeDetalle([{ referencia: 'X', titulo: 't', estado: 'leido' }, { referencia: 'X', titulo: 't', estado: 'abierto' }]);
    expect(d[0]).toMatchObject({ incluidos: 0, recibidos: 0, abiertos: 1, leidos: 1 });
  });
});
