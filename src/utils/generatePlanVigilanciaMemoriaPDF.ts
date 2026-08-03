import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

const MAGENTA: [number, number, number] = [130, 0, 94];
const COOL_GRAY: [number, number, number] = [152, 153, 155];
const WHITE: [number, number, number] = [255, 255, 255];
const DARK: [number, number, number] = [30, 41, 59];
const GREEN: [number, number, number] = [34, 197, 94];
const YELLOW: [number, number, number] = [234, 179, 8];
const RED: [number, number, number] = [239, 68, 68];
const LIGHT: [number, number, number] = [248, 250, 252];

const MARGIN = 14;
const PAGE_HEADER_H = 16;

function fmt(d?: string | null) {
  return d ? format(parseISO(d), 'dd/MM/yyyy') : '-';
}

function addPageHeader(doc: jsPDF, text: string) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, PAGE_HEADER_H, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(text, pw / 2, 11, { align: 'center' });
  doc.setTextColor(...DARK);
}

function endY(doc: jsPDF, fallback: number) {
  return (doc as any).lastAutoTable?.finalY ?? fallback;
}

export async function generatePlanVigilanciaMemoriaPDF(planId: string) {
  const { data: plan, error } = await supabase
    .from('planes_vigilancia')
    .select('*')
    .eq('id', planId)
    .maybeSingle();
  if (error) throw error;
  if (!plan) throw new Error('Plan no encontrado');

  const [{ data: acciones }, { data: tipos }] = await Promise.all([
    supabase.from('planes_vigilancia_acciones').select('*').eq('plan_id', planId).order('fecha_prevista'),
    supabase.from('tipos_accion_vigilancia').select('id, nombre'),
  ]);

  const accs = ((acciones as any[]) || []);
  const maqIds = [...new Set(accs.map((a) => a.maquinista_id))];
  const { data: maquinistas } = maqIds.length
    ? await supabase.from('maquinistas').select('id, matricula, nombre, apellidos, base').in('id', maqIds)
    : { data: [] as any[] };

  const maqMap = new Map((maquinistas || []).map((m: any) => [m.id, m]));
  const tipoMap = new Map(((tipos as any[]) || []).map((t: any) => [t.id, t.nombre]));
  const nombreTipo = (a: any) => a.tipo_accion_libre || tipoMap.get(a.tipo_accion) || a.tipo_accion;
  const nombreMaq = (id: string) => {
    const m: any = maqMap.get(id);
    return m ? `${m.apellidos}, ${m.nombre}` : '(sin identificar)';
  };

  // ── Indicadores ──
  const total = accs.length;
  const realizadas = accs.filter((a) => a.estado === 'realizada');
  const noRealizadas = accs.filter((a) => a.estado === 'no_realizada');
  const pendientes = accs.filter((a) => a.estado === 'pendiente');
  const conformes = accs.filter((a) => a.resultado === 'conforme');
  const noConformes = accs.filter((a) => a.resultado === 'no_conforme');
  const ncComunicadas = noConformes.filter((a) => a.comunicada);
  const pctEjecucion = total ? Math.round((realizadas.length / total) * 100) : 0;
  const pctConformidad = realizadas.length ? Math.round((conformes.length / realizadas.length) * 100) : 0;
  const pctComunicacion = noConformes.length ? Math.round((ncComunicadas.length / noConformes.length) * 100) : 100;
  const duracionDias = differenceInCalendarDays(parseISO(plan.fecha_fin), parseISO(plan.fecha_inicio)) + 1;

  const desviaciones = realizadas
    .filter((a) => a.fecha_real)
    .map((a) => Math.abs(differenceInCalendarDays(parseISO(a.fecha_real), parseISO(a.fecha_prevista))));
  const desvMedia = desviaciones.length
    ? Math.round(desviaciones.reduce((s, d) => s + d, 0) / desviaciones.length)
    : 0;

  // Por tipo de acción
  const tiposUsados = [...new Set(accs.map((a) => nombreTipo(a)))];
  const porTipo = tiposUsados.map((t) => {
    const g = accs.filter((a) => nombreTipo(a) === t);
    const r = g.filter((a) => a.estado === 'realizada').length;
    const nc = g.filter((a) => a.resultado === 'no_conforme').length;
    return {
      tipo: t,
      total: g.length,
      realizadas: r,
      pct: g.length ? Math.round((r / g.length) * 100) : 0,
      noConformes: nc,
    };
  });

  // Por maquinista
  const porMaquinista = maqIds
    .map((id) => {
      const g = accs.filter((a) => a.maquinista_id === id);
      const r = g.filter((a) => a.estado === 'realizada').length;
      const nc = g.filter((a) => a.resultado === 'no_conforme').length;
      return {
        id,
        nombre: nombreMaq(id),
        matricula: (maqMap.get(id) as any)?.matricula || '-',
        total: g.length,
        realizadas: r,
        pendientes: g.filter((a) => a.estado === 'pendiente').length,
        noRealizadas: g.filter((a) => a.estado === 'no_realizada').length,
        noConformes: nc,
        pct: g.length ? Math.round((r / g.length) * 100) : 0,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  // Cronología mensual
  const meses = new Map<string, { previstas: number; realizadas: number }>();
  accs.forEach((a) => {
    const kPrev = format(parseISO(a.fecha_prevista), 'yyyy-MM');
    if (!meses.has(kPrev)) meses.set(kPrev, { previstas: 0, realizadas: 0 });
    meses.get(kPrev)!.previstas += 1;
    if (a.fecha_real) {
      const kReal = format(parseISO(a.fecha_real), 'yyyy-MM');
      if (!meses.has(kReal)) meses.set(kReal, { previstas: 0, realizadas: 0 });
      meses.get(kReal)!.realizadas += 1;
    }
  });
  const cronologia = [...meses.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const HEADER_LABEL = `Memoria del plan — ${plan.base}`;
  const categoriaLabel = plan.categoria === 'especifico' ? 'Plan específico de vigilancia' : 'Campaña / sondeo';

  const need = (y: number, space: number) => {
    if (y + space > ph - 20) {
      doc.addPage();
      addPageHeader(doc, HEADER_LABEL);
      return PAGE_HEADER_H + 8;
    }
    return y;
  };

  const heading = (y: number, txt: string) => {
    const yy = need(y, 16);
    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MAGENTA);
    doc.text(txt, MARGIN, yy);
    doc.setTextColor(...DARK);
    return yy + 6;
  };

  const para = (y: number, txt: string, size = 8.5) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    const lines = doc.splitTextToSize(txt, pw - MARGIN * 2);
    let yy = need(y, lines.length * 4.4 + 4);
    doc.text(lines, MARGIN, yy);
    return yy + lines.length * 4.4 + 3;
  };

  const bullets = (y: number, items: string[]) => {
    let yy = y;
    items.forEach((it) => {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(it, pw - MARGIN * 2 - 5);
      yy = need(yy, lines.length * 4.4 + 2);
      doc.setFillColor(...MAGENTA);
      doc.circle(MARGIN + 1.4, yy - 1.4, 0.8, 'F');
      doc.setTextColor(...DARK);
      doc.text(lines, MARGIN + 5, yy);
      yy += lines.length * 4.4 + 1.5;
    });
    return yy + 2;
  };

  // ══ PORTADA ══
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pw, 58, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('SISTEMA DE GESTIÓN DE LA SEGURIDAD (SGS)', pw / 2, 16, { align: 'center' });
  doc.setFontSize(19);
  doc.setFont('helvetica', 'bold');
  doc.text('MEMORIA FINAL DEL PLAN', pw / 2, 30, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const nombreLines = doc.splitTextToSize(plan.nombre, pw - 50);
  doc.text(nombreLines, pw / 2, 40, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`${categoriaLabel} · Base de conducción: ${plan.base}`, pw / 2, 51, { align: 'center' });
  doc.setTextColor(...DARK);

  let y = 68;

  // Ficha identificativa
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['FICHA IDENTIFICATIVA', '']],
    body: [
      ['Referencia del plan', plan.id.substring(0, 8).toUpperCase()],
      ['Denominación', plan.nombre],
      ['Naturaleza', categoriaLabel],
      ['Base de conducción', plan.base],
      ['Responsable del plan', plan.responsable || 'No consignado'],
      ['Periodo de vigencia', `${fmt(plan.fecha_inicio)} a ${fmt(plan.fecha_fin)} (${duracionDias} días naturales)`],
      [
        'Criterio de alcance',
        plan.modo_alcance === 'porcentaje'
          ? `Muestreo del ${plan.porcentaje}% de la plantilla de la base`
          : plan.modo_alcance === 'todos'
            ? 'Totalidad de la plantilla de la base'
            : 'Selección nominal de maquinistas',
      ],
      [
        'Distribución temporal',
        plan.distribucion === 'uniforme' ? 'Uniforme en el periodo' : plan.distribucion === 'aleatoria' ? 'Aleatoria' : 'Manual',
      ],
      ['Maquinistas incluidos', `${maqIds.length}`],
      ['Acciones planificadas', `${total}`],
      ['Estado administrativo', String(plan.estado).toUpperCase()],
      ['Fecha de archivo', plan.archived_at ? format(new Date(plan.archived_at), "dd/MM/yyyy HH:mm") : 'No archivado'],
      ['Fecha de emisión de la memoria', format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es })],
    ],
    headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 8.5 },
    styles: { fontSize: 8, cellPadding: 2.4, lineColor: COOL_GRAY, lineWidth: 0.4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 58, fillColor: LIGHT } },
  });

  // ══ 1. OBJETO Y ALCANCE ══
  doc.addPage();
  addPageHeader(doc, HEADER_LABEL);
  y = PAGE_HEADER_H + 10;

  y = heading(y, '1. OBJETO Y ALCANCE');
  y = para(
    y,
    `La presente memoria documenta la ejecución y los resultados del ${categoriaLabel.toLowerCase()} «${plan.nombre}», desarrollado en la base de conducción de ${plan.base} entre el ${fmt(plan.fecha_inicio)} y el ${fmt(plan.fecha_fin)}. Su objeto es dejar constancia documental, a efectos de auditoría interna y externa, de las actividades de vigilancia programadas, de su grado de ejecución, de los resultados obtenidos y del tratamiento dado a las no conformidades detectadas.`
  );
  y = para(
    y,
    plan.descripcion
      ? `Descripción del plan según su definición inicial: ${plan.descripcion}`
      : 'El plan no incorpora descripción adicional en su definición inicial.'
  );
  y = para(
    y,
    `El alcance comprende ${maqIds.length} maquinista(s) de la base y ${total} acción(es) de vigilancia distribuidas en ${tiposUsados.length} tipología(s) de actuación. Quedan fuera del alcance las actuaciones derivadas de los procedimientos PE 16.03 y PE 12.01, que se documentan en sus expedientes específicos.`
  );

  // ══ 2. MARCO Y METODOLOGÍA ══
  y = heading(y, '2. MARCO DE REFERENCIA Y METODOLOGÍA');
  y = bullets(y, [
    'Marco de referencia: Sistema de Gestión de la Seguridad (SGS) de la empresa ferroviaria, procedimientos de vigilancia operativa y planificación anual de la actividad de conducción.',
    `Selección de la muestra: ${plan.modo_alcance === 'porcentaje' ? `muestreo del ${plan.porcentaje}% sobre la plantilla activa de la base` : plan.modo_alcance === 'todos' ? 'censo completo de la plantilla activa de la base' : 'selección nominal de maquinistas por criterio del responsable'}.`,
    `Programación: distribución ${plan.distribucion === 'uniforme' ? 'uniforme' : plan.distribucion === 'aleatoria' ? 'aleatoria' : 'manual'} de las acciones a lo largo del periodo de vigencia, con fecha prevista asignada a cada actuación.`,
    'Criterio de cómputo: una acción se considera realizada cuando consta fecha real de ejecución y resultado registrado, siempre que la ejecución se haya producido dentro del periodo de vigencia del plan.',
    'Criterio de cierre: finalizado el periodo de vigencia, las acciones que permanecen pendientes se clasifican automáticamente como no realizadas y se elevan al panel de alertas vencidas.',
    'Resultado de cada acción: conforme o no conforme. Las no conformidades requieren comunicación documentada al maquinista y quedan trazadas con fecha y responsable de la comunicación.',
  ]);

  // ══ 3. INDICADORES ══
  y = heading(y, '3. INDICADORES DE EJECUCIÓN Y RESULTADO');
  y = need(y, 40);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Indicador', 'Valor', 'Observación']],
    body: [
      ['Acciones planificadas', String(total), 'Base de cálculo del plan'],
      ['Acciones realizadas', `${realizadas.length} (${pctEjecucion}%)`, 'Con fecha real y resultado'],
      ['Acciones no realizadas', String(noRealizadas.length), 'Vencidas sin ejecución'],
      ['Acciones pendientes', String(pendientes.length), 'Dentro de plazo'],
      ['Grado de ejecución del plan', `${pctEjecucion}%`, pctEjecucion >= 90 ? 'Satisfactorio' : pctEjecucion >= 70 ? 'Mejorable' : 'Insuficiente'],
      ['Resultados conformes', String(conformes.length), 'Sobre acciones realizadas'],
      ['No conformidades detectadas', String(noConformes.length), `Índice de conformidad ${pctConformidad}%`],
      ['No conformidades comunicadas', `${ncComunicadas.length} de ${noConformes.length} (${pctComunicacion}%)`, 'Trazabilidad documental'],
      ['Desviación media sobre fecha prevista', `${desvMedia} días`, 'Media de días de diferencia en las acciones realizadas'],
      ['Cobertura de plantilla', `${maqIds.length} maquinistas`, 'Sujetos incluidos en el plan'],
    ],
    headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.2, lineColor: COOL_GRAY, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 66, fontStyle: 'bold' }, 1: { cellWidth: 40 } },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.row.index === 4 && d.column.index === 1) {
        d.cell.styles.textColor = pctEjecucion >= 90 ? GREEN : pctEjecucion >= 70 ? YELLOW : RED;
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = endY(doc, y) + 8;

  // ══ 4. DESGLOSE POR TIPOLOGÍA ══
  y = heading(y, '4. DESGLOSE POR TIPOLOGÍA DE ACTUACIÓN');
  y = need(y, 30);
  autoTable(doc, {
    startY: y,
    head: [['Tipo de actuación', 'Planificadas', 'Realizadas', '% Ejecución', 'No conformidades']],
    body: porTipo.map((t) => [t.tipo, String(t.total), String(t.realizadas), `${t.pct}%`, String(t.noConformes)]),
    theme: 'grid',
    headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.2, lineColor: COOL_GRAY, lineWidth: 0.4 },
    bodyStyles: { textColor: DARK },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.column.index === 3) {
        const v = parseInt(String(d.cell.raw));
        d.cell.styles.textColor = v >= 90 ? GREEN : v >= 70 ? YELLOW : RED;
      }
    },
  });
  y = endY(doc, y) + 8;

  // ══ 5. CRONOLOGÍA ══
  y = heading(y, '5. DISTRIBUCIÓN TEMPORAL DE LA EJECUCIÓN');
  y = need(y, 30);
  autoTable(doc, {
    startY: y,
    head: [['Mes', 'Acciones previstas', 'Acciones ejecutadas', 'Diferencia']],
    body: cronologia.length
      ? cronologia.map(([k, v]) => [
          format(parseISO(`${k}-01`), "MMMM yyyy", { locale: es }),
          String(v.previstas),
          String(v.realizadas),
          String(v.realizadas - v.previstas),
        ])
      : [['-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: COOL_GRAY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.5, cellPadding: 2.2, lineColor: COOL_GRAY, lineWidth: 0.4 },
  });
  y = endY(doc, y) + 8;

  // ══ 6. SEGUIMIENTO POR MAQUINISTA ══
  y = heading(y, '6. SEGUIMIENTO INDIVIDUAL POR MAQUINISTA');
  y = need(y, 30);
  autoTable(doc, {
    startY: y,
    head: [['Maquinista', 'Matrícula', 'Planif.', 'Realiz.', 'Pend.', 'No realiz.', 'NC', '% Ejec.']],
    body: porMaquinista.length
      ? porMaquinista.map((m) => [
          m.nombre,
          m.matricula,
          String(m.total),
          String(m.realizadas),
          String(m.pendientes),
          String(m.noRealizadas),
          String(m.noConformes),
          `${m.pct}%`,
        ])
      : [['Sin maquinistas asignados', '-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5 },
    styles: { fontSize: 7, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.4 },
    columnStyles: { 0: { cellWidth: 52 } },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.column.index === 7) {
        const v = parseInt(String(d.cell.raw));
        if (!isNaN(v)) d.cell.styles.textColor = v >= 90 ? GREEN : v >= 70 ? YELLOW : RED;
      }
    },
  });
  y = endY(doc, y) + 8;

  // ══ 7. DETALLE DE ACCIONES ══
  y = heading(y, '7. REGISTRO DETALLADO DE ACCIONES');
  y = need(y, 30);
  autoTable(doc, {
    startY: y,
    head: [['Maquinista', 'Actuación', 'Prevista', 'Real', 'Desv.', 'Estado', 'Resultado', 'Comunicada', 'Observaciones']],
    body: accs.length
      ? accs.map((a) => {
          const desv = a.fecha_real
            ? `${differenceInCalendarDays(parseISO(a.fecha_real), parseISO(a.fecha_prevista))}d`
            : '-';
          return [
            nombreMaq(a.maquinista_id),
            nombreTipo(a),
            fmt(a.fecha_prevista),
            fmt(a.fecha_real),
            desv,
            a.estado === 'realizada' ? 'Realizada' : a.estado === 'no_realizada' ? 'No realizada' : 'Pendiente',
            a.resultado === 'conforme' ? 'Conforme' : a.resultado === 'no_conforme' ? 'No conforme' : '-',
            a.resultado === 'no_conforme'
              ? a.comunicada
                ? `Sí ${a.comunicada_at ? format(new Date(a.comunicada_at), 'dd/MM/yy') : ''}`.trim()
                : 'No'
              : '-',
            (a.observaciones || '-').substring(0, 70),
          ];
        })
      : [['-', '-', '-', '-', '-', '-', '-', '-', 'Sin acciones registradas']],
    theme: 'grid',
    headStyles: { fillColor: MAGENTA, textColor: WHITE, fontStyle: 'bold', fontSize: 6.8 },
    styles: { fontSize: 6.3, cellPadding: 1.8, lineColor: COOL_GRAY, lineWidth: 0.35 },
    bodyStyles: { textColor: DARK },
    columnStyles: { 0: { cellWidth: 32 }, 8: { cellWidth: 34 } },
    didParseCell: (d: any) => {
      if (d.section === 'body' && d.column.index === 5) {
        const v = d.cell.raw as string;
        if (v === 'Realizada') d.cell.styles.textColor = GREEN;
        else if (v === 'No realizada') d.cell.styles.textColor = RED;
        else d.cell.styles.textColor = YELLOW;
      }
      if (d.section === 'body' && d.column.index === 6) {
        const v = d.cell.raw as string;
        if (v === 'Conforme') d.cell.styles.textColor = GREEN;
        else if (v === 'No conforme') d.cell.styles.textColor = RED;
      }
      if (d.section === 'body' && d.column.index === 7 && d.cell.raw === 'No') {
        d.cell.styles.textColor = RED;
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  y = endY(doc, y) + 8;

  // ══ 8. NO CONFORMIDADES ══
  y = heading(y, '8. NO CONFORMIDADES Y TRATAMIENTO');
  if (noConformes.length === 0) {
    y = para(y, 'No se han detectado no conformidades en las actuaciones ejecutadas dentro del periodo de vigencia del plan.');
  } else {
    y = para(
      y,
      `Se han detectado ${noConformes.length} no conformidad(es) sobre ${realizadas.length} actuación(es) ejecutada(s), lo que representa un índice de conformidad del ${pctConformidad}%. De ellas, ${ncComunicadas.length} han sido comunicadas formalmente al maquinista (${pctComunicacion}% de trazabilidad documental).`
    );
    y = need(y, 30);
    autoTable(doc, {
      startY: y,
      head: [['Maquinista', 'Actuación', 'Fecha', 'Comunicada', 'Fecha comunicación', 'Destinatario', 'Descripción']],
      body: noConformes.map((a) => [
        nombreMaq(a.maquinista_id),
        nombreTipo(a),
        fmt(a.fecha_real || a.fecha_prevista),
        a.comunicada ? 'Sí' : 'No',
        a.comunicada_at ? format(new Date(a.comunicada_at), 'dd/MM/yyyy') : '-',
        a.comunicacion_destinatario || '-',
        (a.observaciones || 'Sin descripción registrada').substring(0, 80),
      ]),
      theme: 'grid',
      headStyles: { fillColor: RED, textColor: WHITE, fontStyle: 'bold', fontSize: 7 },
      styles: { fontSize: 6.6, cellPadding: 2, lineColor: COOL_GRAY, lineWidth: 0.35 },
      columnStyles: { 0: { cellWidth: 32 }, 6: { cellWidth: 44 } },
      didParseCell: (d: any) => {
        if (d.section === 'body' && d.column.index === 3) {
          d.cell.styles.textColor = d.cell.raw === 'Sí' ? GREEN : RED;
          d.cell.styles.fontStyle = 'bold';
        }
      },
    });
    y = endY(doc, y) + 8;
  }

  // ══ 9. CONCLUSIONES ══
  y = heading(y, '9. CONCLUSIONES');
  const concl: string[] = [];
  concl.push(
    `El plan alcanza un grado de ejecución del ${pctEjecucion}% (${realizadas.length} de ${total} acciones), valorado como ${pctEjecucion >= 90 ? 'satisfactorio' : pctEjecucion >= 70 ? 'mejorable' : 'insuficiente'} respecto a la programación inicial.`
  );
  if (noRealizadas.length > 0) {
    concl.push(
      `Se han registrado ${noRealizadas.length} acción(es) no realizadas al vencimiento del periodo, que constan en el panel de alertas vencidas y deben ser objeto de reprogramación o justificación documentada.`
    );
  } else {
    concl.push('No se han registrado acciones vencidas sin ejecutar al cierre del periodo de vigencia.');
  }
  concl.push(
    noConformes.length === 0
      ? 'La totalidad de las actuaciones ejecutadas han resultado conformes, sin incidencias relevantes en materia de seguridad en la conducción.'
      : `El índice de conformidad de las actuaciones ejecutadas se sitúa en el ${pctConformidad}%, con ${noConformes.length} no conformidad(es) identificada(s).`
  );
  if (noConformes.length > ncComunicadas.length) {
    concl.push(
      `Quedan ${noConformes.length - ncComunicadas.length} no conformidad(es) sin comunicación registrada, lo que constituye una debilidad en la trazabilidad documental del plan.`
    );
  }
  concl.push(
    `La desviación media entre fecha prevista y fecha real de ejecución es de ${desvMedia} días, indicativa de ${desvMedia <= 7 ? 'un buen ajuste' : desvMedia <= 21 ? 'un ajuste aceptable' : 'una desviación significativa'} respecto a la planificación.`
  );
  y = bullets(y, concl);

  // ══ 10. RECOMENDACIONES ══
  y = heading(y, '10. RECOMENDACIONES Y ACCIONES DE MEJORA');
  const recs: string[] = [];
  if (pctEjecucion < 90) recs.push('Reforzar el seguimiento periódico del plan para elevar el grado de ejecución por encima del 90% antes del vencimiento del periodo.');
  if (noRealizadas.length > 0) recs.push('Reprogramar o justificar formalmente las acciones no realizadas e incorporarlas al siguiente ciclo de planificación.');
  if (noConformes.length > ncComunicadas.length) recs.push('Completar la comunicación formal de las no conformidades pendientes y registrar la evidencia correspondiente.');
  if (desvMedia > 21) recs.push('Revisar el criterio de distribución temporal de las acciones para reducir la desviación respecto a las fechas previstas.');
  const tiposDebiles = porTipo.filter((t) => t.pct < 70);
  if (tiposDebiles.length) recs.push(`Prestar especial atención a las tipologías con menor ejecución: ${tiposDebiles.map((t) => t.tipo).join(', ')}.`);
  const maqNC = porMaquinista.filter((m) => m.noConformes > 0);
  if (maqNC.length) recs.push(`Valorar seguimiento reforzado de los maquinistas con no conformidades: ${maqNC.map((m) => m.nombre).join('; ')}.`);
  if (recs.length === 0) recs.push('No se identifican acciones de mejora adicionales. Se recomienda mantener el criterio de planificación aplicado en los siguientes ciclos.');
  y = bullets(y, recs);

  // ══ 11. VALIDACIÓN ══
  y = heading(y, '11. VALIDACIÓN Y CONSERVACIÓN DOCUMENTAL');
  y = para(
    y,
    'La presente memoria se genera automáticamente a partir de los registros del sistema en la fecha de emisión indicada y constituye evidencia documental del plan a efectos de auditoría. Su conservación se realizará conforme a los plazos establecidos en el SGS.'
  );
  y = need(y, 34);
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['Elaborado por', 'Revisado por', 'Fecha']],
    body: [[plan.responsable || '', '', format(new Date(), 'dd/MM/yyyy')], ['', '', '']],
    headStyles: { fillColor: COOL_GRAY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 6, minCellHeight: 16, lineColor: COOL_GRAY, lineWidth: 0.4 },
  });

  // ══ Pies ══
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...COOL_GRAY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Memoria del plan «${plan.nombre}» — Página ${i} de ${pageCount}`, pw / 2, ph - 8, { align: 'center' });
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pw - MARGIN, ph - 8, { align: 'right' });
  }

  const slug = plan.nombre.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').substring(0, 40);
  doc.save(`Memoria_${slug}_${format(new Date(), 'yyyyMMdd')}.pdf`);
}
