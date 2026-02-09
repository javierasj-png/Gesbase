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
  doc.rect(0, 0, pw, 12, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.text(text, pw / 2, 8, { align: 'center' });
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

function ensureSpace(doc: jsPDF, needed: number, continueLabel: string): number {
  const ph = doc.internal.pageSize.getHeight();
  const currentY = (doc as any).lastAutoTable?.finalY || 20;
  if (currentY + needed > ph - 20) {
    doc.addPage();
    addPageHeader(doc, continueLabel);
    return 20;
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

  // Get base certificaciones config
  const baseRecord = baseData?.find(b => b.nombre === maq.base);
  const { data: baseCertsConfig } = baseRecord
    ? await supabase.from('base_certificaciones').select('*').eq('base_id', baseRecord.id)
    : { data: [] };

  // Fetch plans and actuaciones for all expedientes
  const exp1603Ids = (exps1603 || []).map(e => e.id);
  const exp1201Ids = (exps1201 || []).map(e => e.id);

  const [
    { data: plans1603 },
    { data: acts1603 },
    { data: plans1201 },
    { data: acts1201 },
  ] = await Promise.all([
    exp1603Ids.length > 0
      ? supabase.from('plan_1603').select('*').in('expediente_id', exp1603Ids).order('tipo').order('mes')
      : Promise.resolve({ data: [] }),
    exp1603Ids.length > 0
      ? supabase.from('actuaciones_1603').select('*').in('expediente_id', exp1603Ids).order('fecha_real')
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
  doc.rect(0, 0, pw, 40, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('DOSSIER DEL MAQUINISTA', pw / 2, 18, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(nombreCompleto, pw / 2, 28, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pw / 2, 36, { align: 'center' });

  // ── Ficha del maquinista ──
  doc.setTextColor(0, 0, 0);
  doc.setFillColor(...CARD_BG);
  doc.roundedRect(14, 48, pw - 28, 30, 3, 3, 'F');

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('DATOS DEL MAQUINISTA', 20, 58);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.text(`Matrícula: ${maq.matricula}`, 20, 65);
  doc.text(`Base: ${maq.base}`, 80, 65);
  doc.text(`Estado: ${maq.activo ? 'Activo' : 'Inactivo'}`, 140, 65);
  if (maq.fecha_ingreso) {
    doc.text(`Ingreso: ${format(parseISO(maq.fecha_ingreso), 'dd/MM/yyyy')}`, 20, 72);
  }
  if (maq.email) doc.text(`Email: ${maq.email}`, 80, 72);

  // ═══════════════════════════════════════
  // SECCIÓN 1: CERTIFICACIONES
  // ═══════════════════════════════════════
  let y = 88;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('1. CERTIFICACIONES', 14, y);
  y += 6;

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
    return [
      bc.certificacion_nombre,
      bc.certificacion_tipo === 'vehiculo' ? 'Vehículo' : 'Línea',
      bc.obligatoria ? 'Sí' : 'No',
      estado,
      asignada?.fecha_ultimo_servicio
        ? format(parseISO(asignada.fecha_ultimo_servicio), 'dd/MM/yyyy')
        : '-',
      diasRestantes !== null ? `${diasRestantes} días` : '-',
    ];
  });

  if (certRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Certificación', 'Tipo', 'Obligatoria', 'Estado', 'Último Servicio', 'Días Restantes']],
      body: certRows,
      theme: 'grid',
      headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3, lineColor: COOL_GRAY, lineWidth: 0.5 },
      bodyStyles: { textColor: DARK },
      tableLineColor: MAGENTA,
      tableLineWidth: 0.75,
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
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay certificaciones configuradas para esta base.', 20, y + 6);
  }

  // ═══════════════════════════════════════
  // SECCIÓN 2: PE 16.03
  // ═══════════════════════════════════════
  const allExps1603 = exps1603 || [];
  doc.addPage();
  addPageHeader(doc, 'Dossier Maquinista — PE 16.03');

  y = 22;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('2. PE 16.03 — VIGILANCIA NUEVO ACCESO', 14, y);
  y += 4;

  if (allExps1603.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay expedientes PE 16.03 para este maquinista.', 20, y + 6);
  }

  for (const exp of allExps1603) {
    y = ensureSpace(doc, 60, 'Dossier Maquinista — PE 16.03');
    y = (doc as any).lastAutoTable?.finalY || y;
    y += 8;

    // Expediente header
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(14, y, pw - 28, 20, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MAGENTA);
    doc.text(`Expediente: ${exp.tipo === 'nuevo_acceso' ? 'Nuevo Acceso' : 'Reincorporación'}`, 20, y + 8);
    
    const estadoExp = exp.estado === 'abierto' ? 'Abierto' : 'Cerrado';
    doc.setFillColor(...(exp.estado === 'abierto' ? GREEN : COOL_GRAY));
    doc.roundedRect(pw - 50, y + 2, 36, 8, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.text(estadoExp, pw - 32, y + 7.5, { align: 'center' });

    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const fechaIni = format(parseISO(exp.fecha_inicio), 'dd/MM/yyyy');
    const fechaFin = exp.fecha_fin_prevista ? format(parseISO(exp.fecha_fin_prevista), 'dd/MM/yyyy') : 'N/A';
    doc.text(`Período: ${fechaIni} — ${fechaFin}`, 20, y + 15);

    y += 24;

    // Plan blocks
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
        headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 2.5, lineColor: COOL_GRAY, lineWidth: 0.5 },
        bodyStyles: { textColor: DARK },
        columnStyles: { 2: { cellWidth: 36 } },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            data.cell.styles.textColor = data.cell.raw === 'Cumplida' ? GREEN : RED;
          }
        },
      });

      y = (doc as any).lastAutoTable?.finalY || y;
    }
  }

  // ═══════════════════════════════════════
  // SECCIÓN 3: PE 12.01
  // ═══════════════════════════════════════
  const allExps1201 = exps1201 || [];
  doc.addPage();
  addPageHeader(doc, 'Dossier Maquinista — PE 12.01');

  y = 22;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('3. PE 12.01 — FACTOR HUMANO', 14, y);
  y += 4;

  if (allExps1201.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay expedientes PE 12.01 para este maquinista.', 20, y + 6);
  }

  for (const exp of allExps1201) {
    y = ensureSpace(doc, 60, 'Dossier Maquinista — PE 12.01');
    y = (doc as any).lastAutoTable?.finalY || y;
    y += 8;

    // Expediente header
    doc.setFillColor(...CARD_BG);
    doc.roundedRect(14, y, pw - 28, 24, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MAGENTA);
    doc.text(`Suceso: ${exp.id_suceso}`, 20, y + 8);

    const estadoExp = exp.estado === 'abierto' ? 'Abierto' : 'Cerrado';
    doc.setFillColor(...(exp.estado === 'abierto' ? GREEN : COOL_GRAY));
    doc.roundedRect(pw - 50, y + 2, 36, 8, 2, 2, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.text(estadoExp, pw - 32, y + 7.5, { align: 'center' });

    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const primerServ = format(parseISO(exp.fecha_primer_servicio), 'dd/MM/yyyy');
    const finPrev = exp.fecha_fin_prevista ? format(parseISO(exp.fecha_fin_prevista), 'dd/MM/yyyy') : 'N/A';
    doc.text(`Primer servicio: ${primerServ}   •   Fin previsto: ${finPrev}`, 20, y + 15);
    if (exp.descripcion_suceso) {
      doc.text(`Descripción: ${exp.descripcion_suceso.substring(0, 80)}`, 20, y + 21);
    }

    y += 28;

    // Plan blocks
    const expPlan = (plans1201 || []).filter(p => p.expediente_id === exp.id);
    const expActs = (acts1201 || []).filter(a => a.expediente_id === exp.id);

    if (expPlan.length > 0) {
      const planRows = expPlan.map(b => {
        const act = expActs.find(a => a.id === (b as any).actuacion_id);
        let estado = b.estado as string;
        if (estado === 'no_procede') estado = 'No procede';
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
        head: [['Tipo', 'Hito', 'Fecha Objetivo', 'Estado', 'Fecha Real', 'Resultado']],
        body: planRows,
        theme: 'grid',
        headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
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

      y = (doc as any).lastAutoTable?.finalY || y;
    }
  }

  // ── Footers on all pages ──
  addFooters(doc);

  // ── Save ──
  const filename = `Dossier_${maq.matricula}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
