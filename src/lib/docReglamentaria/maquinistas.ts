/** Seguimiento por maquinista. Vinculación SOLO por matrícula exacta (texto). Nunca por nombre. */
export interface ResumenRow { matricula: string; nombre: string | null; asignados: number; leidos_total: number; base: string; email?: string | null }
export interface DetalleRow { matricula: string; nombre: string | null; referencia: string; titulo: string | null; estado: string; base: string; email?: string | null }
export interface MaqMaestro { id: string; matricula: string; nombre: string; apellidos: string; base: string; email?: string | null }
export interface Totales { asignaciones: number; lecturas: number }

export interface FilaMaquinista {
  matricula: string;
  nombreArchivo: string;
  baseSondeo: string;
  maestro: MaqMaestro | null;          // null = sin correspondencia
  resumen: Totales | null;             // null = no hay resumen individual
  detalle: Totales | null;             // null = no hay detalle agente-documento
  pendientesDetalle: { referencia: string; titulo: string | null; estado: string }[];
  discrepancia: boolean;               // resumen y detalle con cifras distintas
}

export const clave = (m: string) => m.trim();

export function construirSeguimiento(res: ResumenRow[], det: DetalleRow[], maestros: MaqMaestro[]): FilaMaquinista[] {
  const idx = new Map(maestros.map(m => [clave(m.matricula), m]));
  const out = new Map<string, FilaMaquinista>();
  const get = (mat: string, nombre: string | null, base: string) => {
    const k = clave(mat);
    let f = out.get(k);
    if (!f) {
      f = { matricula: k, nombreArchivo: nombre || '', baseSondeo: base, maestro: idx.get(k) || null, resumen: null, detalle: null, pendientesDetalle: [], discrepancia: false };
      out.set(k, f);
    }
    if (!f.nombreArchivo && nombre) f.nombreArchivo = nombre;
    return f;
  };
  for (const r of res) {
    const f = get(r.matricula, r.nombre, r.base);
    f.resumen ??= { asignaciones: 0, lecturas: 0 };
    f.resumen.asignaciones += r.asignados; f.resumen.lecturas += r.leidos_total;
  }
  for (const d of det) {
    const f = get(d.matricula, d.nombre, d.base);
    f.detalle ??= { asignaciones: 0, lecturas: 0 };
    f.detalle.asignaciones += 1;
    if (d.estado === 'leido') f.detalle.lecturas += 1;
    else f.pendientesDetalle.push({ referencia: d.referencia, titulo: d.titulo, estado: d.estado });
  }
  for (const f of out.values()) {
    f.discrepancia = !!(f.resumen && f.detalle && (f.resumen.asignaciones !== f.detalle.asignaciones || f.resumen.lecturas !== f.detalle.lecturas));
    f.pendientesDetalle.sort((a, b) => a.referencia.localeCompare(b.referencia));
  }
  return [...out.values()].sort((a, b) => Number(!!a.maestro) - Number(!!b.maestro) || a.matricula.localeCompare(b.matricula));
}

/** Cifras a mostrar: solo si hay una única fuente o ambas coinciden. Con discrepancia → null (se muestran ambas para revisión). */
export function cifras(f: FilaMaquinista): (Totales & { pendientes: number; porcentaje: number | null }) | null {
  if (f.discrepancia) return null;
  const t = f.detalle || f.resumen;
  if (!t) return null;
  return { ...t, pendientes: t.asignaciones - t.lecturas, porcentaje: t.asignaciones ? t.lecturas / t.asignaciones : null };
}
