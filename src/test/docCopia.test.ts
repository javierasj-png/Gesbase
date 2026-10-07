import { describe, it, expect } from 'vitest';
import { leerCopia, clasificarActuacion, construirExportacion, esJustificanteCopia } from '@/lib/docReglamentaria/copia';
import type { Actuacion } from '@/lib/docReglamentaria/justificaciones';

const copia = {
  version: 1,
  organization: { 'IR CER': { base: 'Irún' } },
  files: [
    { hash: 'h1', name: 'agg IR.xlsx', period: '2026-09-22', area: 'IR CER', mode: 'aggregate', rows: [{ ref: 'AV-1', title: 'Aviso', effective: '01/01/2025', type: 'AVISOS', n: [1, 0, 0, 9] }, { ref: 'CR-2', title: 'Consigna', type: 'CONSIGNAS', n: [2, 1, 0, 7] }] },
    { hash: 'h2', name: 'ind.xlsx', period: '2026-09-22', area: 'IR CER', mode: 'individual', rows: [{ agentId: '0012345', agent: 'RUIZ ANA', ref: 'AV-1', title: 'Aviso', n: [0, 0, 0, 1] }] },
    { hash: 'h3', name: 'mal.xlsx', period: '2026-13-01', area: 'XX', mode: 'aggregate', rows: [{ ref: 'A', n: [-1, 0, 0, 0] }] },
  ],
  roster: [{ agentId: '0012345', agent: 'RUIZ ANA', area: 'IR CER', email: 'ana@renfe.es' }],
  agentSummaries: [{ agentId: '0012345', area: 'IR CER', period: '2026-09-22', assigned: 10, read: 9, n: [1, 0, 0, 9], source: 'x' }],
  notes: [
    { id: 'n1', created: '2026-09-23T10:00:00Z', area: 'IR CER', status: 'Baja IT', date: '2026-09-20', owner: 'Mando', agentId: '0012345', agent: 'RUIZ ANA', ref: '', until: '2026-10-31', period: '2026-09-22', comment: 'IT' },
    { id: 'n2', created: '2026-09-23T10:00:00Z', area: 'IR CER', status: 'Estado de la base comunicado', date: '2026-09-23', communicationDate: '2026-09-23', channel: 'Teléfono', owner: 'Mando', agentId: '', agent: '', ref: '', until: '', period: '2026-09-22', comment: 'Resumen' },
    { id: 'n3', created: '2026-09-23T10:00:00Z', area: 'IR CER', status: 'Aviso enviado', date: '2026-09-23', owner: 'Mando', agentId: '9', agent: '', ref: '', comment: '' },
  ],
};

const act = (p: Partial<Actuacion>): Actuacion => ({ id: 'x', base_nombre: 'Irún', matricula: null, nombre: null, referencia: null, responsable: 'r', fecha_actuacion: '2026-09-20', fecha_comunicacion: null, canal: null, estado: 'Situación temporal - recuperación pendiente', vigencia_hasta: null, comentario: null, no_computa: false, periodo: '2026-09-22', created_at: '', updated_at: '', created_by: null, updated_by: null, ...p });

describe('copias del tablero', () => {
  const c = leerCopia(JSON.stringify(copia));
  it('rechaza archivos que no son copia v1', () => {
    expect(() => leerCopia('{"version":2}')).toThrow(/incompatible/);
    expect(() => leerCopia('no json')).toThrow(/JSON/);
  });
  it('vista previa: sondeos de las tres modalidades, errores y orígenes', () => {
    expect(c.sondeos.map(s => s.modo).sort()).toEqual(['agregado', 'agregado', 'detalle_agente', 'resumen_maquinista']);
    const agg = c.sondeos.find(s => s.origen === 'IR CER' && s.modo === 'agregado')!;
    expect(agg.errores).toEqual([]);
    expect(agg.filas[1]).toMatchObject({ referencia: 'CR-2', incluidos: 2, recibidos: 1, leidos: 7 });
    expect(c.sondeos.find(s => s.modo === 'detalle_agente')!.filas[0]).toMatchObject({ matricula: '0012345', estado: 'leido' });
    expect(c.sondeos.find(s => s.modo === 'resumen_maquinista')!.filas[0]).toMatchObject({ matricula: '0012345', asignados: 10, leidosTotal: 9, nombre: 'RUIZ ANA' });
    expect(c.sondeos.find(s => s.origen === 'XX')!.errores.length).toBeGreaterThan(0);
    expect(c.origenes).toEqual(['IR CER', 'XX']);
    expect(c.agentes[0]).toMatchObject({ matricula: '0012345', email: 'ana@renfe.es' });
  });
  it('actuaciones: no computa según el tablero y validación de comunicaciones', () => {
    expect(c.actuaciones[0]).toMatchObject({ no_computa: true, vigencia_hasta: '2026-10-31', matricula: '0012345' });
    expect(c.actuaciones[1]).toMatchObject({ matricula: null, estado: 'Estado de la base comunicado', canal: 'Teléfono', errores: [] });
    expect(c.actuaciones[2].errores).toContain('Falta la fecha de comunicación.');
    expect(esJustificanteCopia({ agentId: '1', status: 'Otra situación', comment: 'es MMII' })).toBe(true);
    expect(esJustificanteCopia({ agentId: '1', status: 'Baja IT', excluded: false })).toBe(false);
    expect(esJustificanteCopia({ agentId: '', status: 'Baja IT' })).toBe(false);
  });
  it('duplicados y conflictos frente a lo ya guardado', () => {
    const a = c.actuaciones[0];
    expect(clasificarActuacion(a, 'Irún', []).clase).toBe('nueva');
    expect(clasificarActuacion(a, 'Irún', [act({ matricula: '0012345', comentario: 'IT' })]).clase).toBe('duplicada');
    expect(clasificarActuacion(a, 'Irún', [act({ matricula: '0012345', estado: 'Vacaciones' })]).clase).toBe('conflicto');
    expect(clasificarActuacion(a, 'Olabeaga', [act({ matricula: '0012345', estado: 'Vacaciones' })]).clase).toBe('nueva');
  });
  it('exportación reimportable con el mismo formato', () => {
    const json = construirExportacion({
      sondeos: [{ id: 's1', fecha_sondeo: '2026-09-22', base_nombre: 'Irún', modo: 'agregado', nombre_archivo: 'a', hash_archivo: 'h' }, { id: 's2', fecha_sondeo: '2026-09-22', base_nombre: 'Irún', modo: 'resumen_maquinista', nombre_archivo: 'b', hash_archivo: 'h2' }],
      agregados: [{ sondeo_id: 's1', referencia: 'AV-1', titulo: 'Aviso', tipo_documento: null, incluidos: 1, recibidos: 0, abiertos: 0, leidos: 9 }],
      resumenes: [{ sondeo_id: 's2', matricula: '0012345', nombre: 'A', incluidos: 1, recibidos: 0, abiertos: 0, leidos: 9, asignados: 10, leidos_total: 9 }],
      detalle: [], actuaciones: [act({ matricula: '0012345', no_computa: true })],
    });
    const re = leerCopia(JSON.stringify(json));
    expect(re.sondeos.length).toBe(2);
    expect(re.actuaciones[0]).toMatchObject({ no_computa: true, matricula: '0012345', errores: [] });
    expect(json.roster).toEqual([]);
  });
});
