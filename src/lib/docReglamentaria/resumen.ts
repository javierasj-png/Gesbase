/** Cálculos del tablero original: total = Incluido+Recibido+Abierto+Leído; pendientes = total − leídos; lectura = leídos/total. */
export interface Cuatro { incluidos: number; recibidos: number; abiertos: number; leidos: number }
export interface DocFila extends Cuatro { referencia: string; titulo: string | null }
export interface Indicadores { asignaciones: number; lecturas: number; pendientes: number; porcentaje: number | null }

export const totalDe = (r: Cuatro) => r.incluidos + r.recibidos + r.abiertos + r.leidos;

/** null = sin datos (no hay filas). Porcentaje null si no hay asignaciones. Nunca promedia porcentajes. */
export function indicadoresDesdeDocs(filas: Cuatro[]): Indicadores | null {
  if (!filas.length) return null;
  const asignaciones = filas.reduce((s, r) => s + totalDe(r), 0);
  const lecturas = filas.reduce((s, r) => s + r.leidos, 0);
  return { asignaciones, lecturas, pendientes: asignaciones - lecturas, porcentaje: asignaciones ? lecturas / asignaciones : null };
}

export function indicadoresDesdeResumenes(filas: { asignados: number; leidos_total: number }[]): Indicadores | null {
  if (!filas.length) return null;
  const asignaciones = filas.reduce((s, r) => s + r.asignados, 0);
  const lecturas = filas.reduce((s, r) => s + r.leidos_total, 0);
  return { asignaciones, lecturas, pendientes: asignaciones - lecturas, porcentaje: asignaciones ? lecturas / asignaciones : null };
}

/** Agrupa por referencia sumando recuentos (misma modalidad, varias bases). */
export function agruparPorDocumento(filas: DocFila[]): DocFila[] {
  const m = new Map<string, DocFila>();
  for (const r of filas) {
    const a = m.get(r.referencia);
    if (!a) m.set(r.referencia, { ...r });
    else { a.incluidos += r.incluidos; a.recibidos += r.recibidos; a.abiertos += r.abiertos; a.leidos += r.leidos; a.titulo ||= r.titulo; }
  }
  return [...m.values()].sort((a, b) => a.referencia.localeCompare(b.referencia));
}

/** Detalle individual → recuentos por documento (cada fila es una asignación con un estado). */
export function docsDesdeDetalle(filas: { referencia: string; titulo: string | null; estado: string }[]): DocFila[] {
  return agruparPorDocumento(filas.map(r => ({
    referencia: r.referencia, titulo: r.titulo,
    incluidos: +(r.estado === 'incluido'), recibidos: +(r.estado === 'recibido'),
    abiertos: +(r.estado === 'abierto'), leidos: +(r.estado === 'leido'),
  })));
}

export const fmtPct = (p: number | null) =>
  p === null ? '—' : new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(p);
