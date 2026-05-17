import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, addMonths, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

// ── Renfe colors ──
const MAGENTA: [number, number, number] = [130, 0, 94];
const COOL_GRAY: [number, number, number] = [152, 153, 155];
const WHITE: [number, number, number] = [255, 255, 255];
const DARK: [number, number, number] = [30, 41, 59];
const CARD_BG: [number, number, number] = [248, 250, 252];
const GREEN: [number, number, number] = [34, 197, 94];
const YELLOW: [number, number, number] = [234, 179, 8];
const RED: [number, number, number] = [239, 68, 68];

const MARGIN = 14;
const PAGE_HEADER_H = 16;

const tipoLabels1603: Record<string, string> = {
  acompanamiento: 'Acompañamiento',
  registro: 'Registro',
  alcohol: 'Alcohol',
  drogas: 'Drogas',
};

function calcEstadoCert(
  obtenida: boolean,
  fechaUltimoServicio: string | null,
  vigilar: boolean,
  periodoMeses: number,
  avisoDias: number
): { estado: string; diasRestantes: number | null } {
  if (!obtenida) return { estado: 'Pendiente', diasRestantes: null };
  if (!vigilar) return { estado: 'Obtenida', diasRestantes: null };
  if (!fechaUltimoServicio) return { estado: 'Vencida', diasRestantes: null };
  const venc = addMonths(new Date(fechaUltimoServicio), periodoMeses);
  const dias = differenceInDays(venc, new Date());
  if (dias < 0) return { estado: 'Vencida', diasRestantes: dias };
  if (dias <= avisoDias) return { estado: 'Próxima a vencer', diasRestantes: dias };
  return { estado: 'Vigente', diasRestantes: dias };
}

function addPageHeader(doc: jsPDF, text: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, PAGE_HEADER_H, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(text, pw / 2, 11, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function addFooters(doc: jsPDF, title: string) {
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...COOL_GRAY);
    doc.text(`${title} — Página ${i} de ${pageCount}`, pw / 2, ph - 8, { align: 'center' });
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pw - MARGIN, ph - 8, { align: 'right' });
  }
}

/** Returns the finalY after last autoTable, or the fallback */
function tableEndY(doc: jsPDF, fallback: number): number {
  return (doc as any).lastAutoTable?.finalY ?? fallback;
}

/** Ensures enough vertical space; if not, adds a new page and returns starting Y after header */
function needSpace(doc: jsPDF, currentY: number, needed: number, headerLabel: string): number {
  const ph = doc.internal.pageSize.getHeight();
  if (currentY + needed > ph - 20) {
    doc.addPage();
    addPageHeader(doc, headerLabel);
    return PAGE_HEADER_H + 6;
  }
  return currentY;
}

/** Draws a section title (e.g. "1. CONTROL DE CERTIFICACIONES") */
function sectionTitle(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text(title, MARGIN, y);
  return y + 8;
}

/** Draws a base sub-header */
function baseSubHeader(doc: jsPDF, baseNombre: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(`Base: ${baseNombre}`, MARGIN, y);
  return y + 5;
}

interface AuditoriaPDFOptions {
  bases: string[];
  baseFilter: string;
}

export async function generateAuditoriaPDF(options: AuditoriaPDFOptions) {
  const { bases, baseFilter } = options;
  const basesToReport = baseFilter === 'all' ? bases : [baseFilter];

  if (basesToReport.length === 0) throw new Error('No hay bases para reportar');

  // ── Fetch data ──
  const { data: basesConduccion } = await supabase
    .from('bases_conduccion')
    .select('id, nombre')
    .in('nombre', basesToReport);

  const baseIds = (basesConduccion || []).map(b => b.id);

  const { data: baseCertsConfig } = baseIds.length > 0
    ? await supabase.from('base_certificaciones').select('*').in('base_id', baseIds)
    : { data: [] as any[] };

  const { data: allMaquinistas } = await supabase
    .from('maquinistas')
    .select('*')
    .in('base', basesToReport)
    .eq('activo', true)
    .order('base')
    .order('apellidos');

  const maqs = allMaquinistas || [];
  const maqIds = maqs.map(m => m.id);

  const [
    { data: allMaqCerts },
    { data: allExps1603 },
    { data: allExps1201 },
  ] = await Promise.all([
    maqIds.length > 0
      ? supabase.from('maquinista_certificaciones').select('*').in('maquinista_id', maqIds)
      : Promise.resolve({ data: [] as any[] }),
    maqIds.length > 0
      ? supabase.from('expedientes_1603').select('*').in('maquinista_id', maqIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    maqIds.length > 0
      ? supabase.from('expedientes_1201').select('*').in('maquinista_id', maqIds).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const exp1603Ids = (allExps1603 || []).map(e => e.id);
  const exp1201Ids = (allExps1201 || []).map(e => e.id);

  const [
    { data: plans1603 },
    { data: acts1603 },
    { data: plans1201 },
    { data: acts1201 },
  ] = await Promise.all([
    exp1603Ids.length > 0
      ? supabase.from('plan_1603').select('*').in('expediente_id', exp1603Ids).order('tipo').order('mes')
      : Promise.resolve({ data: [] as any[] }),
    exp1603Ids.length > 0
      ? supabase.from('actuaciones_1603').select('*').in('expediente_id', exp1603Ids).order('fecha_real')
      : Promise.resolve({ data: [] as any[] }),
    exp1201Ids.length > 0
      ? supabase.from('plan_1201').select('*').in('expediente_id', exp1201Ids).order('dia_desde_origen')
      : Promise.resolve({ data: [] as any[] }),
    exp1201Ids.length > 0
      ? supabase.from('actuaciones_1201').select('*').in('expediente_id', exp1201Ids).order('fecha_real')
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // ── Build PDF ──
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const baseLabel = baseFilter === 'all' ? 'Todas las bases' : baseFilter;

  // ── PORTADA ──
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, 44, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE AUDITORÍA SGS', pw / 2, 16, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Base: ${baseLabel}`, pw / 2, 27, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pw / 2, 37, { align: 'center' });

  // ══════════════════════════════════════════
  // SECCIÓN 1: CONTROL DE CERTIFICACIONES
  // ══════════════════════════════════════════
  let y = sectionTitle(doc, '1. CONTROL DE CERTIFICACIONES', 56);

  for (const baseNombre of basesToReport) {
    const baseMaqs = maqs.filter(m => m.base === baseNombre);
    if (baseMaqs.length === 0) continue;

    const baseRecord = (basesConduccion || []).find(b => b.nombre === baseNombre);
    const baseCerts = (baseCertsConfig || []).filter((bc: any) => bc.base_id === baseRecord?.id);

    y = needSpace(doc, y, 30, 'Informe Auditoría — Certificaciones');
    y = baseSubHeader(doc, baseNombre, y);

    const certRows = baseMaqs.map(maq => {
      const maqCerts = (allMaqCerts || []).filter((mc: any) => mc.maquinista_id === maq.id);
      let vigentes = 0, proximas = 0, vencidas = 0, pendientes = 0, obtenidas = 0;

      baseCerts.forEach((bc: any) => {
        const asignada = maqCerts.find((mc: any) => mc.certificacion_id === bc.certificacion_id);
        const { estado } = calcEstadoCert(
          asignada?.obtenida ?? false,
          asignada?.fecha_ultimo_servicio || null,
          bc.vigilar_vencimiento ?? false,
          bc.periodo_inactividad_meses ?? 12,
          bc.aviso_dias ?? 90
        );
        if (estado === 'Vigente') vigentes++;
        else if (estado === 'Próxima a vencer') proximas++;
        else if (estado === 'Vencida') vencidas++;
        else if (estado === 'Pendiente') pendientes++;
        else if (estado === 'Obtenida') obtenidas++;
      });

      return [
        `${maq.apellidos}, ${maq.nombre}`,
        maq.matricula,
        String(baseCerts.length),
        String(vigentes + obtenidas),
        String(proximas),
        String(vencidas),
        String(pendientes),
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Maquinista', 'Matrícula', 'Total', 'Vigentes', 'Próximas', 'Vencidas', 'Pendientes']],
      body: certRows,
      theme: 'grid',
      headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2.5, lineColor: COOL_GRAY, lineWidth: 0.5 },
      bodyStyles: { textColor: DARK },
      columnStyles: { 0: { cellWidth: 50 } },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          if (data.column.index === 5 && Number(data.cell.raw) > 0) {
            data.cell.styles.textColor = RED;
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.column.index === 4 && Number(data.cell.raw) > 0) {
            data.cell.styles.textColor = YELLOW;
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });
    y = tableEndY(doc, y) + 6;
  }

  // ══════════════════════════════════════════
  // SECCIÓN 2: SEGUIMIENTO INDIVIDUAL DE ACCIONES
  // (resumen por maquinista de cumplimiento PE 16.03 y PE 12.01)
  // ══════════════════════════════════════════
  doc.addPage();
  addPageHeader(doc, 'Informe Auditoría — Seguimiento Individual');
  y = sectionTitle(doc, '2. SEGUIMIENTO INDIVIDUAL DE ACCIONES', PAGE_HEADER_H + 8);

  const today = new Date();
  const todayISO = today.toISOString().split('T')[0];

  for (const baseNombre of basesToReport) {
    const baseMaqs = maqs.filter(m => m.base === baseNombre);
    if (baseMaqs.length === 0) continue;

    y = needSpace(doc, y, 30, 'Informe Auditoría — Seguimiento Individual');
    y = baseSubHeader(doc, baseNombre, y);

    const seguimientoRows: any[] = [];

    for (const maq of baseMaqs) {
      const exps1603Maq = (allExps1603 || []).filter((e: any) => e.maquinista_id === maq.id && e.estado === 'abierto');
      const exps1201Maq = (allExps1201 || []).filter((e: any) => e.maquinista_id === maq.id && e.estado === 'abierto');

      // PE 16.03
      let total1603 = 0, realizadas1603 = 0, vencidas1603 = 0, exigibles1603 = 0;
      for (const exp of exps1603Maq) {
        const items = (plans1603 || []).filter((p: any) => p.expediente_id === exp.id);
        total1603 += items.length;
        for (const it of items) {
          const justificado = it.justificado_traslado === true;
          const realizada = !!it.actuacion_id;
          const finVent = it.fin_ventana ? new Date(it.fin_ventana) : null;
          if (realizada) realizadas1603++;
          if (finVent && finVent <= today) {
            exigibles1603++;
            if (!realizada && !justificado) vencidas1603++;
          }
        }
      }

      // PE 12.01
      let total1201 = 0, realizadas1201 = 0, vencidas1201 = 0, exigibles1201 = 0;
      for (const exp of exps1201Maq) {
        const items = (plans1201 || []).filter((p: any) => p.expediente_id === exp.id && p.estado !== 'no_procede');
        total1201 += items.length;
        for (const it of items) {
          const realizada = !!it.actuacion_id;
          const fObj = it.fecha_objetivo ? new Date(it.fecha_objetivo) : null;
          if (realizada) realizadas1201++;
          if (fObj && fObj <= today) {
            exigibles1201++;
            if (!realizada) vencidas1201++;
          }
        }
      }

      const tieneExpedientes = exps1603Maq.length > 0 || exps1201Maq.length > 0;
      if (!tieneExpedientes) continue;

      const cumple1603 = exps1603Maq.length === 0 ? '—' : (vencidas1603 === 0 ? 'SÍ' : 'NO');
      const cumple1201 = exps1201Maq.length === 0 ? '—' : (vencidas1201 === 0 ? 'SÍ' : 'NO');
      const cumpleGlobal = (vencidas1603 + vencidas1201) === 0 ? 'CUMPLE' : 'NO CUMPLE';

      seguimientoRows.push([
        `${maq.apellidos}, ${maq.nombre}`,
        maq.matricula,
        exps1603Maq.length > 0 ? `${realizadas1603}/${total1603}` : '—',
        exps1603Maq.length > 0 ? String(vencidas1603) : '—',
        cumple1603,
        exps1201Maq.length > 0 ? `${realizadas1201}/${total1201}` : '—',
        exps1201Maq.length > 0 ? String(vencidas1201) : '—',
        cumple1201,
        cumpleGlobal,
      ]);
    }

    if (seguimientoRows.length === 0) {
      doc.setFontSize(9);
      doc.setTextColor(...COOL_GRAY);
      doc.text('Sin expedientes individuales activos en esta base.', MARGIN + 4, y + 4);
      doc.setTextColor(0, 0, 0);
      y += 10;
      continue;
    }

    autoTable(doc, {
      startY: y,
      head: [[
        'Maquinista', 'Matrícula',
        '16.03\nReal/Total', '16.03\nVenc.', '16.03',
        '12.01\nReal/Total', '12.01\nVenc.', '12.01',
        'Estado',
      ]],
      body: seguimientoRows,
      theme: 'grid',
      headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
      styles: { fontSize: 7.5, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.5 },
      bodyStyles: { textColor: DARK },
      columnStyles: {
        0: { cellWidth: 44 },
        2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' },
        5: { halign: 'center' }, 6: { halign: 'center' }, 7: { halign: 'center' },
        8: { halign: 'center', fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.section !== 'body') return;
        const raw = String(data.cell.raw ?? '');
        // Vencidas columns (3, 6) red if > 0
        if ((data.column.index === 3 || data.column.index === 6) && /^\d+$/.test(raw) && Number(raw) > 0) {
          data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = 'bold';
        }
        // SÍ/NO per régimen (4, 7)
        if (data.column.index === 4 || data.column.index === 7) {
          if (raw === 'NO') { data.cell.styles.textColor = RED; data.cell.styles.fontStyle = 'bold'; }
          else if (raw === 'SÍ') { data.cell.styles.textColor = GREEN; data.cell.styles.fontStyle = 'bold'; }
        }
        // Estado global (8)
        if (data.column.index === 8) {
          if (raw === 'CUMPLE') { data.cell.styles.textColor = GREEN; }
          else if (raw === 'NO CUMPLE') { data.cell.styles.textColor = RED; }
        }
      },
    });
    y = tableEndY(doc, y) + 4;

    // Leyenda breve
    doc.setFontSize(7);
    doc.setTextColor(...COOL_GRAY);
    doc.text(
      'Real/Total: actuaciones realizadas sobre bloques totales del plan. Venc.: bloques exigibles a fecha de hoy sin realizar ni justificar.',
      MARGIN, y
    );
    doc.setTextColor(0, 0, 0);
    y += 6;
  }

  void todayISO;

  // ══════════════════════════════════════════
  // SECCIÓN 3: FICHAS PE 16.03
  // ══════════════════════════════════════════
  doc.addPage();
  addPageHeader(doc, 'Informe Auditoría — PE 16.03');
  y = sectionTitle(doc, '3. FICHAS DE SEGUIMIENTO PE 16.03', PAGE_HEADER_H + 8);


  const exps1603ByBase = basesToReport.map(baseNombre => {
    const baseMaqs = maqs.filter(m => m.base === baseNombre);
    const baseMaqIds = baseMaqs.map(m => m.id);
    const exps = (allExps1603 || []).filter((e: any) => baseMaqIds.includes(e.maquinista_id));
    return { baseNombre, exps, baseMaqs };
  }).filter(b => b.exps.length > 0);

  if (exps1603ByBase.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay expedientes PE 16.03 en las bases seleccionadas.', 20, y + 4);
  }

  for (const { baseNombre, exps, baseMaqs } of exps1603ByBase) {
    y = needSpace(doc, y, 30, 'Informe Auditoría — PE 16.03');
    y = baseSubHeader(doc, baseNombre, y);

    for (const exp of exps) {
      const maq = baseMaqs.find(m => m.id === exp.maquinista_id);
      if (!maq) continue;

      y = needSpace(doc, y, 55, 'Informe Auditoría — PE 16.03');

      // Expediente card
      doc.setFillColor(...CARD_BG);
      doc.roundedRect(MARGIN, y, pw - MARGIN * 2, 18, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MAGENTA);
      doc.text(`${maq.apellidos}, ${maq.nombre} — Matrícula: ${maq.matricula}`, MARGIN + 4, y + 7);

      const estadoExp = exp.estado === 'abierto' ? 'Abierto' : 'Cerrado';
      doc.setFillColor(...(exp.estado === 'abierto' ? GREEN : COOL_GRAY));
      doc.roundedRect(pw - MARGIN - 34, y + 3, 30, 6, 2, 2, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(7);
      doc.text(estadoExp, pw - MARGIN - 19, y + 7.5, { align: 'center' });

      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const fechaIni = format(parseISO(exp.fecha_inicio), 'dd/MM/yyyy');
      const fechaFin = exp.fecha_fin_prevista ? format(parseISO(exp.fecha_fin_prevista), 'dd/MM/yyyy') : 'N/A';
      doc.text(`Período: ${fechaIni} — ${fechaFin}  |  Tipo: ${exp.tipo === 'nuevo_acceso' ? 'Nuevo Acceso' : 'Reincorporación'}`, MARGIN + 4, y + 14);
      y += 22;

      const expPlan = (plans1603 || []).filter((p: any) => p.expediente_id === exp.id);
      const expActs = (acts1603 || []).filter((a: any) => a.expediente_id === exp.id);

      if (expPlan.length > 0) {
        const cumplidas = expPlan.filter((p: any) => p.actuacion_id).length;
        const pct = Math.round((cumplidas / expPlan.length) * 100);
        const color = pct >= 80 ? GREEN : pct >= 50 ? YELLOW : RED;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...color);
        doc.text(`Cumplimiento: ${pct}% (${cumplidas}/${expPlan.length})`, MARGIN + 4, y);
        y += 4;

        const planRows = expPlan.map((b: any) => {
          const act = expActs.find((a: any) => a.id === b.actuacion_id);
          return [
            tipoLabels1603[b.tipo] || b.tipo,
            b.etiqueta || `Mes ${b.mes}`,
            b.inicio_ventana && b.fin_ventana
              ? `${format(parseISO(b.inicio_ventana), 'dd/MM/yy')} — ${format(parseISO(b.fin_ventana), 'dd/MM/yy')}`
              : '-',
            b.actuacion_id ? 'Cumplida' : 'Pendiente',
            act?.fecha_real ? format(parseISO(act.fecha_real), 'dd/MM/yyyy') : '-',
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [['Tipo', 'Bloque', 'Ventana', 'Estado', 'Fecha Real']],
          body: planRows,
          theme: 'grid',
          headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
          styles: { fontSize: 7, cellPadding: 2.5, lineColor: COOL_GRAY, lineWidth: 0.5 },
          bodyStyles: { textColor: DARK },
          columnStyles: { 2: { cellWidth: 40 } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              data.cell.styles.textColor = data.cell.raw === 'Cumplida' ? GREEN : RED;
            }
          },
        });
        y = tableEndY(doc, y) + 8;
      } else {
        y += 4;
      }
    }
  }

  // ══════════════════════════════════════════
  // SECCIÓN 3: FICHAS PE 12.01
  // ══════════════════════════════════════════
  doc.addPage();
  addPageHeader(doc, 'Informe Auditoría — PE 12.01');
  y = sectionTitle(doc, '3. FICHAS DE SEGUIMIENTO PE 12.01', PAGE_HEADER_H + 8);

  const exps1201ByBase = basesToReport.map(baseNombre => {
    const baseMaqs = maqs.filter(m => m.base === baseNombre);
    const baseMaqIds = baseMaqs.map(m => m.id);
    const exps = (allExps1201 || []).filter((e: any) => baseMaqIds.includes(e.maquinista_id));
    return { baseNombre, exps, baseMaqs };
  }).filter(b => b.exps.length > 0);

  if (exps1201ByBase.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay expedientes PE 12.01 en las bases seleccionadas.', 20, y + 4);
  }

  for (const { baseNombre, exps, baseMaqs } of exps1201ByBase) {
    y = needSpace(doc, y, 30, 'Informe Auditoría — PE 12.01');
    y = baseSubHeader(doc, baseNombre, y);

    for (const exp of exps) {
      const maq = baseMaqs.find(m => m.id === exp.maquinista_id);
      if (!maq) continue;

      y = needSpace(doc, y, 55, 'Informe Auditoría — PE 12.01');

      // Expediente card
      const cardH = exp.descripcion_suceso ? 22 : 18;
      doc.setFillColor(...CARD_BG);
      doc.roundedRect(MARGIN, y, pw - MARGIN * 2, cardH, 2, 2, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MAGENTA);
      doc.text(`${maq.apellidos}, ${maq.nombre} — Suceso: ${exp.id_suceso}`, MARGIN + 4, y + 7);

      const estadoExp = exp.estado === 'abierto' ? 'Abierto' : 'Cerrado';
      doc.setFillColor(...(exp.estado === 'abierto' ? GREEN : COOL_GRAY));
      doc.roundedRect(pw - MARGIN - 34, y + 3, 30, 6, 2, 2, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(7);
      doc.text(estadoExp, pw - MARGIN - 19, y + 7.5, { align: 'center' });

      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const primerServ = format(parseISO(exp.fecha_primer_servicio), 'dd/MM/yyyy');
      const finPrev = exp.fecha_fin_prevista ? format(parseISO(exp.fecha_fin_prevista), 'dd/MM/yyyy') : 'N/A';
      doc.text(`Primer servicio: ${primerServ}  |  Fin previsto: ${finPrev}`, MARGIN + 4, y + 14);
      if (exp.descripcion_suceso) {
        doc.text(`Descripción: ${exp.descripcion_suceso.substring(0, 90)}`, MARGIN + 4, y + 19);
      }
      y += cardH + 4;

      const expPlan = (plans1201 || []).filter((p: any) => p.expediente_id === exp.id);
      const expActs = (acts1201 || []).filter((a: any) => a.expediente_id === exp.id);

      if (expPlan.length > 0) {
        const bloquesQueProceden = expPlan.filter((p: any) => p.estado !== 'no_procede').length;
        const realizados = expPlan.filter((p: any) => p.actuacion_id && p.estado !== 'no_procede').length;
        const pct = bloquesQueProceden > 0 ? Math.round((realizados / bloquesQueProceden) * 100) : 0;
        const color = pct >= 80 ? GREEN : pct >= 50 ? YELLOW : RED;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...color);
        doc.text(`Cumplimiento: ${pct}% (${realizados}/${bloquesQueProceden})`, MARGIN + 4, y);
        y += 4;

        const planRows = expPlan.map((b: any) => {
          const act = expActs.find((a: any) => a.id === b.actuacion_id);
          let estado = b.estado as string;
          if (estado === 'no_procede') estado = 'No planificar';
          else if (b.actuacion_id) estado = 'Realizado';
          else estado = 'Pendiente';

          return [
            b.tipo === 'acompanamiento' ? 'Acompañamiento' : 'Registro',
            b.etiqueta,
            b.fecha_objetivo ? format(parseISO(b.fecha_objetivo), 'dd/MM/yyyy') : '-',
            estado,
            act?.fecha_real ? format(parseISO(act.fecha_real), 'dd/MM/yyyy') : '-',
            act?.resultado || '-',
          ];
        });

        autoTable(doc, {
          startY: y,
          head: [['Tipo', 'Hito', 'Fecha Objetivo', 'Estado', 'Fecha Real', 'Resultado']],
          body: planRows,
          theme: 'grid',
          headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
          styles: { fontSize: 7, cellPadding: 2.5, lineColor: COOL_GRAY, lineWidth: 0.5 },
          bodyStyles: { textColor: DARK },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              const val = data.cell.raw as string;
              if (val === 'Realizado') data.cell.styles.textColor = GREEN;
              else if (val === 'Pendiente') data.cell.styles.textColor = RED;
              else data.cell.styles.textColor = COOL_GRAY;
            }
          },
        });
        y = tableEndY(doc, y) + 8;
      } else {
        y += 4;
      }
    }
  }

  // ── Footers ──
  addFooters(doc, 'Informe Auditoría SGS');

  // ── Save ──
  const filename = `Auditoria_SGS_${baseFilter === 'all' ? 'Global' : baseFilter}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
