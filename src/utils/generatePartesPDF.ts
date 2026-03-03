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
  doc.text('Listado de Partes', MARGIN, 12);

  // Date range subtitle
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const desde = fechaDesde ? format(fechaDesde, 'dd/MM/yyyy', { locale: es }) : 'Inicio';
  const hasta = fechaHasta ? format(fechaHasta, 'dd/MM/yyyy', { locale: es }) : 'Hoy';
  doc.text(`Periodo: ${desde} – ${hasta}`, MARGIN, 16);

  const generated = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
  doc.text(`Generado: ${generated}`, pageW - MARGIN, 12, { align: 'right' });

  // Table data
  const rows = partes.map((p) => [
    p.tipo_informe || '-',
    p.tipo_parte || '-',
    p.fecha_parte ? format(new Date(p.fecha_parte), 'dd/MM/yyyy', { locale: es }) : '-',
    p.maquinista_texto || '-',
    p.base || '-',
    p.tren_servicio || '-',
    p.estado || '-',
    truncate(p.descripcion_hechos, 180),
    truncate(p.observaciones, 120),
  ]);

  autoTable(doc, {
    startY: 22,
    margin: { left: MARGIN, right: MARGIN },
    head: [[
      'Tipo Informe',
      'Suceso / Anomalía',
      'Fecha',
      'Maquinista',
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
      fontSize: 7,
      cellPadding: 2,
    },
    bodyStyles: {
      textColor: DARK,
      fontSize: 7,
      cellPadding: 2,
      minCellHeight: 12,
      overflow: 'linebreak' as const,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { cellWidth: 30 },
      4: { cellWidth: 22 },
      5: { cellWidth: 18 },
      6: { cellWidth: 18 },
      7: { cellWidth: 'auto', overflow: 'linebreak' as const },
      8: { cellWidth: 38, overflow: 'linebreak' as const },
    },
    didDrawPage: (data) => {
      // Footer
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

  const fileName = `Listado_Partes_${desde.replace(/\//g, '')}_${hasta.replace(/\//g, '')}.pdf`;
  doc.save(fileName);
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '-';
  return text.length > max ? text.substring(0, max) + '…' : text;
}
