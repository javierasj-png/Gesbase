import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { MODO_LABEL, type ModoSondeo } from '@/lib/docReglamentaria/parser';
import {
  totalDe, agruparPorDocumento, docsDesdeDetalle, indicadoresDesdeDocs, indicadoresDesdeResumenes,
  type DocFila, type Indicadores,
} from '@/lib/docReglamentaria/resumen';
import { evolucion, ratioDocumento } from '@/lib/docReglamentaria/comparar';

const MAGENTA: [number, number, number] = [130, 0, 94];
const LILA: [number, number, number] = [200, 160, 190];
const GRIS: [number, number, number] = [152, 153, 155];
const CLARO: [number, number, number] = [235, 235, 238];
const DARK: [number, number, number] = [30, 41, 59];
const M = 14;
/** Por debajo de este porcentaje un maquinista se considera con lectura baja (mismo umbral verde que la auditoría). */
const UMBRAL = 0.9;

interface Sondeo { id: string; fecha_sondeo: string; base_nombre: string; modo: ModoSondeo }
interface Lect { matricula: string; nombre: string | null; base: string; asignados: number; leidos: number }

const fmt = (n: number) => new Intl.NumberFormat('es-ES').format(n);
const pct = (p: number | null) => p === null ? 'Sin datos' : `${(p * 100).toFixed(1).replace('.', ',')} %`;
const fechaEs = (f: string) => f.split('-').reverse().join('/');
const pp = (a: number | null, b: number | null) => {
  if (a === null || b === null) return '—';
  const delta = (b - a) * 100;
  const decimals = delta !== 0 && Math.abs(delta) < 0.05 ? 2 : 1;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(decimals).replace('.', ',')} p.p.`;
};

async function todas<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) { const { data, error } = await q(i, i + 999); if (error || !data) break; out.push(...data); if (data.length < 1000) break; }
  return out;
}

/** Lectura por maquinista de un sondeo (solo modalidades con dato individual; nunca desde agregados). */
async function lecturaMaquinistas(s: Sondeo): Promise<Lect[]> {
  if (s.modo === 'resumen_maquinista') {
    const r = await todas<any>((a, b) => supabase.from('doc_resumenes_maquinista').select('matricula,nombre,asignados,leidos_total').eq('sondeo_id', s.id).range(a, b));
    return r.map(x => ({ matricula: x.matricula, nombre: x.nombre, base: s.base_nombre, asignados: x.asignados, leidos: x.leidos_total }));
  }
  if (s.modo === 'detalle_agente') {
    const r = await todas<any>((a, b) => supabase.from('doc_detalle_agente').select('matricula,nombre,estado').eq('sondeo_id', s.id).range(a, b));
    const m = new Map<string, Lect>();
    for (const x of r) {
      const p = m.get(x.matricula) || { matricula: x.matricula, nombre: x.nombre, base: s.base_nombre, asignados: 0, leidos: 0 };
      p.asignados++; if (x.estado === 'leido') p.leidos++; m.set(x.matricula, p);
    }
    return [...m.values()];
  }
  return [];
}

/** Datos de un tipo de sondeo de un día: recuento por documento (si lo hay) e indicadores. */
async function datosModo(sondeosDelModo: Sondeo[], modo: ModoSondeo): Promise<{ docs: DocFila[]; ind: Indicadores | null }> {
  const ids = sondeosDelModo.map(s => s.id);
  if (modo === 'agregado') {
    const rows = await todas<DocFila>((a, b) => supabase.from('doc_registros_agregados').select('referencia,titulo,incluidos,recibidos,abiertos,leidos').in('sondeo_id', ids).range(a, b));
    return { docs: agruparPorDocumento(rows), ind: indicadoresDesdeDocs(rows) };
  }
  if (modo === 'detalle_agente') {
    const rows = await todas<{ referencia: string; titulo: string | null; estado: string }>((a, b) => supabase.from('doc_detalle_agente').select('referencia,titulo,estado').in('sondeo_id', ids).range(a, b));
    const docs = docsDesdeDetalle(rows);
    return { docs, ind: indicadoresDesdeDocs(docs) };
  }
  const rows = await todas<{ asignados: number; leidos_total: number }>((a, b) => supabase.from('doc_resumenes_maquinista').select('asignados,leidos_total').in('sondeo_id', ids).range(a, b));
  return { docs: [], ind: indicadoresDesdeResumenes(rows) };
}

/** Elige, por base, el sondeo con dato individual de una fecha (prefiere resumen por maquinista). */
function individualPorBase(lista: Sondeo[]) {
  const m = new Map<string, Sondeo>();
  for (const s of lista) {
    if (s.modo === 'agregado') continue;
    const p = m.get(s.base_nombre);
    if (!p || (p.modo === 'detalle_agente' && s.modo === 'resumen_maquinista')) m.set(s.base_nombre, s);
  }
  return m;
}

export async function generateSondeoPDF(opts: { sondeos: Sondeo[]; base: string; fecha: string }) {
  const { sondeos, base, fecha } = opts;
  const bases = base === 'all' ? [...new Set(sondeos.filter(s => s.fecha_sondeo === fecha).map(s => s.base_nombre))].sort() : [base];
  const delDia = sondeos.filter(s => s.fecha_sondeo === fecha && bases.includes(s.base_nombre));
  // Tipos de datos cargados ese día (se detectan solos, no dependen del selector de la pantalla)
  const modosDia = (['agregado', 'resumen_maquinista', 'detalle_agente'] as ModoSondeo[]).filter(m => delDia.some(s => s.modo === m));
  const datos = new Map<ModoSondeo, { docs: DocFila[]; ind: Indicadores | null }>();
  for (const m of modosDia) datos.set(m, await datosModo(delDia.filter(s => s.modo === m), m));

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 0;

  // Cabecera
  doc.setFillColor(...MAGENTA); doc.rect(0, 0, W, 22, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('Informe de sondeo · Documentación reglamentaria', M, 10);
   doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
   const generado = `Generado ${new Date().toLocaleString('es-ES')}`;
   const subtitulo = `Sondeo del ${fechaEs(fecha)} · ${base === 'all' ? 'Todas mis bases' : base} · ${modosDia.map(m => MODO_LABEL[m]).join(' + ') || 'Sin datos'}`;
   doc.text(doc.splitTextToSize(subtitulo, W - 2 * M - doc.getTextWidth(generado) - 5)[0], M, 16);
   doc.text(generado, W - M, 16, { align: 'right' });
  y = 28;

  // KPIs del tipo principal (agregado si existe; si no, el primero cargado)
  const principal = modosDia.includes('agregado') ? 'agregado' : modosDia[0];
  const ind = principal ? datos.get(principal)?.ind ?? null : null;
  const docsPrincipal = modosDia.map(m => datos.get(m)?.docs ?? []).find(d => d.length) ?? [];
  const kw = (W - 2 * M - 9) / 4;
  const kpis: [string, string, string][] = [
    ['Lectura (leídos)', pct(ind?.porcentaje ?? null), ind ? `${fmt(ind.lecturas)} de ${fmt(ind.asignaciones)} asignaciones` : 'sin datos'],
    ['Pendientes de lectura', ind ? fmt(ind.pendientes) : '—', pct(ind && ind.asignaciones ? ind.pendientes / ind.asignaciones : null) + ' de las asignaciones'],
    ['Documentos distintos', docsPrincipal.length ? fmt(docsPrincipal.length) : '—', docsPrincipal.length ? 'en este sondeo' : 'sin recuento por documento'],
    ['Bases', fmt(bases.length), bases.length === 1 ? bases[0] : 'bases de conducción'],
  ];
  kpis.forEach(([t, v, s], i) => {
    const x = M + i * (kw + 3);
    if (i === 0) { doc.setFillColor(...MAGENTA); doc.roundedRect(x, y, kw, 22, 2, 2, 'F'); doc.setTextColor(255, 255, 255); }
    else { doc.setDrawColor(...CLARO); doc.roundedRect(x, y, kw, 22, 2, 2, 'S'); doc.setTextColor(...DARK); }
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.text(t, x + 3, y + 5);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold'); doc.text(v, x + 3, y + 13);
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(s, kw - 6)[0], x + 3, y + 19);
  });
  y += 28;

  const titulo = (t: string) => {
    if (y > 260) { doc.addPage(); y = 16; }
    doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(t, M, y); y += 4;
  };
  const nota = (t: string) => { doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(...GRIS); const l = doc.splitTextToSize(t, W - 2 * M); doc.text(l, M, y); y += l.length * 3 + 2; };

  // Distribución y estados, por cada tipo con recuento por documento cargado ese día
  const modosConDocs = modosDia.filter(m => (datos.get(m)?.docs.length ?? 0) > 0);
  for (const m of modosConDocs) {
    const docs = datos.get(m)!.docs;
    const t = docs.reduce((s, r) => [s[0] + r.incluidos, s[1] + r.recibidos, s[2] + r.abiertos, s[3] + r.leidos], [0, 0, 0, 0]);
    const tot = t[0] + t[1] + t[2] + t[3];
    const half = (W - 2 * M - 6) / 2;
    titulo(modosConDocs.length > 1 ? `Avance de la distribución · ${MODO_LABEL[m]}` : 'Avance de la distribución'); const y0 = y;
    const barras: [string, number][] = [['Recibidos, abiertos o leídos', t[1] + t[2] + t[3]], ['Abiertos o leídos', t[2] + t[3]], ['Leídos', t[3]]];
    barras.forEach(([l, v]) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...DARK); doc.text(l, M, y + 3);
      doc.setFont('helvetica', 'bold'); doc.text(`${fmt(v)} · ${pct(tot ? v / tot : null)}`, M + half, y + 3, { align: 'right' });
      doc.setFillColor(...CLARO); doc.roundedRect(M, y + 5, half, 2, 1, 1, 'F');
      doc.setFillColor(...MAGENTA); if (tot && v) doc.roundedRect(M, y + 5, half * v / tot, 2, 1, 1, 'F');
      y += 10;
    });
    nota(`Etapas acumuladas sobre ${fmt(tot)} asignaciones enviadas.`);
    // Estados
    const x2 = M + half + 6; let yy = y0;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...DARK); doc.text('En qué estado están los documentos', x2, yy - 4);
    const cols: [string, number, [number, number, number]][] = [['Incluido', t[0], GRIS], ['Recibido', t[1], LILA], ['Abierto', t[2], [170, 70, 140]], ['Leído', t[3], MAGENTA]];
    let cx = x2;
    cols.forEach(([, v, c]) => { if (!tot || !v) return; const w = half * v / tot; doc.setFillColor(...c); doc.rect(cx, yy, w, 5, 'F'); cx += w; });
    yy += 10;
    cols.forEach(([l, v, c], i) => {
      const x = x2 + (i % 2) * (half / 2), yl = yy + Math.floor(i / 2) * 10;
      doc.setFillColor(...c); doc.rect(x, yl - 2.5, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text(l, x + 4, yl);
      doc.setFont('helvetica', 'bold'); doc.text(`${fmt(v)} · ${pct(tot ? v / tot : null)}`, x, yl + 4);
    });
    y = Math.max(y, yy + 20) + 2;
  }

  // Maquinistas con menor lectura + reincidencia
  const actuales = individualPorBase(delDia);
  const lect: Lect[] = [];
  const previos = new Map<string, Lect>(); const fechasPrev: string[] = [];
  for (const [b, s] of actuales) {
    lect.push(...await lecturaMaquinistas(s));
    const prevLista = sondeos.filter(x => x.base_nombre === b && x.fecha_sondeo < fecha && x.modo !== 'agregado').sort((p, q) => q.fecha_sondeo.localeCompare(p.fecha_sondeo));
    const fp = prevLista[0]?.fecha_sondeo;
    const sp = fp ? individualPorBase(prevLista.filter(x => x.fecha_sondeo === fp)).get(b) : undefined;
    if (sp) { fechasPrev.push(`${b}: ${fechaEs(sp.fecha_sondeo)}`); for (const x of await lecturaMaquinistas(sp)) previos.set(b + '|' + x.matricula, x); }
  }
  titulo('Maquinistas con menor lectura');
  if (!lect.length) nota('Este sondeo no incluye datos por maquinista (solo agregados por documento), así que no se puede saber qué maquinistas tienen menor lectura.');
  else {
    const bajos = lect.filter(x => x.asignados > 0 && x.leidos / x.asignados < UMBRAL)
      .sort((a, b) => a.leidos / a.asignados - b.leidos / b.asignados || (b.asignados - b.leidos) - (a.asignados - a.leidos));
    const reinc = { total: 0, mejora: 0, empeora: 0 };
    const body = bajos.map(x => {
      const p = x.leidos / x.asignados; const ant = previos.get(x.base + '|' + x.matricula);
      const pa = ant && ant.asignados ? ant.leidos / ant.asignados : null;
      const esReinc = pa !== null && pa < UMBRAL;
      const tend = pa === null ? '—' : Math.abs(p - pa) < 0.0005 ? 'Igual' : p > pa ? 'Mejora' : 'Empeora';
      if (esReinc) { reinc.total++; if (tend === 'Mejora') reinc.mejora++; if (tend === 'Empeora') reinc.empeora++; }
      return [x.matricula, x.nombre || '—', ...(bases.length > 1 ? [x.base] : []), fmt(x.asignados - x.leidos), pct(p), pct(pa), pp(pa, p), esReinc ? 'Sí' : pa === null ? 'Sin dato anterior' : 'No', tend];
    });
    nota(`Maquinistas por debajo del ${UMBRAL * 100} % de lectura: ${bajos.length} de ${lect.length}. Reincidente = también estaba por debajo del ${UMBRAL * 100} % en el sondeo anterior de su base${fechasPrev.length ? ` (${fechasPrev.join(' · ')})` : ' (no hay sondeo anterior con datos por maquinista)'}. Reincidentes: ${reinc.total} · mejoran ${reinc.mejora} · empeoran ${reinc.empeora}.`);
    if (bajos.length) {
      autoTable(doc, {
        startY: y, margin: { left: M, right: M },
        head: [['Matrícula', 'Nombre', ...(bases.length > 1 ? ['Base'] : []), 'Pendientes', 'Lectura', 'Anterior', 'Variación', 'Reincidente', 'Tendencia']],
        body, styles: { fontSize: 7, cellPadding: 1.2 }, headStyles: { fillColor: MAGENTA, fontSize: 7 },
        didParseCell: d => {
          if (d.section !== 'body') return;
          const h = String((d.table.head[0].cells as any)[d.column.index]?.raw ?? '');
          if (h === 'Tendencia' && d.cell.raw === 'Empeora') d.cell.styles.textColor = [200, 30, 30];
          if (h === 'Tendencia' && d.cell.raw === 'Mejora') d.cell.styles.textColor = [22, 140, 60];
          if (h === 'Reincidente' && d.cell.raw === 'Sí') { d.cell.styles.textColor = MAGENTA; d.cell.styles.fontStyle = 'bold'; }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  }

  // Documentos con más pendientes, por cada tipo con recuento por documento
  for (const m of modosConDocs) {
    const docs = datos.get(m)!.docs;
    titulo(modosConDocs.length > 1 ? `Documentos con más pendientes · ${MODO_LABEL[m]}` : 'Documentos con más pendientes');
    const top = [...docs].map(d => ({ d, p: d.incluidos + d.recibidos + d.abiertos, t: totalDe(d) })).filter(x => x.p > 0).sort((a, b) => b.p - a.p).slice(0, 20);
    autoTable(doc, {
      startY: y, margin: { left: M, right: M },
      head: [['Referencia', 'Documento', 'Pendientes', 'Lectura']],
      body: top.map(x => [x.d.referencia, x.d.titulo || '—', fmt(x.p), pct(x.t ? x.d.leidos / x.t : null)]),
      styles: { fontSize: 7, cellPadding: 1.2 }, headStyles: { fillColor: MAGENTA, fontSize: 7 }, columnStyles: { 1: { cellWidth: 95 } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

   // Misma clasificación individual que «Evolución entre sondeos» en pantalla.
   // Se elige una sola modalidad coincidente por dimensión y base, sin mezclar asignaciones.
   titulo('Evolución respecto al sondeo anterior');
   nota('Solo se comparan registros presentes en ambas fechas y de la misma modalidad. Las altas y retiradas se muestran aparte; no se cuentan como mejora ni empeoramiento.');
   const anterior = (b: string, modo: ModoSondeo) => sondeos
     .filter(s => s.base_nombre === b && s.modo === modo && s.fecha_sondeo < fecha)
     .sort((p, q) => q.fecha_sondeo.localeCompare(p.fecha_sondeo))[0];
   const ratioLect = (x: Lect) => x.asignados ? x.leidos / x.asignados : null;
   const tablaEvolucion = <T,>(label: string, b: string, modo: ModoSondeo, prev: Sondeo, antes: T[], despues: T[], clave: (x: T) => string, nombre: (x: T) => string, ratio: (x: T) => number | null) => {
     const res = evolucion(antes, despues, clave, ratio);
     const counts = { mejora: 0, empeora: 0, igual: 0, sin_datos: 0 };
     for (const c of res.comunes) counts[c.tendencia]++;
     if (y > 239) { doc.addPage(); y = 16; }
     titulo(`${label} · ${b}`);
     nota(`${MODO_LABEL[modo]} · ${fechaEs(prev.fecha_sondeo)} → ${fechaEs(fecha)} · ${antes.length} → ${despues.length} (${despues.length - antes.length >= 0 ? '+' : ''}${despues.length - antes.length}) · ${res.nuevos.length} nuevos · ${res.retirados.length} retirados`);
     doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...DARK);
     doc.text(`Mejoran ${counts.mejora}   ·   Empeoran ${counts.empeora}   ·   Misma lectura ${counts.igual}${counts.sin_datos ? `   ·   Sin porcentaje comparable ${counts.sin_datos}` : ''}`, M, y);
     y += 5;
     const orden = { empeora: 0, mejora: 1, sin_datos: 2, igual: 3 };
     const cambiados = res.comunes.filter(c => c.tendencia !== 'igual').sort((a, b) => orden[a.tendencia] - orden[b.tendencia]);
     const filas = [
       ...cambiados.map(c => [
         ({ mejora: 'Mejora', empeora: 'Empeora', igual: 'Igual', sin_datos: 'Sin datos' })[c.tendencia],
         clave(c.despues), nombre(c.despues), pct(ratio(c.antes)), pct(ratio(c.despues)), pp(ratio(c.antes), ratio(c.despues)),
       ]),
       ...res.nuevos.map(x => ['Nuevo', clave(x), nombre(x), '—', pct(ratio(x)), '—']),
       ...res.retirados.map(x => ['Retirado', clave(x), nombre(x), pct(ratio(x)), '—', '—']),
     ];
     if (!filas.length) { nota(res.comunes.length ? 'Todos los registros comunes mantienen el mismo porcentaje de lectura.' : 'No hay registros en ninguno de los dos sondeos.'); return; }
     nota('Detalle de cambios, altas y retiradas. Los registros con la misma lectura figuran en el recuento anterior, sin repetirlos en esta tabla.');
     autoTable(doc, {
       startY: y, margin: { left: M, right: M, bottom: 13 },
       head: [['Resultado', label === 'Documentos' ? 'Referencia' : 'Matrícula', label === 'Documentos' ? 'Documento' : 'Nombre', 'Antes', 'Ahora', 'Variación']],
       body: filas, styles: { fontSize: 7, cellPadding: 1.2, overflow: 'linebreak' }, headStyles: { fillColor: MAGENTA, fontSize: 7 },
       columnStyles: { 0: { cellWidth: 21 }, 1: { cellWidth: 24 }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 19 }, 4: { cellWidth: 19 }, 5: { cellWidth: 21 } },
       didParseCell: d => { if (d.section === 'body' && d.column.index === 0 && d.cell.raw === 'Empeora') d.cell.styles.textColor = [200, 30, 30]; },
     });
     y = (doc as any).lastAutoTable.finalY + 7;
   };
   for (const b of bases) {
     const compararTipo = (preferencias: ModoSondeo[]) => preferencias.map(modo => {
       const cur = delDia.find(s => s.base_nombre === b && s.modo === modo);
       const prev = anterior(b, modo);
       return cur && prev ? { modo, cur, prev } : null;
     }).find(x => x !== null);
     const docsPar = compararTipo(['agregado', 'detalle_agente']);
     if (docsPar) {
       const [a, d] = await Promise.all([datosModo([docsPar.prev], docsPar.modo), datosModo([docsPar.cur], docsPar.modo)]);
       tablaEvolucion<DocFila>('Documentos', b, docsPar.modo, docsPar.prev, a.docs, d.docs, x => x.referencia, x => x.titulo || '—', ratioDocumento);
     } else { titulo(`Documentos · ${b}`); nota('No hay sondeo anterior de la misma modalidad con datos por documento.'); }
     const maqsPar = compararTipo(['resumen_maquinista', 'detalle_agente']);
     if (maqsPar) {
       const [a, d] = await Promise.all([lecturaMaquinistas(maqsPar.prev), lecturaMaquinistas(maqsPar.cur)]);
       tablaEvolucion('Maquinistas', b, maqsPar.modo, maqsPar.prev, a, d, x => x.matricula.trim(), x => x.nombre || '—', ratioLect);
     } else { titulo(`Maquinistas · ${b}`); nota('No hay sondeo anterior de la misma modalidad con datos por maquinista; no se infieren personas desde totales agregados.'); }
   }

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(6.5); doc.setTextColor(...GRIS); doc.text(`GesBase · Página ${i} de ${n}`, W - M, 290, { align: 'right' }); }
  doc.save(`informe_sondeo_${(base === 'all' ? 'todas' : base).replace(/\s+/g, '_')}_${fecha}.pdf`);
}
