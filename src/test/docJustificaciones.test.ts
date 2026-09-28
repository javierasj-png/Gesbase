import { describe, it, expect } from 'vitest';
import { justificacionPara, ajustar, type Actuacion } from '@/lib/docReglamentaria/justificaciones';

const base = 'Irún', P = '2026-09-15';
const act = (p: Partial<Actuacion>): Actuacion => ({ id: Math.random().toString(), base_nombre: base, matricula: '01', nombre: null, referencia: null, responsable: 'J', fecha_actuacion: '2026-09-01', fecha_comunicacion: null, canal: null, estado: 'Baja IT', vigencia_hasta: null, comentario: null, no_computa: true, periodo: '2026-09-01', created_at: '2026-09-01T00:00', updated_at: '', created_by: null, updated_by: null, ...p });

describe('no computa', () => {
  it('vigente: revisión posterior al sondeo', () => expect(justificacionPara([act({ vigencia_hasta: '2026-09-30' })], '01', P)).not.toBeNull());
  it('vencida: revisión anterior al sondeo', () => expect(justificacionPara([act({ vigencia_hasta: '2026-09-10' })], '01', P)).toBeNull());
  it('futura: actuación posterior y registrada para otro sondeo', () => expect(justificacionPara([act({ fecha_actuacion: '2026-09-20', periodo: '2026-09-30' })], '01', P)).toBeNull());
  it('actuación posterior pero registrada para este sondeo sí cuenta', () => expect(justificacionPara([act({ fecha_actuacion: '2026-09-20', periodo: P })], '01', P)).not.toBeNull());
  it('sin marcar «no computa» no justifica', () => expect(justificacionPara([act({ no_computa: false })], '01', P)).toBeNull());
  it('otra base no justifica', () => expect(justificacionPara([act({ base_nombre: 'Olabeaga' })], '01', P, base)).toBeNull());

  it('ajuste: resta recuentos del justificado y no resta sin desglose', () => {
    const res = [
      { base, matricula: '01', nombre: 'A', incluidos: 2, recibidos: 1, abiertos: 0, leidos: 1 },
      { base, matricula: '02', nombre: 'B', incluidos: null, recibidos: null, abiertos: null, leidos: null },
      { base, matricula: '03', nombre: 'C', incluidos: 5, recibidos: 0, abiertos: 0, leidos: 5 },
    ];
    const acts = [act({}), act({ matricula: '02' })];
    const a = ajustar([10, 5, 5, 20], res, acts, P);
    expect(a.n).toEqual([8, 4, 5, 19]);
    expect(a.asignacionesRestadas).toBe(4);
    expect(a.sinDesglose.map(x => x.matricula)).toEqual(['02']);
  });
  it('ajuste nunca baja de 0', () => {
    expect(ajustar([1, 0, 0, 0], [{ base, matricula: '01', nombre: null, incluidos: 3, recibidos: 0, abiertos: 0, leidos: 0 }], [act({})], P).n).toEqual([0, 0, 0, 0]);
  });
});
