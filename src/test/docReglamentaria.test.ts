import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseMatrix, baseFromName, dateFromName } from '@/lib/docReglamentaria/parser';

// Datos sintéticos, sin personas reales.
const toMatrix = (aoa: unknown[][], csv = false) => {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'H');
  const buf = csv ? XLSX.utils.sheet_to_csv(ws) : XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const rb = XLSX.read(buf, { type: csv ? 'string' : 'array', raw: true });
  return XLSX.utils.sheet_to_json(rb.Sheets[rb.SheetNames[0]], { header: 1, raw: false, defval: '' }) as unknown[][];
};

describe('nombres', () => {
  it('base y fecha', () => {
    expect(baseFromName('2026 09 22/Seguimiento docs. area  STD PRUEBA.xlsx')).toBe('STD PRUEBA');
    expect(baseFromName('Seguimiento maqs. área Base X.csv')).toBe('Base X');
    expect(dateFromName('2026 09 22/Seguimiento docs.xlsx')).toBe('2026-09-22');
    expect(dateFromName('sin fecha.xlsx')).toBe('');
  });
});

describe('agregado (docs)', () => {
  const head = ['Referencia', 'Título', 'Subcarpeta', 'F. Entrada Vigor', 'Incluidos', 'Recibidos', 'Abiertos', 'Leidos'];
  it('lee correctamente', () => {
    const r = parseMatrix(toMatrix([head, ['DOC-1', 'Doc uno', 'AVISOS', '01/01/2026', 1, 2, 3, 4]]), { name: 'Seguimiento docs. area ZZ.xlsx' });
    expect(r.modo).toBe('agregado'); expect(r.errores).toEqual([]);
    expect(r.agregados[0]).toMatchObject({ referencia: 'DOC-1', incluidos: 1, leidos: 4 }); expect(r.baseOrigen).toBe('ZZ');
  });
  it('detecta negativos, no enteros y duplicados', () => {
    const r = parseMatrix(toMatrix([head, ['A', 't', '', '', -1, 0, 0, 0], ['B', 't', '', '', 'x', 0, 0, 0], ['C', 't', '', '', 0, 0, 0, 1], ['C', 't', '', '', 0, 0, 0, 1]]), { name: 'f.xlsx' });
    expect(r.errores.join()).toMatch(/negativo/); expect(r.errores.join()).toMatch(/no es un entero/); expect(r.errores.join()).toMatch(/repetida/);
    expect(r.agregados).toHaveLength(1);
  });
});

describe('resumen (maqs)', () => {
  it('conserva matrícula como texto con ceros (CSV)', () => {
    const r = parseMatrix(toMatrix([['Matrícula', 'Nombre', 'Base de conducción', 'Enviados', 'Leídos'], ['0012345', 'Persona Prueba', 'ZZ', 10, 7]], true), { name: 'x.csv' });
    expect(r.modo).toBe('resumen_maquinista'); expect(r.errores).toEqual([]);
    expect(r.resumenes[0].matricula).toBe('0012345'); expect(typeof r.resumenes[0].matricula).toBe('string');
  });
  it('estados como recuentos y leídos > asignados', () => {
    const r = parseMatrix(toMatrix([['Matrícula', 'Nombre', 'Incluidos', 'Recibidos', 'Abiertos', 'Leídos'], ['1', 'A', 1, 1, 1, 2]]), { name: 'x' });
    expect(r.resumenes[0]).toMatchObject({ asignados: 5, leidosTotal: 2 });
    const r2 = parseMatrix(toMatrix([['Matrícula', 'Nombre', 'Enviados', 'Leídos'], ['1', 'A', 3, 5]]), { name: 'x' });
    expect(r2.errores.join()).toMatch(/más leídos/); expect(r2.resumenes).toHaveLength(0);
  });
});

describe('detalle individual', () => {
  it('lee estados y rechaza inválidos', () => {
    const r = parseMatrix(toMatrix([['Referencia', 'Título', 'Matrícula', 'Agente', 'Estado'], ['D1', 't', '001', 'A', 'Leído'], ['D2', 't', '001', 'A', 'Perdido']]), { name: 'x' });
    expect(r.modo).toBe('detalle_agente'); expect(r.detalle[0]).toMatchObject({ matricula: '001', estado: 'leido' });
    expect(r.errores.join()).toMatch(/Estado debe ser/);
  });
});

describe('formato inválido', () => {
  it('sin columnas reconocidas', () => {
    const r = parseMatrix(toMatrix([['Foo', 'Bar'], [1, 2]]), { name: 'x' });
    expect(r.modo).toBeNull(); expect(r.errores[0]).toMatch(/Formato no reconocido/);
  });
});
