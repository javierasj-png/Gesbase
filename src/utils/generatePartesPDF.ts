import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Parte } from '@/types/partes';

const MAGENTA: [number, number, number] = [130, 0, 94];
const WHITE: [number, number, number] = [255, 255, 255];
const DARK: [number, number, number] = [30, 41, 59];
const MARGIN = 14;

export function generatePartesPDF(
  partes: Parte[],
  fechaDesde: Date | undefined,
  fechaHasta: Date | undefined,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(...MAGENTA);
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('GesBase - Listado de Informes Ferroviarios', MARGIN, 12);

  // Date range & generation info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const generated = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
  doc.text(`Generado el: ${generated}`, pageW - MARGIN, 12, { align: 'right' });

  const desde = fechaDesde ? format(fechaDesde, 'dd/MM/yyyy', { locale: es }) : '';
  const hasta = fechaHasta ? format(fechaHasta, 'dd/MM/yyyy', { locale: es }) : '';
  if (desde || hasta) {
    doc.text(`Periodo: ${desde || 'Inicio'} – ${hasta || 'Hoy'}`, MARGIN, 16);
  }

  // Table data
  const rows = partes.map((p) => [
    p.tipo_informe || '-',
    p.tipo_parte || '-',
    p.fecha_parte
      ? format(new Date(p.fecha_parte), 'dd/MM/yy', { locale: es }) + (p.hora_parte ? ' ' + p.hora_parte : '')
      : '-',
    p.maquinista_texto || '-',
    p.base || '-',
    p.tren_servicio || '-',
    p.estado || '-',
    p.descripcion_hechos || '-',
    p.observaciones || 'Sin notas',
  ]);

  autoTable(doc, {
    startY: 22,
    margin: { left: MARGIN, right: MARGIN },
    head: [[
      'Tipo Informe',
      'Suceso / Anomalía',
      'Fecha',
      'Matrícula',
      'Base',
      'Tren',
      'Estado',
      'Resumen IA',
      'Observaciones',
    ]],
    body: rows,
    headStyles: {
      fillColor: MAGENTA,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 6.5,
      cellPadding: 2,
    },
    bodyStyles: {
      textColor: DARK,
      fontSize: 6.5,
      cellPadding: 2,
      overflow: 'linebreak' as const,
      minCellHeight: 10,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { cellWidth: 16 },
      5: { cellWidth: 14 },
      6: { cellWidth: 20 },
      7: { cellWidth: 'auto' },
      8: { cellWidth: 24 },
    },
    didDrawPage: () => {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Página ${doc.getCurrentPageInfo().pageNumber}`,
        pageW / 2,
        pageH - 6,
        { align: 'center' },
      );
    },
  });

  const fileName = `Listado_Informes_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  doc.save(fileName);
}
