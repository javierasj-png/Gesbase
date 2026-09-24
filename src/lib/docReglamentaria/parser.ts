// Lector de los Excel/CSV de Documentación reglamentaria.
// Lógica funcional tomada del tablero de referencia. Solo lectura: no guarda nada.

export type ModoSondeo = 'agregado' | 'resumen_maquinista' | 'detalle_agente';

export const MODO_LABEL: Record<ModoSondeo, string> = {
  agregado: 'Seguimiento docs. (totales por documento)',
  resumen_maquinista: 'Seguimiento maqs. (resumen por maquinista)',
  detalle_agente: 'Detalle individual maquinista-documento',
};

export interface RegistroAgregado {
  linea: number; referencia: string; titulo: string; tipo: string; fechaVigor: string;
  incluidos: number; recibidos: number; abiertos: number; leidos: number;
}
export interface ResumenMaquinista {
  linea: number; matricula: string; nombre: string; baseOrigen: string;
  incluidos?: number; recibidos?: number; abiertos?: number; leidos?: number;
  asignados: number; leidosTotal: number;
}
export type EstadoDoc = 'incluido' | 'recibido' | 'abierto' | 'leido';
export interface DetalleAgente {
  linea: number; matricula: string; nombre: string; referencia: string; titulo: string; tipo: string;
  fechaVigor: string; estado: EstadoDoc;
}

export interface ResultadoLectura {
  modo: ModoSondeo | null;
  fechaSondeo: string; // YYYY-MM-DD o ''
  baseOrigen: string;
  agregados: RegistroAgregado[];
  resumenes: ResumenMaquinista[];
  detalle: DetalleAgente[];
  errores: string[];
  avisos: string[];
}

const clean = (v: unknown) => String(v ?? '').trim();
export const norm = (v: unknown) =>
  clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();

export const isValidDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;

/** Base de origen a partir del nombre: «Seguimiento docs. area X» / «Seguimiento maqs. area X». */
export function baseFromName(name: string): string {
  const file = clean(name.split(/[\\/]/).pop()).replace(/\.(xlsx|xls|csv)$/i, '');
  const m = file.match(/^Seguimiento\s+(?:docs?|maqs?)\.?\s*[aá]rea\s+(.+)$/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** Fecha del sondeo a partir de la ruta/nombre (p. ej. «2026 09 22/…» o «2026-09-22»). */
export function dateFromName(name: string): string {
  const m = name.match(/(20\d{2})[\s._-]?(\d{2})[\s._-]?(\d{2})/);
  if (!m) return '';
  const d = `${m[1]}-${m[2]}-${m[3]}`;
  return isValidDate(d) ? d : '';
}

const AGENT_ALIASES = ['MATRICULA', 'ID AGENTE', 'AGENTE ID', 'IDENTIFICADOR AGENTE'];
const ESTADOS: EstadoDoc[] = ['incluido', 'recibido', 'abierto', 'leido'];

/** Convierte un recuento; devuelve error legible si no es entero ≥ 0. */
function count(v: unknown, linea: number, campo: string, errores: string[]): number | null {
  const s = clean(v);
  if (s === '') { errores.push(`Fila ${linea}: ${campo} está vacío.`); return null; }
  if (/^-\s*\d/.test(s)) { errores.push(`Fila ${linea}: ${campo} es negativo (${s}).`); return null; }
  if (!/^\d+$/.test(s)) { errores.push(`Fila ${linea}: ${campo} no es un entero válido (${s}).`); return null; }
  const n = Number(s);
  if (!Number.isSafeInteger(n)) { errores.push(`Fila ${linea}: ${campo} fuera de rango.`); return null; }
  return n;
}

export function parseMatrix(matrix: unknown[][], meta: { name: string }): ResultadoLectura {
  const res: ResultadoLectura = {
    modo: null, fechaSondeo: dateFromName(meta.name), baseOrigen: baseFromName(meta.name),
    agregados: [], resumenes: [], detalle: [], errores: [], avisos: [],
  };
  const rows = matrix.map(r => (Array.isArray(r) ? r : []));
  const refRow = rows.findIndex(r => r.some(c => norm(c) === 'REFERENCIA'));
  const agentRow = rows.findIndex(r => r.some(c => AGENT_ALIASES.includes(norm(c))));
  const h = refRow >= 0 ? refRow : agentRow;
  if (h < 0) {
    res.errores.push('Formato no reconocido: falta la columna «Referencia» o «Matrícula».');
    return res;
  }
  const heads = rows[h].map(norm);
  const col = (...names: string[]) => heads.findIndex(x => names.map(norm).includes(x));
  const get = (r: unknown[], i: number) => (i < 0 ? '' : clean(r[i]));
  const ix = {
    ref: col('Referencia'), title: col('Título', 'Documento'), type: col('Subcarpeta', 'Tipo', 'Tipo de documento'),
    effective: col('F. Entrada Vigor', 'Fecha vigor'), area: col('Base de conducción', 'Área'), base: col('Base'),
    agentId: col(...AGENT_ALIASES), agent: col('Agente', 'Nombre y apellidos', 'Nombre completo', 'Nombre agente', 'Maquinista', 'Nombre'),
    last: col('Apellidos'), state: col('Estado'),
    assigned: col('Enviados', 'Total enviados', 'Documentos enviados', 'Asignados', 'Documentos asignados'),
    read: col('Leídos', 'Documentos leídos'),
  };
  const nums = ['Incluidos', 'Recibidos', 'Abiertos', 'Leídos'].map(n => col(n));
  const e = res.errores;

  if (refRow >= 0) res.modo = ix.agentId >= 0 ? 'detalle_agente' : 'agregado';
  else res.modo = 'resumen_maquinista';

  if (res.modo === 'agregado' && nums.some(i => i < 0)) { e.push('Faltan columnas Incluidos, Recibidos, Abiertos o Leídos.'); return res; }
  if (res.modo === 'detalle_agente' && ix.state < 0) { e.push('El detalle individual requiere la columna Estado.'); return res; }
  if (res.modo === 'resumen_maquinista' && ix.agent < 0) { e.push('Falta la columna Nombre o Agente.'); return res; }

  const seen = new Set<string>();
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r.some(v => clean(v))) continue;
    const linea = i + 1;
    const areaFila = get(r, ix.area) || get(r, ix.base);
    if (areaFila && !res.baseOrigen) res.baseOrigen = areaFila;

    if (res.modo === 'agregado') {
      const referencia = get(r, ix.ref);
      if (!referencia) { e.push(`Fila ${linea}: falta Referencia.`); continue; }
      const [a, b, c, d] = nums.map((j, k) => count(r[j], linea, ['Incluidos', 'Recibidos', 'Abiertos', 'Leídos'][k], e));
      if ([a, b, c, d].some(x => x === null)) continue;
      const k = norm(referencia);
      if (seen.has(k)) { e.push(`Fila ${linea}: referencia repetida (${referencia}).`); continue; }
      seen.add(k);
      res.agregados.push({ linea, referencia, titulo: get(r, ix.title) || referencia, tipo: get(r, ix.type) || 'Sin tipo',
        fechaVigor: get(r, ix.effective), incluidos: a!, recibidos: b!, abiertos: c!, leidos: d! });
    } else if (res.modo === 'detalle_agente') {
      const matricula = get(r, ix.agentId), referencia = get(r, ix.ref), st = norm(get(r, ix.state));
      if (!matricula) { e.push(`Fila ${linea}: falta Matrícula.`); continue; }
      if (!referencia) { e.push(`Fila ${linea}: falta Referencia.`); continue; }
      const idx = ['INCLUIDO', 'RECIBIDO', 'ABIERTO', 'LEIDO'].indexOf(st);
      if (idx < 0) { e.push(`Fila ${linea}: Estado debe ser Incluido, Recibido, Abierto o Leído.`); continue; }
      const k = `${norm(matricula)}|${norm(referencia)}`;
      if (seen.has(k)) { e.push(`Fila ${linea}: documento repetido para ${matricula}.`); continue; }
      seen.add(k);
      res.detalle.push({ linea, matricula, nombre: get(r, ix.agent) || matricula, referencia, titulo: get(r, ix.title) || referencia,
        tipo: get(r, ix.type) || 'Sin tipo', fechaVigor: get(r, ix.effective), estado: ESTADOS[idx] });
    } else {
      if (get(r, ix.ref) || get(r, ix.state)) { e.push(`Fila ${linea}: contiene documentos y estados; usa el formato de detalle individual.`); continue; }
      const matricula = get(r, ix.agentId);
      const nombre = [get(r, ix.agent), get(r, ix.last)].filter(Boolean).join(' ').replace(/\s+/g, ' ');
      if (!matricula || !nombre) { e.push(`Fila ${linea}: faltan nombre o matrícula.`); continue; }
      const out: ResumenMaquinista = { linea, matricula, nombre, baseOrigen: areaFila, asignados: 0, leidosTotal: 0 };
      if (ix.assigned >= 0) {
        const a = count(r[ix.assigned], linea, 'Enviados', e), l = count(r[ix.read], linea, 'Leídos', e);
        if (a === null || l === null) continue;
        out.asignados = a; out.leidosTotal = l;
      } else if (nums.every(n => n >= 0)) {
        const v = nums.map((j, k) => count(r[j], linea, ['Incluidos', 'Recibidos', 'Abiertos', 'Leídos'][k], e));
        if (v.some(x => x === null)) continue;
        [out.incluidos, out.recibidos, out.abiertos, out.leidos] = v as number[];
        out.asignados = (v as number[]).reduce((s, x) => s + x, 0); out.leidosTotal = v[3]!;
      } else { e.push(`Fila ${linea}: faltan recuentos (Enviados/Leídos o Incluidos…Leídos).`); continue; }
      if (out.leidosTotal > out.asignados) { e.push(`Fila ${linea}: hay más leídos (${out.leidosTotal}) que asignados (${out.asignados}).`); continue; }
      const k = norm(matricula);
      if (seen.has(k)) { e.push(`Fila ${linea}: matrícula repetida (${matricula}).`); continue; }
      seen.add(k);
      res.resumenes.push(out);
    }
  }
  const total = res.agregados.length + res.resumenes.length + res.detalle.length;
  if (!total && !e.length) res.avisos.push('El archivo no contiene registros.');
  return res;
}

export const totalRegistros = (r: ResultadoLectura) => r.agregados.length + r.resumenes.length + r.detalle.length;
