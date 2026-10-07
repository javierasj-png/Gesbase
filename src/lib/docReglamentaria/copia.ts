/** Copias JSON del tablero original («Guardar copia», version 1). Lectura, vista previa y exportación. Sin IA. */
import type { ModoSondeo } from './parser';
import { ESTADOS_ACTUACION, ESTADOS_LEGACY_JUSTIFICAN, CANALES, grupoEstado, type Actuacion } from './justificaciones';
import { ESTADO_BASE_COMUNICADO } from './comunicaciones';

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim());
const isDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
const int = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
const ESTADOS = ['incluido', 'recibido', 'abierto', 'leido'] as const;
const ESTADOS_TABLERO = ['He hablado con el agente', 'Aviso enviado', 'Mando intermedio (MMII)', 'Baja IT', 'Vacaciones', 'Anomalía comunicada', 'Incidencia técnica', 'Pendiente de seguimiento', 'Otra situación'];
const ESTADOS_VALIDOS: string[] = [...ESTADOS_TABLERO, ...ESTADOS_ACTUACION, ESTADO_BASE_COMUNICADO];

export interface SondeoCopia {
  clave: string; origen: string; fecha: string; modo: ModoSondeo; nombre: string;
  filas: Record<string, unknown>[]; errores: string[];
}
export interface ActuacionCopia {
  idOrigen: string; origen: string; matricula: string | null; nombre: string | null; referencia: string | null;
  responsable: string; fecha_actuacion: string; fecha_comunicacion: string | null; canal: string | null; estado: string;
  vigencia_hasta: string | null; comentario: string | null; no_computa: boolean; periodo: string; errores: string[];
}
export interface AgenteCopia { matricula: string; nombre: string; origen: string; email: string }
export interface Copia {
  sondeos: SondeoCopia[]; actuaciones: ActuacionCopia[]; agentes: AgenteCopia[];
  organizacion: Record<string, { base?: string; service?: string; delegation?: string }>;
  origenes: string[]; avisos: string[];
}

/** isJustifying del tablero: sin matrícula nunca; `excluded` explícito manda; si no, estados que justifican o «Otra situación» con MMII. */
export function esJustificanteCopia(n: { agentId?: string; excluded?: boolean; status?: string; comment?: string }): boolean {
  if (!s(n.agentId)) return false;
  if (n.excluded !== undefined) return n.excluded === true;
  return ESTADOS_LEGACY_JUSTIFICAN.includes(s(n.status)) || (s(n.status) === 'Otra situación' && /mando\s+intermedio|\bmmii\b/i.test(s(n.comment)));
}

export function leerCopia(texto: string): Copia {
  let d: any;
  try { d = JSON.parse(texto); } catch { throw new Error('El archivo no es un JSON válido.'); }
  if (!d || d.version !== 1 || !Array.isArray(d.files) || !Array.isArray(d.notes) || !d.organization || typeof d.organization !== 'object' || Array.isArray(d.organization))
    throw new Error('Copia incompatible: no parece generada con «Guardar copia» del tablero (versión 1).');
  const avisos: string[] = [];
  const sondeos: SondeoCopia[] = [];
  const vistos = new Set<string>();

  for (const f of d.files) {
    const origen = s(f?.area), fecha = s(f?.period), errores: string[] = [];
    const modo: ModoSondeo | null = f?.mode === 'aggregate' ? 'agregado' : f?.mode === 'individual' ? 'detalle_agente' : null;
    if (!modo) { avisos.push(`Archivo «${s(f?.name)}» con modalidad desconocida (${s(f?.mode)}): se omite.`); continue; }
    if (!isDate(fecha)) errores.push('Fecha de sondeo inválida.');
    if (!origen) errores.push('Sin base de origen.');
    const rows: any[] = Array.isArray(f.rows) ? f.rows : [];
    let filas: Record<string, unknown>[];
    if (modo === 'agregado') {
      filas = rows.map((r, i) => {
        const n = r?.n;
        if (!Array.isArray(n) || n.length !== 4 || !n.every(int)) errores.push(`Fila ${i + 1}: recuentos inválidos.`);
        if (!s(r?.ref)) errores.push(`Fila ${i + 1}: sin referencia.`);
        return { referencia: s(r?.ref), titulo: s(r?.title), tipo: s(r?.type), fechaVigor: s(r?.effective), incluidos: n?.[0], recibidos: n?.[1], abiertos: n?.[2], leidos: n?.[3] };
      });
    } else {
      filas = rows.map((r, i) => {
        const n = r?.n; const k = Array.isArray(n) ? n.findIndex((x: number) => x === 1) : -1;
        if (!Array.isArray(n) || n.length !== 4 || n.reduce((a: number, b: number) => a + b, 0) !== 1) errores.push(`Fila ${i + 1}: estado individual inválido.`);
        if (!s(r?.agentId) || !s(r?.ref)) errores.push(`Fila ${i + 1}: falta matrícula o referencia.`);
        return { matricula: s(r?.agentId), nombre: s(r?.agent), referencia: s(r?.ref), titulo: s(r?.title), tipo: s(r?.type), fechaVigor: s(r?.effective), estado: ESTADOS[k] ?? '' };
      });
    }
    if (!filas.length) errores.push('Sin registros.');
    const clave = `${fecha}|${origen}|${modo}`;
    if (vistos.has(clave)) { avisos.push(`Sondeo repetido en la copia (${origen}, ${fecha}): se usa el primero.`); continue; }
    vistos.add(clave);
    sondeos.push({ clave, origen, fecha, modo, nombre: s(f?.name) || `copia ${origen} ${fecha}`, filas, errores: [...new Set(errores)].slice(0, 5) });
  }

  // Recuentos individuales → resumen por maquinista (una por base de origen y fecha)
  const roster = new Map<string, any>((Array.isArray(d.roster) ? d.roster : []).map((r: any) => [s(r?.agentId), r]));
  const grupos = new Map<string, any[]>();
  for (const r of Array.isArray(d.agentSummaries) ? d.agentSummaries : []) {
    const k = `${s(r?.period)}|${s(r?.area)}`; (grupos.get(k) || grupos.set(k, []).get(k)!).push(r);
  }
  for (const [k, rs] of grupos) {
    const [fecha, origen] = k.split('|'); const errores: string[] = [];
    if (!isDate(fecha)) errores.push('Fecha inválida.');
    const filas = rs.map((r, i) => {
      if (!s(r?.agentId)) errores.push(`Fila ${i + 1}: sin matrícula.`);
      if (!int(r?.assigned) || !int(r?.read) || r.read > r.assigned) errores.push(`Fila ${i + 1}: recuentos inválidos.`);
      const n = Array.isArray(r?.n) && r.n.length === 4 && r.n.every(int) ? r.n : null;
      return { matricula: s(r?.agentId), nombre: s(roster.get(s(r?.agentId))?.agent), baseOrigen: origen,
        ...(n ? { incluidos: n[0], recibidos: n[1], abiertos: n[2], leidos: n[3] } : {}), asignados: r?.assigned, leidosTotal: r?.read };
    });
    sondeos.push({ clave: `${fecha}|${origen}|resumen_maquinista`, origen, fecha, modo: 'resumen_maquinista', nombre: `copia · recuentos individuales ${origen}`, filas, errores: [...new Set(errores)].slice(0, 5) });
  }

  const actuaciones: ActuacionCopia[] = d.notes.map((n: any) => {
    const errores: string[] = [];
    const estado = s(n?.status), matricula = s(n?.agentId) || null, fecha = s(n?.date);
    const fc = s(n?.communicationDate) || null, canal = s(n?.channel) || null;
    if (!ESTADOS_VALIDOS.includes(estado)) errores.push(`Estado desconocido «${estado}».`);
    if (!isDate(fecha)) errores.push('Fecha de actuación inválida.');
    if (!s(n?.owner)) errores.push('Sin responsable.');
    if (!s(n?.area)) errores.push('Sin base de origen.');
    if (!!fc !== !!canal) errores.push('Comunicación sin fecha o sin canal.');
    if (canal && !CANALES.includes(canal)) errores.push(`Canal desconocido «${canal}».`);
    if (fc && fc > fecha) errores.push('Comunicación posterior a la actuación.');
    if (['Aviso enviado', 'Anomalía comunicada', ESTADO_BASE_COMUNICADO].includes(estado) && !fc) errores.push('Falta la fecha de comunicación.');
    const until = s(n?.until) || null;
    if (until && (!isDate(until) || until < fecha)) errores.push('Fecha de revisión inválida.');
    return {
      idOrigen: s(n?.id), origen: s(n?.area), matricula, nombre: matricula ? s(n?.agent) || null : null, referencia: s(n?.ref) || null,
      responsable: s(n?.owner).slice(0, 150), fecha_actuacion: fecha, fecha_comunicacion: fc, canal, estado: estado === ESTADO_BASE_COMUNICADO ? estado : grupoEstado(estado, esJustificanteCopia(n)), vigencia_hasta: until,
      comentario: s(n?.comment) || null, no_computa: esJustificanteCopia(n), periodo: isDate(n?.period) ? n.period : fecha, errores,
    };
  });

  const agentes: AgenteCopia[] = [...roster.values()].map(r => ({ matricula: s(r?.agentId), nombre: s(r?.agent), origen: s(r?.area), email: s(r?.email) })).filter(a => a.matricula);
  const origenes = [...new Set([...sondeos.map(x => x.origen), ...actuaciones.map(a => a.origen)].filter(Boolean))].sort();
  return { sondeos: sondeos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.origen.localeCompare(b.origen)), actuaciones, agentes, organizacion: d.organization, origenes, avisos };
}

/** Clave de igualdad de una actuación (para no duplicar). */
export const firmaActuacion = (a: Pick<Actuacion, 'base_nombre' | 'matricula' | 'fecha_actuacion' | 'estado' | 'comentario' | 'periodo'>) =>
  [a.base_nombre, a.matricula || '', a.fecha_actuacion, a.estado, a.comentario || '', a.periodo].join('|');

export type ClaseActuacion = 'nueva' | 'duplicada' | 'conflicto';
/** Nueva, idéntica a una existente, o en conflicto con la actuación de ese agente en ese sondeo (una por agente y sondeo). */
export function clasificarActuacion(a: ActuacionCopia, base: string, existentes: Actuacion[]): { clase: ClaseActuacion; existente?: Actuacion } {
  const f = firmaActuacion({ ...a, base_nombre: base });
  const igual = existentes.find(e => firmaActuacion(e) === f);
  if (igual) return { clase: 'duplicada', existente: igual };
  if (a.matricula) {
    const c = existentes.find(e => e.base_nombre === base && (e.matricula || '').trim() === a.matricula && e.periodo === a.periodo);
    if (c) return { clase: 'conflicto', existente: c };
  }
  return { clase: 'nueva' };
}

/** Exporta en el formato del tablero solo lo que el usuario puede leer (el filtrado lo hace la seguridad del servidor). */
export function construirExportacion(input: {
  sondeos: { id: string; fecha_sondeo: string; base_nombre: string; modo: ModoSondeo; nombre_archivo: string | null; hash_archivo: string | null }[];
  agregados: { sondeo_id: string; referencia: string; titulo: string | null; tipo_documento: string | null; incluidos: number; recibidos: number; abiertos: number; leidos: number }[];
  resumenes: { sondeo_id: string; matricula: string; nombre: string | null; incluidos: number | null; recibidos: number | null; abiertos: number | null; leidos: number | null; asignados: number; leidos_total: number }[];
  detalle: { sondeo_id: string; matricula: string; nombre: string | null; referencia: string; titulo: string | null; tipo_documento: string | null; estado: string }[];
  actuaciones: Actuacion[];
}) {
  const sd = new Map(input.sondeos.map(x => [x.id, x]));
  const files = input.sondeos.filter(x => x.modo !== 'resumen_maquinista').map(x => ({
    hash: x.hash_archivo || x.id, name: x.nombre_archivo || '', period: x.fecha_sondeo, area: x.base_nombre,
    mode: x.modo === 'agregado' ? 'aggregate' : 'individual',
    rows: x.modo === 'agregado'
      ? input.agregados.filter(r => r.sondeo_id === x.id).map((r, i) => ({ ref: r.referencia, title: r.titulo || '', effective: '', type: r.tipo_documento || '', area: x.base_nombre, n: [r.incluidos, r.recibidos, r.abiertos, r.leidos], line: i + 2, agent: '', agentId: '', email: '' }))
      : input.detalle.filter(r => r.sondeo_id === x.id).map((r, i) => ({ ref: r.referencia, title: r.titulo || '', effective: '', type: r.tipo_documento || '', area: x.base_nombre, n: ESTADOS.map(e => (e === r.estado ? 1 : 0)), line: i + 2, agent: r.nombre || '', agentId: r.matricula, email: '' })),
  }));
  const agentSummaries = input.resumenes.flatMap(r => {
    const x = sd.get(r.sondeo_id); if (!x) return [];
    const n = [r.incluidos, r.recibidos, r.abiertos, r.leidos];
    return [{ agentId: r.matricula, area: x.base_nombre, period: x.fecha_sondeo, assigned: r.asignados, read: r.leidos_total, ...(n.every(v => v !== null) ? { n } : {}), source: 'Gesbase' }];
  });
  const notes = input.actuaciones.map(a => ({
    id: a.id, created: a.created_at, area: a.base_nombre, status: a.estado, date: a.fecha_actuacion, communicationDate: a.fecha_comunicacion || '',
    channel: a.canal || '', owner: a.responsable, agentId: a.matricula || '', agent: a.nombre || '', ref: a.referencia || '', until: a.vigencia_hasta || '',
    period: a.periodo, comment: a.comentario || '', excluded: a.no_computa,
  }));
  return { version: 1, files, notes, organization: {}, audit: [`Exportado desde Gesbase ${new Date().toISOString()}`], roster: [], agentSummaries };
}
