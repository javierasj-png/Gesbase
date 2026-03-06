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
    doc.text(`Dossier Maquinista — Página ${i} de ${pageCount}`, pw / 2, ph - 8, { align: 'center' });
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
  // ── 1. Fetch all data in parallel ──
  const [
    { data: maq },
    { data: baseData },
    { data: maqCerts },
    { data: exps1603 },
    { data: exps1201 },
  ] = await Promise.all([
    supabase.from('maquinistas').select('*').eq('id', maquinistaId).single(),
    supabase.from('bases_conduccion').select('id, nombre').order('nombre'),
    supabase.from('maquinista_certificaciones').select('*').eq('maquinista_id', maquinistaId),
    supabase.from('expedientes_1603').select('*').eq('maquinista_id', maquinistaId).order('created_at', { ascending: false }),
    supabase.from('expedientes_1201').select('*').eq('maquinista_id', maquinistaId).order('created_at', { ascending: false }),
  ]);

  if (!maq) throw new Error('Maquinista no encontrado');

  const baseRecord = baseData?.find(b => b.nombre === maq.base);
  const { data: baseCertsConfig } = baseRecord
    ? await supabase.from('base_certificaciones').select('*').eq('base_id', baseRecord.id)
    : { data: [] };

  const exp1603Ids = (exps1603 || []).map(e => e.id);
  const exp1201Ids = (exps1201 || []).map(e => e.id);

  const [
    { data: plans1603 },
    { data: acts1603 },
    { data: traslados1603 },
    { data: plans1201 },
    { data: acts1201 },
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
  ]);

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
  doc.text('DOSSIER DEL MAQUINISTA', pw / 2, 16, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(nombreCompleto, pw / 2, 24, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pw / 2, 32, { align: 'center' });

  // ── Ficha del maquinista ──
  let y = 42;
  doc.setFillColor(...CARD_BG);
  const fichaH = maq.fecha_ingreso || maq.email ? 24 : 16;
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
  if (maq.fecha_ingreso) {
    doc.text(`Ingreso: ${format(parseISO(maq.fecha_ingreso), 'dd/MM/yyyy')}`, 18, y + 18);
  }
  if (maq.email) doc.text(`Email: ${maq.email}`, 75, y + 18);

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
  const LABEL_1603 = 'Dossier — PE 16.03';

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
        const estado = b.actuacion_id ? 'Cumplida' : 'Pendiente';
        return [
          tipoLabels1603[b.tipo] || b.tipo,
          b.etiqueta || `Mes ${b.mes}`,
          b.inicio_ventana && b.fin_ventana
            ? `${format(parseISO(b.inicio_ventana), 'dd/MM/yy')} — ${format(parseISO(b.fin_ventana), 'dd/MM/yy')}`
            : '-',
          estado,
          act?.fecha_real ? format(parseISO(act.fecha_real), 'dd/MM/yyyy') : '-',
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['Tipo', 'Bloque', 'Ventana', 'Estado', 'Fecha Real']],
        body: planRows,
        theme: 'grid',
        headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
        bodyStyles: { textColor: DARK },
        columnStyles: { 2: { cellWidth: 34 } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            data.cell.styles.textColor = data.cell.raw === 'Cumplida' ? GREEN : RED;
          }
        },
      });
      y = tableEndY(doc, y) + 6;
    }
  }

  // ═══════════════════════════════════════
  // SECCIÓN 3: PE 12.01
  // ═══════════════════════════════════════
  const allExps1201 = exps1201 || [];
  const LABEL_1201 = 'Dossier — PE 12.01';

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
        if (estado === 'no_procede') estado = 'No planificar';
        else if ((b as any).actuacion_id) estado = 'Realizado';
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
        head: [['Tipo', 'Hito', 'F. Objetivo', 'Estado', 'F. Real', 'Resultado']],
        body: planRows,
        theme: 'grid',
        headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
        styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.3 },
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
      y = tableEndY(doc, y) + 6;
    }
  }

  // ── Footers on all pages ──
  addFooters(doc);

  // ── Save ──
  const filename = `Dossier_${maq.matricula}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
