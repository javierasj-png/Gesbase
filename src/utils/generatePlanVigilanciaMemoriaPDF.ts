import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const MAGENTA: [number, number, number] = [130, 0, 94];
const COOL_GRAY: [number, number, number] = [152, 153, 155];
const WHITE: [number, number, number] = [255, 255, 255];
const DARK: [number, number, number] = [30, 41, 59];
const GREEN: [number, number, number] = [34, 197, 94];
const RED: [number, number, number] = [239, 68, 68];

const MARGIN = 14;

function fmt(d?: string | null) {
  return d ? format(parseISO(d), 'dd/MM/yyyy') : '-';
}

/**
 * Memoria del plan (PDF) — resumen ejecutivo, indicadores y detalle de acciones.
 */
export async function generatePlanVigilanciaMemoriaPDF(planId: string) {
  const { data: plan, error } = await supabase
    .from('planes_vigilancia')
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (error) throw error;
  if (!plan) throw new Error('Plan no encontrado');

  const [{ data: acciones }, { data: tipos }] = await Promise.all([
    supabase
      .from('planes_vigilancia_acciones')
      .select('*')
      .eq('plan_id', planId)
      .order('fecha_prevista'),
    supabase.from('tipos_accion_vigilancia').select('id, nombre'),
  ]);

  const accs = (acciones as any[]) || [];
  const maqIds = [...new Set(accs.map((a) => a.maquinista_id))];
  const { data: maquinistas } = maqIds.length
    ? await supabase.from('maquinistas').select('id, matricula, nombre, apellidos').in('id', maqIds)
    : { data: [] as any[] };

  const maqMap = new Map((maquinistas || []).map((m: any) => [m.id, m]));
  const tipoMap = new Map(((tipos as any[]) || []).map((t) => [t.id, t.nombre]));
  const nombreTipo = (a: any) => a.tipo_accion_libre || tipoMap.get(a.tipo_accion) || a.tipo_accion;

  const total = accs.length;
  const realizadas = accs.filter((a) => a.estado === 'realizada').length;
  const noRealizadas = accs.filter((a) => a.estado === 'no_realizada').length;
  const pendientes = total - realizadas - noRealizadas;
  const conformes = accs.filter((a) => a.resultado === 'conforme').length;
  const noConformes = accs.filter((a) => a.resultado === 'no_conforme').length;
  const comunicadas = accs.filter((a) => a.resultado === 'no_conforme' && a.comunicada).length;
  const progreso = total > 0 ? Math.round((realizadas / total) * 100) : 0;

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();

  // Portada
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, 42, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MEMORIA DEL PLAN', pw / 2, 16, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(plan.nombre, pw / 2, 26, { align: 'center' });
  doc.setFontSize(9);
  doc.text(
    `${plan.categoria === 'especifico' ? 'Plan específico de vigilancia' : 'Campaña / sondeo'} · Base: ${plan.base}`,
    pw / 2,
    34,
    { align: 'center' }
  );
  doc.setTextColor(...DARK);

  let y = 52;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('1. DATOS DEL PLAN', MARGIN, y);
  y += 6;
  doc.setTextColor(...DARK);

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    body: [
      ['Periodo', `${fmt(plan.fecha_inicio)} – ${fmt(plan.fecha_fin)}`],
      ['Estado', plan.estado],
      ['Responsable', plan.responsable || '-'],
      [
        'Alcance',
        plan.modo_alcance === 'porcentaje'
          ? `${plan.porcentaje}% de la base`
          : plan.modo_alcance === 'todos'
            ? 'Toda la base'
            : 'Maquinistas concretos',
      ],
      ['Maquinistas incluidos', String(maqIds.length)],
      ['Descripción', plan.descripcion || '-'],
      ['Archivado', plan.archived_at ? format(new Date(plan.archived_at), 'dd/MM/yyyy HH:mm') : '-'],
    ],
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: COOL_GRAY, lineWidth: 0.4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 45 } },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('2. RESULTADOS', MARGIN, y);
  y += 6;
  doc.setTextColor(...DARK);

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Indicador', 'Valor']],
    body: [
      ['Acciones planificadas', String(total)],
      ['Realizadas', `${realizadas} (${progreso}%)`],
      ['No realizadas', String(noRealizadas)],
      ['Pendientes', String(pendientes)],
      ['Resultado conforme', String(conformes)],
      ['No conformidades', String(noConformes)],
      ['No conformidades comunicadas', `${comunicadas} de ${noConformes}`],
    ],
    headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: COOL_GRAY, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 70 } },
  });
  y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MAGENTA);
  doc.text('3. DETALLE DE ACCIONES', MARGIN, y);
  y += 4;
  doc.setTextColor(...DARK);

  const rows = accs.map((a) => {
    const m = maqMap.get(a.maquinista_id) as any;
    return [
      m ? `${m.apellidos}, ${m.nombre}` : '-',
      m?.matricula || '-',
      nombreTipo(a),
      fmt(a.fecha_prevista),
      fmt(a.fecha_real),
      a.estado === 'realizada' ? 'Realizada' : a.estado === 'no_realizada' ? 'No realizada' : 'Pendiente',
      a.resultado === 'conforme' ? 'Conforme' : a.resultado === 'no_conforme' ? 'No conforme' : '-',
      a.resultado === 'no_conforme' ? (a.comunicada ? `Sí ${a.comunicada_at ? format(new Date(a.comunicada_at), 'dd/MM/yy') : ''}` : 'No') : '-',
      (a.observaciones || '').substring(0, 60) || '-',
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [['Maquinista', 'Matrícula', 'Acción', 'Prevista', 'Real', 'Estado', 'Resultado', 'Comunicada', 'Observaciones']],
    body: rows.length ? rows : [['-', '-', '-', '-', '-', '-', '-', '-', 'Sin acciones registradas']],
    theme: 'grid',
    headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
    styles: { fontSize: 6.5, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.4 },
    bodyStyles: { textColor: DARK },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 5) {
        const v = data.cell.raw as string;
        if (v === 'Realizada') data.cell.styles.textColor = GREEN;
        else if (v === 'No realizada') data.cell.styles.textColor = RED;
      }
      if (data.section === 'body' && data.column.index === 6) {
        const v = data.cell.raw as string;
        if (v === 'Conforme') data.cell.styles.textColor = GREEN;
        else if (v === 'No conforme') data.cell.styles.textColor = RED;
      }
    },
  });

  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(...COOL_GRAY);
    doc.text(`Memoria del plan — Página ${i} de ${pageCount}`, pw / 2, ph - 8, { align: 'center' });
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pw - MARGIN, ph - 8, { align: 'right' });
  }

  const slug = plan.nombre.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 40);
  doc.save(`Memoria_${slug}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}
