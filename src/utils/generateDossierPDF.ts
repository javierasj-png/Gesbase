import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, addMonths, addYears, differenceInDays } from 'date-fns';
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
const BLUE: [number, number, number] = [59, 130, 246];

const PAGE_HEADER_H = 14;

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

function estadoColor(estado: string): [number, number, number] {
  if (estado === 'Vigente' || estado === 'cumplida' || estado === 'realizado') return GREEN;
  if (estado === 'Próxima a vencer' || estado === 'en_ventana' || estado === 'programado') return YELLOW;
  if (estado === 'Vencida' || estado === 'vencida') return RED;
  return COOL_GRAY;
}

function addPageHeader(doc: jsPDF, text: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, PAGE_HEADER_H, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.text(text, pw / 2, 9, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

function addFooters(doc: jsPDF) {
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...COOL_GRAY);
    doc.text(`Dosier Maquinista — Página ${i} de ${pageCount}`, pw / 2, ph - 8, { align: 'center' });
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pw - 14, ph - 8, { align: 'right' });
  }
}

function tableEndY(doc: jsPDF, fallback: number): number {
  return (doc as any).lastAutoTable?.finalY ?? fallback;
}

function needSpace(doc: jsPDF, currentY: number, needed: number, headerLabel: string): number {
  const ph = doc.internal.pageSize.getHeight();
  if (currentY + needed > ph - 20) {
    doc.addPage();
    addPageHeader(doc, headerLabel);
    return PAGE_HEADER_H + 4;
  }
  return currentY;
}

export async function generateDossierPDF(maquinistaId: string) {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;

  // ── 1. Fetch all data in parallel ──
  const [
    { data: maq },
    { data: baseData },
    { data: maqCerts },
    { data: exps1603 },
    { data: exps1201 },
    { data: segsEsp },
    { data: actsPlanAnual },
  ] = await Promise.all([
    supabase.from('maquinistas').select('*').eq('id', maquinistaId).single(),
    supabase.from('bases_conduccion').select('id, nombre, redes').order('nombre'),
    supabase.from('maquinista_certificaciones').select('*').eq('maquinista_id', maquinistaId),
    supabase.from('expedientes_1603').select('*').eq('maquinista_id', maquinistaId).order('created_at', { ascending: false }),
    supabase.from('expedientes_1201').select('*').eq('maquinista_id', maquinistaId).order('created_at', { ascending: false }),
    supabase.from('seguimientos_especiales').select('*').eq('maquinista_id', maquinistaId).order('created_at', { ascending: false }),
    supabase.from('actuaciones_plan_anual').select('*').eq('maquinista_id', maquinistaId).eq('anio', currentYear).order('fecha_real'),
  ]);

  if (!maq) throw new Error('Maquinista no encontrado');

  const baseRecord = baseData?.find(b => b.nombre === maq.base);
  const baseRedes: ('convencional' | 'av')[] = (baseRecord as any)?.redes === 'ambas'
    ? ['convencional', 'av']
    : (baseRecord as any)?.redes === 'av' ? ['av'] : ['convencional'];
  const { data: baseCertsConfig } = baseRecord
    ? await supabase.from('base_certificaciones').select('*').eq('base_id', baseRecord.id)
    : { data: [] };

  const exp1603Ids = (exps1603 || []).map(e => e.id);
  const exp1201Ids = (exps1201 || []).map(e => e.id);
  const segEspIds = (segsEsp || []).map(s => s.id);

  const [
    { data: plans1603 },
    { data: acts1603 },
    { data: traslados1603 },
    { data: plans1201 },
    { data: acts1201 },
    { data: planSegEsp },
  ] = await Promise.all([
    exp1603Ids.length > 0
      ? supabase.from('plan_1603').select('*').in('expediente_id', exp1603Ids).order('tipo').order('mes')
      : Promise.resolve({ data: [] }),
    exp1603Ids.length > 0
      ? supabase.from('actuaciones_1603').select('*').in('expediente_id', exp1603Ids).order('fecha_real')
      : Promise.resolve({ data: [] }),
    exp1603Ids.length > 0
      ? supabase.from('traslados_1603').select('*').in('expediente_id', exp1603Ids).order('fecha_traslado')
      : Promise.resolve({ data: [] }),
    exp1201Ids.length > 0
      ? supabase.from('plan_1201').select('*').in('expediente_id', exp1201Ids).order('dia_desde_origen')
      : Promise.resolve({ data: [] }),
    exp1201Ids.length > 0
      ? supabase.from('actuaciones_1201').select('*').in('expediente_id', exp1201Ids).order('fecha_real')
      : Promise.resolve({ data: [] }),
    segEspIds.length > 0
      ? supabase.from('plan_seguimiento_especial').select('*').in('seguimiento_id', segEspIds).order('fecha_objetivo')
      : Promise.resolve({ data: [] }),
  ]);

  // Also fetch PE 16.03 actuaciones for the current year (separately, may overlap)
  // We already have acts1603; filter by year inline.


  // ── 2. Build PDF ──
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const nombreCompleto = `${maq.nombre} ${maq.apellidos}`;

  // ── Cover / Header ──
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, 36, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DOSIER DEL MAQUINISTA', pw / 2, 16, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(nombreCompleto, pw / 2, 24, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pw / 2, 32, { align: 'center' });

  // ── Ficha del maquinista ──
  let y = 42;
  doc.setFillColor(...CARD_BG);
  const hasExtraLine = maq.fecha_ingreso || maq.email;
  const hasLicencia = !!maq.fecha_licencia_conduccion;
  const fichaH = (hasExtraLine ? 24 : 16) + (hasLicencia ? 6 : 0);
  doc.roundedRect(14, y, pw - 28, fichaH, 2, 2, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('DATOS DEL MAQUINISTA', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.setFontSize(8);
  doc.text(`Matrícula: ${maq.matricula}`, 18, y + 12);
  doc.text(`Base: ${maq.base}`, 75, y + 12);
  doc.text(`Estado: ${maq.activo ? 'Activo' : 'Inactivo'}`, 130, y + 12);
  
  let fichaLineY = y + 18;
  if (maq.fecha_ingreso) {
    doc.text(`Ingreso: ${format(parseISO(maq.fecha_ingreso), 'dd/MM/yyyy')}`, 18, fichaLineY);
  }
  if (maq.email) doc.text(`Email: ${maq.email}`, 75, fichaLineY);
  if (hasExtraLine) fichaLineY += 6;

  if (hasLicencia) {
    const fechaLic = parseISO(maq.fecha_licencia_conduccion!);
    const fechaCad = addYears(fechaLic, 10);
    const diasRest = differenceInDays(fechaCad, new Date());
    const estadoLic = diasRest < 0 ? 'Caducada' : diasRest <= 180 ? `Caduca en ${diasRest} días` : 'Vigente';
    const colorLic = diasRest < 0 ? RED : diasRest <= 180 ? YELLOW : GREEN;
    doc.text(`Licencia: ${format(fechaLic, 'dd/MM/yyyy')}`, 18, fichaLineY);
    doc.text(`Caducidad: ${format(fechaCad, 'dd/MM/yyyy')}`, 75, fichaLineY);
    doc.setTextColor(...colorLic);
    doc.text(`(${estadoLic})`, 130, fichaLineY);
    doc.setTextColor(...DARK);
  }

  y += fichaH + 4;

  // ── Observaciones ──
  if (maq.observaciones) {
    doc.setFillColor(...CARD_BG);
    const obsLines = doc.splitTextToSize(maq.observaciones, pw - 36);
    const obsH = 10 + obsLines.length * 4;
    doc.roundedRect(14, y, pw - 28, obsH, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MAGENTA);
    doc.text('OBSERVACIONES', 18, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.text(obsLines, 18, y + 12);
    y += obsH + 4;
  }

  // ═══════════════════════════════════════
  // RESUMEN EJECUTIVO (KPIs)
  // ═══════════════════════════════════════
  const certStats = { vigentes: 0, proximas: 0, vencidas: 0, pendientes: 0 };
  (baseCertsConfig || []).forEach(bc => {
    const asignada = (maqCerts || []).find(mc => mc.certificacion_id === bc.certificacion_id);
    const { estado } = calcEstadoCert(
      asignada?.obtenida ?? false,
      asignada?.fecha_ultimo_servicio || null,
      bc.vigilar_vencimiento ?? false,
      bc.periodo_inactividad_meses ?? 6,
      bc.aviso_dias ?? 30,
    );
    if (estado === 'Vigente' || estado === 'Obtenida') certStats.vigentes++;
    else if (estado === 'Próxima a vencer') certStats.proximas++;
    else if (estado === 'Vencida') certStats.vencidas++;
    else certStats.pendientes++;
  });

  const exp1603Abiertos = (exps1603 || []).filter(e => e.estado === 'abierto').length;
  const exp1201Abiertos = (exps1201 || []).filter(e => e.estado === 'abierto').length;
  const segAbiertos = (segsEsp || []).filter(s => s.estado === 'abierto').length;

  const today = new Date();
  let hitos1603Vencidos = 0;
  (plans1603 || []).forEach((p: any) => {
    if (!p.actuacion_id && !p.justificado_traslado && p.fin_ventana && new Date(p.fin_ventana) < today) {
      hitos1603Vencidos++;
    }
  });
  let hitos1201Vencidos = 0;
  (plans1201 || []).forEach((p: any) => {
    if (!p.actuacion_id && p.estado !== 'no_procede' && p.fecha_objetivo && new Date(p.fecha_objetivo) < today) {
      hitos1201Vencidos++;
    }
  });

  // KPI grid: 4 columns x 2 rows
  const kpiTitle = (label: string, value: string, color: [number, number, number], col: number, row: number) => {
    const colW = (pw - 28 - 6) / 4; // 3 gaps of 2mm
    const x = 14 + col * (colW + 2);
    const yk = y + row * 18;
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(x, yk, colW, 16, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COOL_GRAY);
    doc.text(label, x + 3, yk + 5);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(value, x + 3, yk + 13);
  };

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('RESUMEN EJECUTIVO', 14, y);
  y += 4;

  kpiTitle('Cert. vigentes', String(certStats.vigentes), GREEN, 0, 0);
  kpiTitle('Cert. próximas', String(certStats.proximas), YELLOW, 1, 0);
  kpiTitle('Cert. vencidas', String(certStats.vencidas), certStats.vencidas > 0 ? RED : COOL_GRAY, 2, 0);
  kpiTitle('Cert. pendientes', String(certStats.pendientes), COOL_GRAY, 3, 0);
  kpiTitle('Exp. 16.03 abiertos', String(exp1603Abiertos), exp1603Abiertos > 0 ? BLUE : COOL_GRAY, 0, 1);
  kpiTitle('Exp. 12.01 abiertos', String(exp1201Abiertos), exp1201Abiertos > 0 ? BLUE : COOL_GRAY, 1, 1);
  kpiTitle('Seg. especiales', String(segAbiertos), segAbiertos > 0 ? BLUE : COOL_GRAY, 2, 1);
  kpiTitle('Hitos vencidos', String(hitos1603Vencidos + hitos1201Vencidos), (hitos1603Vencidos + hitos1201Vencidos) > 0 ? RED : GREEN, 3, 1);

  y += 18 * 2 + 4;
  doc.setTextColor(...DARK);


  // ═══════════════════════════════════════
  // SECCIÓN 1: CERTIFICACIONES
  // ═══════════════════════════════════════
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('1. CERTIFICACIONES', 14, y);
  y += 4;

  const certRows = (baseCertsConfig || []).map(bc => {
    const asignada = (maqCerts || []).find(mc => mc.certificacion_id === bc.certificacion_id);
    const obtenida = asignada?.obtenida ?? false;
    const { estado, diasRestantes } = calcEstadoCert(
      obtenida,
      asignada?.fecha_ultimo_servicio || null,
      bc.vigilar_vencimiento ?? false,
      bc.periodo_inactividad_meses ?? 6,
      bc.aviso_dias ?? 30
    );
    const tipoRenov = asignada?.tipo_renovacion
      ? (asignada.tipo_renovacion === 'servicio' ? 'Servicio' : 'Asesoramiento')
      : '-';
    return [
      bc.certificacion_nombre,
      bc.certificacion_tipo === 'vehiculo' ? 'Vehículo' : 'Línea',
      bc.obligatoria ? 'Sí' : 'No',
      estado,
      asignada?.fecha_ultimo_servicio
        ? format(parseISO(asignada.fecha_ultimo_servicio), 'dd/MM/yyyy')
        : '-',
      tipoRenov,
      diasRestantes !== null ? `${diasRestantes} días` : '-',
    ];
  });

  if (certRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Certificación', 'Tipo', 'Oblig.', 'Estado', 'Últ. Renovación', 'Vía', 'Días Rest.']],
      body: certRows,
      theme: 'grid',
      headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
      bodyStyles: { textColor: DARK },
      tableLineColor: MAGENTA,
      tableLineWidth: 0.5,
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw as string;
          if (val === 'Vigente') data.cell.styles.textColor = GREEN;
          else if (val === 'Próxima a vencer') data.cell.styles.textColor = YELLOW;
          else if (val === 'Vencida') data.cell.styles.textColor = RED;
          else if (val === 'Pendiente') data.cell.styles.textColor = COOL_GRAY;
        }
      },
    });
    y = tableEndY(doc, y) + 6;
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay certificaciones configuradas para esta base.', 18, y + 4);
    y += 8;
  }

  // ═══════════════════════════════════════
  // SECCIÓN 2: PE 16.03
  // ═══════════════════════════════════════
  const allExps1603 = exps1603 || [];
  const LABEL_1603 = 'Dosier — PE 16.03';

  y = needSpace(doc, y, 30, LABEL_1603);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('2. PE 16.03 — VIGILANCIA NUEVO ACCESO', 14, y);
  y += 4;

  if (allExps1603.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay expedientes PE 16.03 para este maquinista.', 18, y + 3);
    y += 8;
  }

  for (const exp of allExps1603) {
    y = needSpace(doc, y, 40, LABEL_1603);

    // Expediente header card
    const cardH = 18;
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(14, y, pw - 28, cardH, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MAGENTA);
    doc.text(`Expediente: ${exp.tipo === 'nuevo_acceso' ? 'Nuevo Acceso' : 'Reincorporación'}`, 18, y + 6);

    const estadoExp = exp.estado === 'abierto' ? 'Abierto' : 'Cerrado';
    doc.setFillColor(...(exp.estado === 'abierto' ? GREEN : COOL_GRAY));
    doc.roundedRect(pw - 48, y + 2, 32, 6, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.text(estadoExp, pw - 32, y + 6.5, { align: 'center' });

    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const fechaIni = format(parseISO(exp.fecha_inicio), 'dd/MM/yyyy');
    const fechaFin = exp.fecha_fin_prevista ? format(parseISO(exp.fecha_fin_prevista), 'dd/MM/yyyy') : 'N/A';
    doc.text(`Período: ${fechaIni} — ${fechaFin}`, 18, y + 13);

    y += cardH + 2;

    // Plan table
    const expPlan = (plans1603 || []).filter(p => p.expediente_id === exp.id);
    const expActs = (acts1603 || []).filter(a => a.expediente_id === exp.id);

    if (expPlan.length > 0) {
      const planRows = expPlan.map(b => {
        const act = expActs.find(a => a.id === b.actuacion_id);
        const isJustified = b.justificado_traslado === true;
        const estado = isJustified ? 'Justificada' : b.actuacion_id ? 'Cumplida' : 'Pendiente';
        const isVencida = !isJustified && !b.actuacion_id && b.fin_ventana && new Date(b.fin_ventana) < new Date();
        const estadoFinal = isVencida ? 'Vencida' : estado;
        return [
          tipoLabels1603[b.tipo] || b.tipo,
          b.etiqueta || `Mes ${b.mes}`,
          b.inicio_ventana && b.fin_ventana
            ? `${format(parseISO(b.inicio_ventana), 'dd/MM/yy')} — ${format(parseISO(b.fin_ventana), 'dd/MM/yy')}`
            : '-',
          estadoFinal,
          act?.fecha_real ? format(parseISO(act.fecha_real), 'dd/MM/yyyy') : '-',
          (isVencida && b.comentario_vencida) ? b.comentario_vencida : '-',
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Tipo', 'Bloque', 'Ventana', 'Estado', 'Fecha Real', 'Comentario']],
        body: planRows,
        theme: 'grid',
        headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
        bodyStyles: { textColor: DARK },
        columnStyles: { 2: { cellWidth: 30 }, 5: { cellWidth: 30 } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            const val = data.cell.raw as string;
            if (val === 'Cumplida') data.cell.styles.textColor = GREEN;
            else if (val === 'Justificada') data.cell.styles.textColor = BLUE;
            else if (val === 'Vencida') data.cell.styles.textColor = RED;
            else data.cell.styles.textColor = COOL_GRAY;
          }
        },
      });
      y = tableEndY(doc, y) + 6;
    }

    // Traslados for this expediente
    const expTraslados = (traslados1603 || []).filter(t => t.expediente_id === exp.id);
    if (expTraslados.length > 0) {
      y = needSpace(doc, y, 20, LABEL_1603);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BLUE);
      doc.text('Traslados registrados', 18, y);
      y += 2;

      const trasladoRows = expTraslados.map(t => [
        format(parseISO(t.fecha_traslado), 'dd/MM/yyyy'),
        t.base_origen,
        t.base_destino,
        t.observaciones || '-',
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Fecha', 'Base Origen', 'Base Destino', 'Observaciones']],
        body: trasladoRows,
        theme: 'grid',
        headStyles: { fillColor: BLUE, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
        bodyStyles: { textColor: DARK },
      });
      y = tableEndY(doc, y) + 6;
    }
  }

  // ═══════════════════════════════════════
  // SECCIÓN 3: PE 12.01
  // ═══════════════════════════════════════
  const allExps1201 = exps1201 || [];
  const LABEL_1201 = 'Dosier — PE 12.01';

  y = needSpace(doc, y, 30, LABEL_1201);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('3. PE 12.01 — FACTOR HUMANO', 14, y);
  y += 4;

  if (allExps1201.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay expedientes PE 12.01 para este maquinista.', 18, y + 3);
    y += 8;
  }

  for (const exp of allExps1201) {
    y = needSpace(doc, y, 40, LABEL_1201);

    // Expediente header card
    const hasDesc = !!exp.descripcion_suceso;
    const cardH = hasDesc ? 22 : 16;
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(14, y, pw - 28, cardH, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MAGENTA);
    doc.text(`Suceso: ${exp.id_suceso}`, 18, y + 6);

    const estadoExp = exp.estado === 'abierto' ? 'Abierto' : 'Cerrado';
    doc.setFillColor(...(exp.estado === 'abierto' ? GREEN : COOL_GRAY));
    doc.roundedRect(pw - 48, y + 2, 32, 6, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.text(estadoExp, pw - 32, y + 6.5, { align: 'center' });

    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const primerServ = format(parseISO(exp.fecha_primer_servicio), 'dd/MM/yyyy');
    const finPrev = exp.fecha_fin_prevista ? format(parseISO(exp.fecha_fin_prevista), 'dd/MM/yyyy') : 'N/A';
    doc.text(`Primer servicio: ${primerServ}  •  Fin previsto: ${finPrev}`, 18, y + 12);
    if (hasDesc) {
      doc.setFontSize(7);
      doc.text(`Descripción: ${exp.descripcion_suceso!.substring(0, 90)}`, 18, y + 18);
    }

    y += cardH + 2;

    // Plan table
    const expPlan = (plans1201 || []).filter(p => p.expediente_id === exp.id);
    const expActs = (acts1201 || []).filter(a => a.expediente_id === exp.id);

    if (expPlan.length > 0) {
      const planRows = expPlan.map(b => {
        const act = expActs.find(a => a.id === (b as any).actuacion_id);
        let estado = b.estado as string;
        const isVencida = estado === 'vencida' || (!act && b.fecha_objetivo && new Date(b.fecha_objetivo) < new Date() && estado !== 'no_procede');
        if (estado === 'no_procede') estado = 'No planificar';
        else if ((b as any).actuacion_id) estado = 'Realizado';
        else if (isVencida) estado = 'Vencida';
        else estado = 'Pendiente';

        return [
          b.tipo === 'acompanamiento' ? 'Acompañamiento' : 'Registro',
          b.etiqueta,
          b.fecha_objetivo ? format(parseISO(b.fecha_objetivo), 'dd/MM/yyyy') : '-',
          estado,
          act?.fecha_real ? format(parseISO(act.fecha_real), 'dd/MM/yyyy') : '-',
          act?.resultado || '-',
          (isVencida && b.comentario_vencida) ? b.comentario_vencida : '-',
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Tipo', 'Hito', 'F. Objetivo', 'Estado', 'F. Real', 'Resultado', 'Comentario']],
        body: planRows,
        theme: 'grid',
        headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
        bodyStyles: { textColor: DARK },
        columnStyles: { 6: { cellWidth: 28 } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            const val = data.cell.raw as string;
            if (val === 'Realizado') data.cell.styles.textColor = GREEN;
            else if (val === 'Vencida') data.cell.styles.textColor = RED;
            else if (val === 'Pendiente') data.cell.styles.textColor = COOL_GRAY;
            else data.cell.styles.textColor = COOL_GRAY;
          }
        },
      });
      y = tableEndY(doc, y) + 6;
    }
  }

  // ═══════════════════════════════════════
  // SECCIÓN 4: SEGUIMIENTOS ESPECIALES
  // ═══════════════════════════════════════
  const allSegsEsp = segsEsp || [];
  const LABEL_SEG = 'Dosier — Seguimiento Especial';

  y = needSpace(doc, y, 30, LABEL_SEG);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('4. SEGUIMIENTO ESPECIAL', 14, y);
  y += 4;

  if (allSegsEsp.length === 0) {
    doc.setFontSize(8);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay seguimientos especiales para este maquinista.', 18, y + 3);
    y += 8;
  }

  const tipoLabelsSeg: Record<string, string> = {
    acompanamiento: 'Acompañamiento',
    registro: 'Registro',
    formativa: 'Acción formativa',
  };

  for (const seg of allSegsEsp) {
    y = needSpace(doc, y, 40, LABEL_SEG);

    const motivoLines = doc.splitTextToSize(seg.motivo || '-', pw - 60);
    const cardH = 18 + Math.max(0, motivoLines.length - 1) * 4;
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(14, y, pw - 28, cardH, 2, 2, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MAGENTA);
    doc.text(`Seguimiento: ${format(parseISO(seg.fecha_inicio), 'dd/MM/yyyy')}`, 18, y + 6);

    const estadoSeg = seg.estado === 'abierto' ? 'Abierto' : 'Cerrado';
    doc.setFillColor(...(seg.estado === 'abierto' ? GREEN : COOL_GRAY));
    doc.roundedRect(pw - 48, y + 2, 32, 6, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(7);
    doc.text(estadoSeg, pw - 32, y + 6.5, { align: 'center' });

    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const metaParts: string[] = [];
    if (seg.fecha_anomalia) metaParts.push(`Anomalía: ${format(parseISO(seg.fecha_anomalia), 'dd/MM/yyyy')}`);
    if (seg.indice_prever != null) metaParts.push(`PREVER: ${seg.indice_prever}`);
    if (seg.fecha_fin) metaParts.push(`Fin: ${format(parseISO(seg.fecha_fin), 'dd/MM/yyyy')}`);
    if (metaParts.length) doc.text(metaParts.join('  •  '), 18, y + 12);
    doc.setFontSize(7);
    doc.text(motivoLines, 18, y + (metaParts.length ? 16 : 12));

    y += cardH + 2;

    const acciones = (planSegEsp || []).filter((a: any) => a.seguimiento_id === seg.id);
    if (acciones.length > 0) {
      const rows = acciones.map((a: any) => {
        let estado = a.estado as string;
        const isVencida = estado === 'vencida' || (estado === 'pendiente' && a.fecha_objetivo && new Date(a.fecha_objetivo) < new Date());
        if (estado === 'cumplida') estado = 'Cumplida';
        else if (isVencida) estado = 'Vencida';
        else estado = 'Pendiente';
        return [
          tipoLabelsSeg[a.tipo] || a.tipo,
          a.fecha_objetivo ? format(parseISO(a.fecha_objetivo), 'dd/MM/yyyy') : '-',
          estado,
          a.fecha_real ? format(parseISO(a.fecha_real), 'dd/MM/yyyy') : '-',
          a.resultado || '-',
          a.observaciones || (isVencida && a.comentario_vencida ? a.comentario_vencida : '-'),
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Tipo', 'F. Objetivo', 'Estado', 'F. Real', 'Resultado', 'Notas']],
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
        bodyStyles: { textColor: DARK },
        columnStyles: { 5: { cellWidth: 40 } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 2) {
            const val = data.cell.raw as string;
            if (val === 'Cumplida') data.cell.styles.textColor = GREEN;
            else if (val === 'Vencida') data.cell.styles.textColor = RED;
            else data.cell.styles.textColor = COOL_GRAY;
          }
        },
      });
      y = tableEndY(doc, y) + 6;
    }
  }

  // ═══════════════════════════════════════
  // SECCIÓN 5: PLAN ANUAL DE ACCIÓN
  // ═══════════════════════════════════════
  const LABEL_PLAN = `Dosier — Plan Anual ${currentYear}`;
  y = needSpace(doc, y, 30, LABEL_PLAN);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text(`5. PLAN ANUAL DE ACCIÓN — ${currentYear}`, 14, y);
  y += 4;

  // Merge actuaciones del plan anual con acompañamientos/registros de PE 16.03 del año
  const acts1603Year = (acts1603 || []).filter((a: any) =>
    a.fecha_real && a.fecha_real >= yearStart && a.fecha_real <= yearEnd
    && (a.tipo === 'acompanamiento' || a.tipo === 'registro')
  );

  const allYearActs: any[] = [
    ...((actsPlanAnual || []) as any[]).map(a => ({ ...a, _src: 'PA' })),
    ...acts1603Year.map((a: any) => ({ ...a, _src: '16.03', red: a.red || null })),
  ];

  // KM por red y acompañamientos por red
  const kmPorRed: Record<string, number> = { convencional: 0, av: 0 };
  const acompPorRed: Record<string, number> = { convencional: 0, av: 0 };
  allYearActs.forEach(a => {
    const red = a.red || 'convencional';
    if ((a.tipo === 'acompanamiento' || a.tipo === 'registro') && a.km_recorridos) {
      kmPorRed[red] = (kmPorRed[red] || 0) + Number(a.km_recorridos);
    }
    if (a.tipo === 'acompanamiento') {
      acompPorRed[red] = (acompPorRed[red] || 0) + 1;
    }
  });

  // ¿PE 12.01 reciente (últimos 3 años)? → 2 acompañamientos por red, si no 1
  const threeYearsAgo = `${currentYear - 3}-01-01`;
  const tuvo1201Reciente = (exps1201 || []).some((e: any) =>
    e.fecha_primer_servicio && e.fecha_primer_servicio >= threeYearsAgo
  );
  const REQ_KM = 100;
  const REQ_ACOMP = tuvo1201Reciente ? 2 : 1;

  // Conteos anuales de alcohol/drogas
  const ctrlAlcohol = allYearActs.filter(a => a.tipo === 'alcohol').length;
  const ctrlDrogas = allYearActs.filter(a => a.tipo === 'drogas').length;
  const REQ_ALCOHOL = 1;

  // Tabla completa de criterios
  const critRows: any[] = [];
  baseRedes.forEach(red => {
    const redLabel = red === 'av' ? 'Alta Velocidad' : 'Convencional';
    const km = Math.round(kmPorRed[red] || 0);
    critRows.push([
      `Km analizados — ${redLabel}`,
      `${km} km`,
      `≥ ${REQ_KM} km`,
      km >= REQ_KM ? 'Cumple' : 'No cumple',
    ]);
    const ac = acompPorRed[red] || 0;
    critRows.push([
      `Acompañamientos — ${redLabel}${tuvo1201Reciente ? ' (PE 12.01 reciente)' : ''}`,
      `${ac}`,
      `≥ ${REQ_ACOMP}`,
      ac >= REQ_ACOMP ? 'Cumple' : 'No cumple',
    ]);
  });
  critRows.push([
    'Control de Alcohol (obligatorio)',
    `${ctrlAlcohol}`,
    `≥ ${REQ_ALCOHOL}`,
    ctrlAlcohol >= REQ_ALCOHOL ? 'Cumple' : 'No cumple',
  ]);
  critRows.push([
    'Control de Drogas (contribuye 25% base)',
    `${ctrlDrogas}`,
    '≥ 1 (individual)',
    ctrlDrogas >= 1 ? 'Cumple' : 'Sin registro',
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Criterio', 'Cumplido', 'Requisito', 'Estado']],
    body: critRows,
    theme: 'grid',
    headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
    bodyStyles: { textColor: DARK },
    columnStyles: { 0: { cellWidth: 80 } },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.raw as string;
        data.cell.styles.textColor = val === 'Cumple' ? GREEN : val === 'Sin registro' ? COOL_GRAY : RED;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = tableEndY(doc, y) + 6;

  // Detalle de actuaciones del año
  if (allYearActs.length > 0) {
    y = needSpace(doc, y, 20, LABEL_PLAN);
    const tipoLabelsPA: Record<string, string> = {
      acompanamiento: 'Acompañamiento',
      registro: 'Registro',
      alcohol: 'Alcohol',
      drogas: 'Drogas',
    };
    const detailRows = allYearActs
      .sort((a, b) => (a.fecha_real || '').localeCompare(b.fecha_real || ''))
      .map(a => [
        a.fecha_real ? format(parseISO(a.fecha_real), 'dd/MM/yyyy') : '-',
        tipoLabelsPA[a.tipo] || a.tipo,
        a.red === 'av' ? 'AV' : a.red === 'convencional' ? 'Conv.' : '-',
        a.km_recorridos != null ? `${a.km_recorridos}` : '-',
        a.indice_prever != null ? `${a.indice_prever}` : '-',
        a.resultado || '-',
        a._src,
      ]);

    autoTable(doc, {
      startY: y,
      head: [['Fecha', 'Tipo', 'Red', 'Km', 'PREVER', 'Resultado', 'Origen']],
      body: detailRows,
      theme: 'grid',
      headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
      bodyStyles: { textColor: DARK },
    });
    y = tableEndY(doc, y) + 6;
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...COOL_GRAY);
    doc.text(`Sin actuaciones registradas en ${currentYear}.`, 18, y + 3);
    y += 8;
  }

  // ── Footers on all pages ──
  addFooters(doc);


  // ── Save ──
  const filename = `Dosier_${maq.matricula}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
