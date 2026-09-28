/** Plantillas de comunicación copiadas del tablero original (messageForm / AgentUI.message). Sin IA. */
import { fmtPct } from './resumen';

const fmt = (n: number) => new Intl.NumberFormat('es-ES').format(n);
const fechaEs = (f: string) => f.split('-').reverse().join('/');
const ETAPA: Record<string, string> = { incluido: 'Incluido', recibido: 'Recibido', abierto: 'Abierto', leido: 'Leído' };

export const ESTADO_BASE_COMUNICADO = 'Estado de la base comunicado';
export const MAX_MAILTO = 6500;

export interface DatosAgente {
  nombre: string; fecha: string; leidos: number; total: number;
  /** null = solo hay resumen individual, no se dispone del detalle por documento */
  pendientes: { referencia: string; titulo: string | null; estado: string }[] | null;
}
export function mensajeAgente(d: DatosAgente): string {
  const pend = d.total - d.leidos;
  let b = `Hola ${d.nombre},\n\nEn el seguimiento del ${fechaEs(d.fecha)} tienes ${fmt(d.leidos)} de ${fmt(d.total)} documentos leídos (${fmtPct(d.total ? d.leidos / d.total : null)}). Quedan ${fmt(pend)} pendientes.\n\n`;
  if (d.pendientes === null) b += pend > 0 ? 'No se dispone del detalle por documento en este sondeo.' : 'No hay documentos pendientes.';
  else b += d.pendientes.length ? 'Documentos pendientes:\n' + d.pendientes.map(p => `- ${p.referencia}: ${p.titulo || ''} — ${ETAPA[p.estado] || p.estado}`).join('\n') : 'No hay documentos pendientes.';
  return b + '\n\nPor favor, revisa los documentos pendientes y confirma su lectura. Si hay alguna incidencia que lo impida, comunícala al responsable de tu base.\n\nGracias.';
}
export const asuntoAgente = (matricula: string, fecha: string) => `Seguimiento Documentación Reglamentaria · ${matricula} · ${fechaEs(fecha)}`;

export interface DatosBase { base: string; fecha: string; leidos: number; total: number; docs: { referencia: string; titulo: string | null; pendientes: number }[] }
export function mensajeBase(d: DatosBase): string {
  const docs = d.docs.filter(x => x.pendientes > 0).sort((a, b) => b.pendientes - a.pendientes);
  let b = `Seguimiento de ${d.base}, sondeo ${fechaEs(d.fecha)}.\n\nLectura (leídos): ${fmtPct(d.total ? d.leidos / d.total : null)} (${fmt(d.leidos)} de ${fmt(d.total)} asignaciones). Pendientes: ${fmt(d.total - d.leidos)}.\n\n`;
  b += docs.length ? 'Documentos pendientes:\n' + docs.map(x => `- ${x.referencia}: ${x.titulo || ''} (${fmt(x.pendientes)} pendientes)`).join('\n') : 'No hay documentos pendientes.';
  return b + '\n\nPor favor, revisa los pendientes de la base de conducción y registra las actuaciones realizadas.';
}
export const asuntoBase = (fecha: string) => `Seguimiento Documentación Reglamentaria · ${fechaEs(fecha)}`;
export const comentarioBase = (d: Pick<DatosBase, 'fecha' | 'leidos' | 'total'>, destinatario?: string) =>
  `Sondeo ${fechaEs(d.fecha)}: lectura ${fmtPct(d.total ? d.leidos / d.total : null)}, ${fmt(d.total - d.leidos)} pendientes de ${fmt(d.total)} enviados.${destinatario ? ' Destinatario: ' + destinatario + '.' : ''}`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Construye el enlace mailto. No envía nada: solo abre el cliente de correo del usuario. */
export function mailto(email: string, asunto: string, cuerpo: string): { href: string } | { error: string } {
  const e = email.trim();
  if (!e || !EMAIL.test(e)) return { error: 'Indica un correo válido.' };
  const href = 'mailto:' + encodeURIComponent(e) + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
  if (href.length > MAX_MAILTO) return { error: 'El mensaje es largo para abrirlo por correo. Cópialo y pégalo en tu aplicación de correo.' };
  return { href };
}
