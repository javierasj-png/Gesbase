/** Reglas «no computa» copiadas del tablero original (isJustifying / justificationFor / subtractAreas). */
/** Grupos genéricos (sin datos personales como motivos de salud o vacaciones). */
export const ESTADO_ORDINARIO = 'Seguimiento ordinario';
export const ESTADO_TEMPORAL = 'Situación temporal - recuperación pendiente';
export const ESTADO_EXCLUSION = 'Exclusión del cómputo validada';
export const ESTADOS_ACTUACION = [ESTADO_ORDINARIO, ESTADO_TEMPORAL, ESTADO_EXCLUSION] as const;
/** Estados que por defecto marcan «no computa». */
export const ESTADOS_JUSTIFICAN: string[] = [ESTADO_EXCLUSION];
/** Estados del tablero antiguo (solo para leer copias). */
export const ESTADOS_LEGACY_JUSTIFICAN = ['Mando intermedio (MMII)', 'Baja IT', 'Vacaciones'];

/** Convierte un estado antiguo a su grupo actual. */
export function grupoEstado(estado: string, noComputa = false): string {
  const e = (estado || '').trim();
  if ((ESTADOS_ACTUACION as readonly string[]).includes(e)) return e;
  if (/mmii|mando intermedio|liberad/i.test(e)) return ESTADO_EXCLUSION;
  if (/baja|vacacion|incidencia/i.test(e)) return ESTADO_TEMPORAL;
  return noComputa ? ESTADO_EXCLUSION : ESTADO_ORDINARIO;
}
export const CANALES = ['Correo electrónico', 'Teléfono', 'Presencial', 'Otro'];

export interface Actuacion {
  id: string; base_nombre: string; matricula: string | null; nombre: string | null; referencia: string | null;
  responsable: string; fecha_actuacion: string; fecha_comunicacion: string | null; canal: string | null;
  estado: string; vigencia_hasta: string | null; comentario: string | null; no_computa: boolean; periodo: string;
  created_at: string; updated_at: string; created_by: string | null; updated_by: string | null;
}

const n = (s: string | null | undefined) => (s || '').trim();

/** Solo justifica si tiene matrícula y está marcada «no computa». */
export const esJustificante = (a: Pick<Actuacion, 'matricula' | 'no_computa'>) => !!n(a.matricula) && a.no_computa === true;

/** Vigente en el sondeo `periodo` si: sin fecha de revisión o revisión ≥ sondeo, y actuación ≤ sondeo o registrada para ese sondeo. */
export function justificacionPara(acts: Actuacion[], matricula: string, periodo: string, base?: string): Actuacion | null {
  return acts
    .filter(a => esJustificante(a) && n(a.matricula) === n(matricula) && (!base || a.base_nombre === base)
      && (!a.vigencia_hasta || a.vigencia_hasta >= periodo)
      && (a.fecha_actuacion <= periodo || a.periodo === periodo))
    .sort((a, b) => b.fecha_actuacion.localeCompare(a.fecha_actuacion) || b.created_at.localeCompare(a.created_at))[0] || null;
}

export interface ResumenDesglose { base: string; matricula: string; nombre: string | null; incluidos: number | null; recibidos: number | null; abiertos: number | null; leidos: number | null }
export interface Excluido { base: string; matricula: string; nombre: string | null; n: [number, number, number, number]; nota: Actuacion }
export interface Ajuste { excluidos: Excluido[]; sinDesglose: { matricula: string; nombre: string | null; nota: Actuacion }[]; n: [number, number, number, number]; asignacionesRestadas: number }

/** Resta los recuentos de los justificados, base a base, sin bajar de 0. Sin desglose de 4 estados → no se resta. */
export function ajustar(original: [number, number, number, number], resumenes: ResumenDesglose[], acts: Actuacion[], periodo: string): Ajuste {
  const excluidos: Excluido[] = []; const sinDesglose: Ajuste['sinDesglose'] = [];
  for (const r of resumenes) {
    const nota = justificacionPara(acts, r.matricula, periodo, r.base);
    if (!nota) continue;
    if ([r.incluidos, r.recibidos, r.abiertos, r.leidos].some(v => v === null || v === undefined)) { sinDesglose.push({ matricula: r.matricula, nombre: r.nombre, nota }); continue; }
    excluidos.push({ base: r.base, matricula: r.matricula, nombre: r.nombre, nota, n: [r.incluidos!, r.recibidos!, r.abiertos!, r.leidos!] });
  }
  const porBase = new Map<string, number[]>();
  for (const e of excluidos) { const o = porBase.get(e.base) || [0, 0, 0, 0]; e.n.forEach((v, i) => (o[i] += v)); porBase.set(e.base, o); }
  const out = [...original] as [number, number, number, number];
  for (const e of porBase.values()) e.forEach((v, i) => (out[i] = Math.max(0, out[i] - v)));
  return { excluidos, sinDesglose, n: out, asignacionesRestadas: excluidos.reduce((s, e) => s + e.n[0] + e.n[1] + e.n[2] + e.n[3], 0) };
}
