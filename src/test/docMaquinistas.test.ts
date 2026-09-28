import { describe, it, expect } from 'vitest';
import { construirSeguimiento, cifras } from '@/lib/docReglamentaria/maquinistas';

const maestros = [
  { id: 'm1', matricula: '0012345', nombre: 'Ana', apellidos: 'Pérez', base: 'Irún' },
  { id: 'm2', matricula: '0099999', nombre: 'Luis', apellidos: 'Gómez', base: 'Irún' },
  { id: 'm3', matricula: '12345', nombre: 'Ana', apellidos: 'Pérez Bis', base: 'Irún' },
];
const B = 'Irún';
const res = [
  { matricula: '0012345', nombre: 'PEREZ, ANA', asignados: 3, leidos_total: 2, base: B },  // coincide con detalle
  { matricula: '0099999', nombre: 'GOMEZ, LUIS', asignados: 5, leidos_total: 5, base: B }, // discrepa
  { matricula: '7777777', nombre: 'Ana Pérez', asignados: 4, leidos_total: 1, base: B },   // desconocida (mismo nombre, no se vincula)
  { matricula: '0055555', nombre: null, asignados: 2, leidos_total: 0, base: B },
];
const det = [
  { matricula: '0012345', nombre: null, referencia: 'A', titulo: 'Doc A', estado: 'leido', base: B },
  { matricula: '0012345', nombre: null, referencia: 'B', titulo: 'Doc B', estado: 'leido', base: B },
  { matricula: '0012345', nombre: null, referencia: 'C', titulo: 'Doc C', estado: 'abierto', base: B },
  { matricula: '0099999', nombre: null, referencia: 'A', titulo: 'Doc A', estado: 'leido', base: B },
  { matricula: '0099999', nombre: null, referencia: 'B', titulo: 'Doc B', estado: 'incluido', base: B },
];
const filas = construirSeguimiento(res, det, maestros);
const f = (m: string) => filas.find(x => x.matricula === m)!;

describe('seguimiento por maquinista', () => {
  it('coincidencia exacta por matrícula texto (no 12345 ≠ 0012345)', () => {
    expect(f('0012345').maestro?.id).toBe('m1');
    expect(cifras(f('0012345'))).toEqual({ asignaciones: 3, lecturas: 2, pendientes: 1, porcentaje: 2 / 3 });
    expect(f('0012345').pendientesDetalle.map(p => p.referencia)).toEqual(['C']);
  });
  it('matrícula desconocida: sin vínculo aunque el nombre coincida', () => {
    expect(f('7777777').maestro).toBeNull();
    expect(filas[0].maestro).toBeNull(); // sin correspondencia primero
  });
  it('solo resumen: sin detalle', () => {
    expect(f('0055555').detalle).toBeNull();
    expect(cifras(f('0055555'))).toMatchObject({ asignaciones: 2, lecturas: 0, pendientes: 2 });
  });
  it('discrepancia: no se suman ni resuelven', () => {
    const d = f('0099999');
    expect(d.discrepancia).toBe(true);
    expect(d.resumen).toEqual({ asignaciones: 5, lecturas: 5 });
    expect(d.detalle).toEqual({ asignaciones: 2, lecturas: 1 });
    expect(cifras(d)).toBeNull();
  });
});
