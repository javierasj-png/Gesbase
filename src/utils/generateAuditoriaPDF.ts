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

function addPageHeader(doc: jsPDF, text: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, 12, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.text(text, pw / 2, 8, { align: 'center' });
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
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pw - 14, ph - 8, { align: 'right' });
  }
}

function getLastY(doc: jsPDF, fallback: number): number {
  return (doc as any).lastAutoTable?.finalY || fallback;
}

function ensureSpace(doc: jsPDF, needed: number, headerLabel: string): number {
  const ph = doc.internal.pageSize.getHeight();
  const currentY = getLastY(doc, 20);
  if (currentY + needed > ph - 20) {
    doc.addPage();
    addPageHeader(doc, headerLabel);
    return 20;
  }
  return currentY;
}

interface AuditoriaPDFOptions {
  bases: string[];
  baseFilter: string;
}

export async function generateAuditoriaPDF(options: AuditoriaPDFOptions) {
  const { bases, baseFilter } = options;
  const basesToReport = baseFilter === 'all' ? bases : [baseFilter];

  if (basesToReport.length === 0) throw new Error('No hay bases para reportar');

  // Fetch all bases config
  const { data: basesConduccion } = await supabase
    .from('bases_conduccion')
    .select('id, nombre')
    .in('nombre', basesToReport);

  const baseIds = (basesConduccion || []).map(b => b.id);

  // Fetch base certificaciones config
  const { data: baseCertsConfig } = baseIds.length > 0
    ? await supabase.from('base_certificaciones').select('*').in('base_id', baseIds)
    : { data: [] as any[] };

  // Fetch all maquinistas for the bases
  const { data: allMaquinistas } = await supabase
    .from('maquinistas')
    .select('*')
    .in('base', basesToReport)
    .eq('activo', true)
    .order('base')
    .order('apellidos');

  const maqs = allMaquinistas || [];
  const maqIds = maqs.map(m => m.id);

  // Fetch all data in parallel
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

  // Fetch plans and actuaciones
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

  // ── Cover ──
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, 44, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE AUDITORÍA SGS', pw / 2, 18, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(`Base: ${baseLabel}`, pw / 2, 28, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pw / 2, 38, { align: 'center' });

  // ══════════════════════════════════════════
  // SECCIÓN 1: CONTROL DE CERTIFICACIONES
  // ══════════════════════════════════════════
  let y = 54;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('1. CONTROL DE CERTIFICACIONES', 14, y);
  y += 8;

  for (const baseNombre of basesToReport) {
    const baseMaqs = maqs.filter(m => m.base === baseNombre);
    if (baseMaqs.length === 0) continue;

    const baseRecord = (basesConduccion || []).find(b => b.nombre === baseNombre);
    const baseCerts = (baseCertsConfig || []).filter((bc: any) => bc.base_id === baseRecord?.id);

    // Base sub-header
    y = ensureSpace(doc, 20, 'Informe Auditoría — Certificaciones');
    y = getLastY(doc, y);
    y += 4;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`Base: ${baseNombre}`, 14, y);
    y += 6;

    // Build rows: one row per maquinista with cert summary
    const certRows = baseMaqs.map(maq => {
      const maqCerts = (allMaqCerts || []).filter((mc: any) => mc.maquinista_id === maq.id);
      
      let vigentes = 0;
      let proximas = 0;
      let vencidas = 0;
      let pendientes = 0;
      let obtenidas = 0;

      baseCerts.forEach((bc: any) => {
        const asignada = maqCerts.find((mc: any) => mc.certificacion_id === bc.certificacion_id);
        const obt = asignada?.obtenida ?? false;
        const { estado } = calcEstadoCert(
          obt,
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
      columnStyles: {
        0: { cellWidth: 50 },
      },
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
    y = getLastY(doc, y);
  }

  // ══════════════════════════════════════════
  // SECCIÓN 2: FICHAS PE 16.03
  // ══════════════════════════════════════════
  doc.addPage();
  addPageHeader(doc, 'Informe Auditoría — PE 16.03');
  y = 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('2. FICHAS DE SEGUIMIENTO PE 16.03', 14, y);
  y += 6;

  const exps1603ByBase = basesToReport.map(baseNombre => {
    const baseMaqs = maqs.filter(m => m.base === baseNombre);
    const baseMaqIds = baseMaqs.map(m => m.id);
    const exps = (allExps1603 || []).filter((e: any) => baseMaqIds.includes(e.maquinista_id));
    return { baseNombre, exps, baseMaqs };
  }).filter(b => b.exps.length > 0);

  if (exps1603ByBase.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay expedientes PE 16.03 en las bases seleccionadas.', 20, y + 6);
  }

  for (const { baseNombre, exps, baseMaqs } of exps1603ByBase) {
    y = ensureSpace(doc, 20, 'Informe Auditoría — PE 16.03');
    y = getLastY(doc, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`Base: ${baseNombre}`, 14, y);
    y += 6;

    for (const exp of exps) {
      const maq = baseMaqs.find(m => m.id === exp.maquinista_id);
      if (!maq) continue;

      y = ensureSpace(doc, 50, 'Informe Auditoría — PE 16.03');
      y = getLastY(doc, y);
      y += 4;

      // Maquinista + expediente header
      doc.setFillColor(...CARD_BG);
      doc.roundedRect(14, y, pw - 28, 18, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MAGENTA);
      doc.text(`${maq.apellidos}, ${maq.nombre} — Matrícula: ${maq.matricula}`, 20, y + 7);

      const estadoExp = exp.estado === 'abierto' ? 'Abierto' : 'Cerrado';
      doc.setFillColor(...(exp.estado === 'abierto' ? GREEN : COOL_GRAY));
      doc.roundedRect(pw - 48, y + 2, 34, 7, 2, 2, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(7);
      doc.text(estadoExp, pw - 31, y + 7, { align: 'center' });

      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const fechaIni = format(parseISO(exp.fecha_inicio), 'dd/MM/yyyy');
      const fechaFin = exp.fecha_fin_prevista ? format(parseISO(exp.fecha_fin_prevista), 'dd/MM/yyyy') : 'N/A';
      doc.text(`Período: ${fechaIni} — ${fechaFin}  |  Tipo: ${exp.tipo === 'nuevo_acceso' ? 'Nuevo Acceso' : 'Reincorporación'}`, 20, y + 14);

      y += 22;

      const expPlan = (plans1603 || []).filter((p: any) => p.expediente_id === exp.id);
      const expActs = (acts1603 || []).filter((a: any) => a.expediente_id === exp.id);

      if (expPlan.length > 0) {
        // Cumplimiento
        const cumplidas = expPlan.filter((p: any) => p.actuacion_id).length;
        const pctCumplimiento = Math.round((cumplidas / expPlan.length) * 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const color = pctCumplimiento >= 80 ? GREEN : pctCumplimiento >= 50 ? YELLOW : RED;
        doc.setTextColor(...color);
        doc.text(`Cumplimiento: ${pctCumplimiento}% (${cumplidas}/${expPlan.length})`, 20, y);
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
          headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
          styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.5 },
          bodyStyles: { textColor: DARK },
          columnStyles: { 2: { cellWidth: 36 } },
          didParseCell: (data: any) => {
            if (data.section === 'body' && data.column.index === 3) {
              data.cell.styles.textColor = data.cell.raw === 'Cumplida' ? GREEN : RED;
            }
          },
        });
        y = getLastY(doc, y);
      }
    }
  }

  // ══════════════════════════════════════════
  // SECCIÓN 3: FICHAS PE 12.01
  // ══════════════════════════════════════════
  doc.addPage();
  addPageHeader(doc, 'Informe Auditoría — PE 12.01');
  y = 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('3. FICHAS DE SEGUIMIENTO PE 12.01', 14, y);
  y += 6;

  const exps1201ByBase = basesToReport.map(baseNombre => {
    const baseMaqs = maqs.filter(m => m.base === baseNombre);
    const baseMaqIds = baseMaqs.map(m => m.id);
    const exps = (allExps1201 || []).filter((e: any) => baseMaqIds.includes(e.maquinista_id));
    return { baseNombre, exps, baseMaqs };
  }).filter(b => b.exps.length > 0);

  if (exps1201ByBase.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...COOL_GRAY);
    doc.text('No hay expedientes PE 12.01 en las bases seleccionadas.', 20, y + 6);
  }

  for (const { baseNombre, exps, baseMaqs } of exps1201ByBase) {
    y = ensureSpace(doc, 20, 'Informe Auditoría — PE 12.01');
    y = getLastY(doc, y);
    y += 6;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`Base: ${baseNombre}`, 14, y);
    y += 6;

    for (const exp of exps) {
      const maq = baseMaqs.find(m => m.id === exp.maquinista_id);
      if (!maq) continue;

      y = ensureSpace(doc, 50, 'Informe Auditoría — PE 12.01');
      y = getLastY(doc, y);
      y += 4;

      doc.setFillColor(...CARD_BG);
      doc.roundedRect(14, y, pw - 28, 22, 3, 3, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...MAGENTA);
      doc.text(`${maq.apellidos}, ${maq.nombre} — Suceso: ${exp.id_suceso}`, 20, y + 7);

      const estadoExp = exp.estado === 'abierto' ? 'Abierto' : 'Cerrado';
      doc.setFillColor(...(exp.estado === 'abierto' ? GREEN : COOL_GRAY));
      doc.roundedRect(pw - 48, y + 2, 34, 7, 2, 2, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(7);
      doc.text(estadoExp, pw - 31, y + 7, { align: 'center' });

      doc.setTextColor(...DARK);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const primerServ = format(parseISO(exp.fecha_primer_servicio), 'dd/MM/yyyy');
      const finPrev = exp.fecha_fin_prevista ? format(parseISO(exp.fecha_fin_prevista), 'dd/MM/yyyy') : 'N/A';
      doc.text(`Primer servicio: ${primerServ}  |  Fin previsto: ${finPrev}`, 20, y + 14);
      if (exp.descripcion_suceso) {
        doc.text(`Descripción: ${exp.descripcion_suceso.substring(0, 90)}`, 20, y + 19);
      }

      y += 26;

      const expPlan = (plans1201 || []).filter((p: any) => p.expediente_id === exp.id);
      const expActs = (acts1201 || []).filter((a: any) => a.expediente_id === exp.id);

      if (expPlan.length > 0) {
        const bloquesQueProceden = expPlan.filter((p: any) => p.estado !== 'no_procede').length;
        const realizados = expPlan.filter((p: any) => p.actuacion_id && p.estado !== 'no_procede').length;
        const pct = bloquesQueProceden > 0 ? Math.round((realizados / bloquesQueProceden) * 100) : 0;
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const color = pct >= 80 ? GREEN : pct >= 50 ? YELLOW : RED;
        doc.setTextColor(...color);
        doc.text(`Cumplimiento: ${pct}% (${realizados}/${bloquesQueProceden})`, 20, y);
        y += 4;

        const planRows = expPlan.map((b: any) => {
          const act = expActs.find((a: any) => a.id === b.actuacion_id);
          let estado = b.estado as string;
          if (estado === 'no_procede') estado = 'No procede';
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
          headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
          styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.5 },
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
        y = getLastY(doc, y);
      }
    }
  }

  // ── Footers ──
  addFooters(doc, 'Informe Auditoría SGS');

  // ── Save ──
  const filename = `Auditoria_SGS_${baseFilter === 'all' ? 'Global' : baseFilter}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(filename);
}
