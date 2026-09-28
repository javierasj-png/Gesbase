/** Comparación entre dos sondeos de la MISMA base y modalidad. Nunca mezcla modalidades ni deduce individuos desde agregados. */
import { totalDe, type Cuatro } from './resumen';

export interface Global { asignaciones: number; lecturas: number; pendientes: number; porcentaje: number | null }
const glob = (a: number, l: number): Global => ({ asignaciones: a, lecturas: l, pendientes: a - l, porcentaje: a ? l / a : null });

export interface Item<T> { clave: string; antes: T | null; despues: T | null }
export interface Comparacion<T> {
  antes: Global; despues: Global;
  aparecen: Item<T>[];      // solo en el sondeo posterior
  desaparecen: Item<T>[];   // solo en el anterior (NO implica lectura)
  cambian: Item<T>[];       // presentes en ambos con valores distintos
  iguales: number;
}

function diff<T>(a: Map<string, T>, b: Map<string, T>, eq: (x: T, y: T) => boolean) {
  const aparecen: Item<T>[] = [], desaparecen: Item<T>[] = [], cambian: Item<T>[] = [];
  let iguales = 0;
  for (const [k, x] of a) {
    const y = b.get(k);
    if (y === undefined) desaparecen.push({ clave: k, antes: x, despues: null });
    else if (eq(x, y)) iguales++; else cambian.push({ clave: k, antes: x, despues: y });
  }
  for (const [k, y] of b) if (!a.has(k)) aparecen.push({ clave: k, antes: null, despues: y });
  const s = (l: Item<T>[]) => l.sort((p, q) => p.clave.localeCompare(q.clave));
  return { aparecen: s(aparecen), desaparecen: s(desaparecen), cambian: s(cambian), iguales };
}

export type DocAgg = Cuatro & { titulo: string | null };
export function compararAgregados(a: (DocAgg & { referencia: string })[], b: (DocAgg & { referencia: string })[]): Comparacion<DocAgg> {
  const m = (l: typeof a) => { const r = new Map<string, DocAgg>(); for (const x of l) { const p = r.get(x.referencia); if (p) { p.incluidos += x.incluidos; p.recibidos += x.recibidos; p.abiertos += x.abiertos; p.leidos += x.leidos; } else r.set(x.referencia, { titulo: x.titulo, incluidos: x.incluidos, recibidos: x.recibidos, abiertos: x.abiertos, leidos: x.leidos }); } return r; };
  const g = (l: typeof a) => glob(l.reduce((s, x) => s + totalDe(x), 0), l.reduce((s, x) => s + x.leidos, 0));
  return { antes: g(a), despues: g(b), ...diff(m(a), m(b), (x, y) => x.incluidos === y.incluidos && x.recibidos === y.recibidos && x.abiertos === y.abiertos && x.leidos === y.leidos) };
}

export interface ResTot { nombre: string | null; asignados: number; leidos_total: number }
export function compararResumenes(a: (ResTot & { matricula: string })[], b: (ResTot & { matricula: string })[]): Comparacion<ResTot> {
  const m = (l: typeof a) => new Map(l.map(x => [x.matricula.trim(), { nombre: x.nombre, asignados: x.asignados, leidos_total: x.leidos_total }]));
  const g = (l: typeof a) => glob(l.reduce((s, x) => s + x.asignados, 0), l.reduce((s, x) => s + x.leidos_total, 0));
  return { antes: g(a), despues: g(b), ...diff(m(a), m(b), (x, y) => x.asignados === y.asignados && x.leidos_total === y.leidos_total) };
}

export interface Asig { matricula: string; nombre: string | null; referencia: string; titulo: string | null; estado: string }
export function compararDetalle(a: Asig[], b: Asig[]): Comparacion<Asig> & { nuevasLecturas: number; retrocesos: number } {
  const m = (l: Asig[]) => new Map(l.map(x => [`${x.matricula.trim()}|${x.referencia}`, x]));
  const g = (l: Asig[]) => glob(l.length, l.filter(x => x.estado === 'leido').length);
  const d = diff(m(a), m(b), (x, y) => x.estado === y.estado);
  return {
    antes: g(a), despues: g(b), ...d,
    nuevasLecturas: d.cambian.filter(c => c.despues!.estado === 'leido').length,
    retrocesos: d.cambian.filter(c => c.antes!.estado === 'leido').length,
  };
}
