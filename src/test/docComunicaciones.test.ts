import { describe, it, expect } from 'vitest';
import { asuntoAgente, mailto, mensajeAgente, mensajeBase, comentarioBase, MAX_MAILTO } from '@/lib/docReglamentaria/comunicaciones';

describe('comunicaciones (plantillas del tablero)', () => {
  it('agente con correo: mensaje con pendientes y enlace de correo válido', () => {
    const cuerpo = mensajeAgente({ nombre: 'Ana Ruiz', fecha: '2026-09-22', leidos: 3, total: 5, pendientes: [{ referencia: 'AV-1', titulo: 'Aviso', estado: 'abierto' }, { referencia: 'CR-2', titulo: 'Consigna', estado: 'incluido' }] });
    expect(cuerpo).toContain('Hola Ana Ruiz');
    expect(cuerpo).toContain('3 de 5 documentos leídos');
    expect(cuerpo).toContain('Quedan 2 pendientes');
    expect(cuerpo).toContain('- AV-1: Aviso — Abierto');
    const r = mailto('ana@renfe.es', asuntoAgente('0012345', '2026-09-22'), cuerpo);
    expect('href' in r && r.href.startsWith('mailto:ana%40renfe.es?subject=')).toBe(true);
    expect('href' in r && decodeURIComponent(r.href)).toContain('0012345 · 22/09/2026');
  });
  it('agente sin correo: no se abre el correo; con solo resumen avisa de que no hay detalle', () => {
    expect(mailto('', 'x', 'y')).toEqual({ error: 'Indica un correo válido.' });
    expect(mailto('no-es-correo', 'x', 'y')).toHaveProperty('error');
    const cuerpo = mensajeAgente({ nombre: 'Luis', fecha: '2026-09-22', leidos: 1, total: 4, pendientes: null });
    expect(cuerpo).not.toContain('No se dispone');
  });
  it('comunicación de base: ordena documentos por pendientes, omite los leídos y resume para el registro', () => {
    const d = { base: 'Irún', fecha: '2026-09-22', leidos: 30, total: 40, docs: [{ referencia: 'A', titulo: 't', pendientes: 2 }, { referencia: 'B', titulo: 't', pendientes: 8 }, { referencia: 'C', titulo: 't', pendientes: 0 }] };
    const m = mensajeBase(d);
    expect(m).toContain('75,0');
    expect(m).toContain('Pendientes: 10');
    expect(m.indexOf('- B')).toBeLessThan(m.indexOf('- A'));
    expect(m).not.toContain('- C');
    expect(comentarioBase(d, 'jefe@renfe.es')).toContain('10 pendientes de 40 enviados. Destinatario: jefe@renfe.es.');
  });
  it('mensaje demasiado largo: pide copiar en lugar de abrir', () => {
    expect(mailto('a@b.es', 's', 'x'.repeat(MAX_MAILTO))).toHaveProperty('error');
  });
});
