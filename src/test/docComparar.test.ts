import { describe, it, expect } from 'vitest';
import { compararDetalle, compararAgregados, compararResumenes, evolucion, ratioDocumento, ratioMaquinista } from '@/lib/docReglamentaria/comparar';

const d = (matricula: string, referencia: string, estado: string) => ({ matricula, nombre: null, referencia, titulo: null, estado });

describe('comparar sondeos', () => {
  it('clasifica documentos comunes por lectura relativa y separa altas y bajas', () => {
    const fila = (referencia: string, leidos: number, incluidos: number) => ({ referencia, titulo: null, leidos, incluidos, recibidos: 0, abiertos: 0 });
    const x = evolucion<ReturnType<typeof fila>>([fila('A', 1, 3), fila('B', 3, 1), fila('C', 1, 1), fila('D', 0, 0), fila('RET', 0, 1)],
      [fila('A', 2, 2), fila('B', 2, 2), fila('C', 2, 2), fila('D', 1, 0), fila('NEW', 0, 1)], x => x.referencia, ratioDocumento);
    expect(x.comunes.map(r => r.tendencia)).toEqual(['mejora', 'empeora', 'igual', 'sin_datos']);
    expect(x.nuevos.map(r => r.referencia)).toEqual(['NEW']);
    expect(x.retirados.map(r => r.referencia)).toEqual(['RET']);
  });
  it('compara porcentajes individuales aunque cambie el número de asignaciones', () => {
    const x = evolucion<{ matricula: string; asignados: number; leidos_total: number }>([{ matricula: '1', asignados: 2, leidos_total: 1 }], [{ matricula: '1', asignados: 4, leidos_total: 2 }], r => r.matricula, ratioMaquinista);
    expect(x.comunes[0].tendencia).toBe('igual');
  });
  it('detalle: nuevas, retiradas, pendientes que pasan a leídas y que siguen pendientes', () => {
    const antes = [d('01', 'A', 'abierto'), d('01', 'B', 'incluido'), d('02', 'A', 'recibido'), d('02', 'C', 'leido')];
    const despues = [d('01', 'A', 'leido'), d('01', 'B', 'incluido'), d('02', 'C', 'leido'), d('03', 'A', 'incluido')];
    const c = compararDetalle(antes, despues);
    expect(c.aparecen.map(x => x.clave)).toEqual(['03|A']);
    expect(c.desaparecen.map(x => x.clave)).toEqual(['02|A']); // retirada, NO leída
    expect(c.cambian.map(x => x.clave)).toEqual(['01|A']);
    expect(c.nuevasLecturas).toBe(1);
    expect(c.iguales).toBe(2);
    expect(c.antes).toEqual({ asignaciones: 4, lecturas: 1, pendientes: 3, porcentaje: 0.25 });
    expect(c.despues).toEqual({ asignaciones: 4, lecturas: 2, pendientes: 2, porcentaje: 0.5 });
  });
  it('desaparecido no cuenta como lectura', () => {
    const c = compararDetalle([d('01', 'A', 'incluido')], []);
    expect(c.despues.lecturas).toBe(0);
    expect(c.nuevasLecturas).toBe(0);
    expect(c.despues.porcentaje).toBeNull();
  });
  it('agregado: solo documentos, sin agentes', () => {
    const a = [{ referencia: 'A', titulo: null, incluidos: 5, recibidos: 0, abiertos: 0, leidos: 5 }, { referencia: 'X', titulo: null, incluidos: 1, recibidos: 0, abiertos: 0, leidos: 0 }];
    const b = [{ referencia: 'A', titulo: null, incluidos: 2, recibidos: 0, abiertos: 0, leidos: 8 }, { referencia: 'N', titulo: null, incluidos: 3, recibidos: 0, abiertos: 0, leidos: 0 }];
    const c = compararAgregados(a, b);
    expect(c.aparecen.map(x => x.clave)).toEqual(['N']);
    expect(c.desaparecen.map(x => x.clave)).toEqual(['X']);
    expect(c.cambian.map(x => x.clave)).toEqual(['A']);
    expect(c.antes.pendientes).toBe(6); expect(c.despues.pendientes).toBe(5);
  });
  it('resumen por maquinista', () => {
    const c = compararResumenes([{ matricula: '01', nombre: null, asignados: 4, leidos_total: 1 }], [{ matricula: '01', nombre: null, asignados: 4, leidos_total: 3 }, { matricula: '02', nombre: null, asignados: 2, leidos_total: 0 }]);
    expect(c.cambian).toHaveLength(1); expect(c.aparecen).toHaveLength(1);
    expect(c.despues).toEqual({ asignaciones: 6, lecturas: 3, pendientes: 3, porcentaje: 0.5 });
  });
});
