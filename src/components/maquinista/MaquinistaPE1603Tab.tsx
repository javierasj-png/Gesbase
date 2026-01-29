import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  FileCheck,
  Loader2,
  AlertCircle,
  Printer,
  Lock
} from 'lucide-react';
import { format, isWithinInterval, parseISO, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Expediente1603Detail, 
  PlanBloque1603, 
  TipoActuacion1603 
} from '@/hooks/useMaquinistaDetail';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MaquinistaPE1603TabProps {
  maquinista: {
    id: string;
    nombre_apellidos: string;
    matricula: string;
    base: string;
    bajo_pe_1603: boolean;
  };
  expediente1603: Expediente1603Detail | null;
  plan1603: PlanBloque1603[];
  onRefetch: () => void;
}

const tiposActuacion: TipoActuacion1603[] = ['Acompañamiento', 'Registro', 'Alcohol', 'Drogas'];

export function MaquinistaPE1603Tab({ 
  maquinista, 
  expediente1603, 
  plan1603,
  onRefetch 
}: MaquinistaPE1603TabProps) {
  const { toast } = useToast();
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  
  // Form state
  const [selectedTipo, setSelectedTipo] = useState<TipoActuacion1603 | ''>('');
  const [fechaActuacion, setFechaActuacion] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [indicePrever, setIndicePrever] = useState('');
  const [resultado, setResultado] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');

  // Get blocks that are pending (En ventana or Vencida) for each type
  const bloquesPendientesPorTipo = useMemo(() => {
    const result: Record<TipoActuacion1603, PlanBloque1603[]> = {
      'Acompañamiento': [],
      'Registro': [],
      'Alcohol': [],
      'Drogas': []
    };
    
    plan1603.forEach(b => {
      if (b.estadoCalculado === 'En ventana' || b.estadoCalculado === 'Vencida') {
        result[b.tipo].push(b);
      }
    });
    
    return result;
  }, [plan1603]);

  // Find matching block based on type and date
  const bloqueCoincidente = useMemo(() => {
    if (!selectedTipo || !fechaActuacion) return null;
    
    const fecha = parseISO(fechaActuacion);
    const bloquesTipo = plan1603.filter(b => b.tipo === selectedTipo);
    
    // First, try to find a block where the date is within the window
    const bloqueEnVentana = bloquesTipo.find(b => {
      const inicio = parseISO(b.inicio_ventana);
      const fin = parseISO(b.fin_ventana);
      return isWithinInterval(fecha, { start: inicio, end: fin });
    });
    
    if (bloqueEnVentana) return bloqueEnVentana;
    
    // If not in any window, find the first pending block (En ventana or Vencida)
    const bloquePendiente = bloquesTipo.find(
      b => b.estadoCalculado === 'En ventana' || b.estadoCalculado === 'Vencida'
    );
    
    return bloquePendiente || null;
  }, [selectedTipo, fechaActuacion, plan1603]);

  // Check if there are any pending blocks at all
  const hayBloquesPendientes = Object.values(bloquesPendientesPorTipo).some(arr => arr.length > 0);

  // Check if all blocks are completed (can close)
  const todosCumplidos = useMemo(() => {
    return plan1603.length > 0 && plan1603.every(b => b.estadoCalculado === 'Cumplida');
  }, [plan1603]);

  // Check if expediente should be auto-closed (past end date)
  const deberiaCerrarseAuto = useMemo(() => {
    if (!expediente1603 || expediente1603.estado === 'Cerrado') return false;
    const fechaFin = parseISO(expediente1603.fecha_fin_prevista);
    return isAfter(new Date(), fechaFin);
  }, [expediente1603]);

  const handleRegistrar = async () => {
    if (!selectedTipo || !fechaActuacion || !expediente1603 || !bloqueCoincidente) return;

    setSaving(true);
    try {
      // 1. Create actuacion
      const { data: actuacion, error: actError } = await supabase
        .from('actuaciones_1603')
        .insert({
          expediente_id: expediente1603.id,
          tipo: selectedTipo,
          fecha_real: fechaActuacion,
          resultado: resultado || null,
          observaciones: [
            indicePrever ? `Índice PREVER: ${indicePrever}` : '',
            observaciones
          ].filter(Boolean).join('\n') || null,
        })
        .select()
        .single();

      if (actError) throw actError;

      // 2. Update plan block with actuacion_id and estado
      const { error: planError } = await supabase
        .from('plan_1603')
        .update({
          actuacion_id: actuacion.id,
          estado: 'Cumplida',
        })
        .eq('id', bloqueCoincidente.id);

      if (planError) throw planError;

      toast({
        title: 'Actuación registrada',
        description: `${selectedTipo} - ${bloqueCoincidente.etiqueta} marcada como cumplida`,
      });

      // Reset form and close
      setSelectedTipo('');
      setFechaActuacion(format(new Date(), 'yyyy-MM-dd'));
      setIndicePrever('');
      setResultado('');
      setObservaciones('');
      setRegistrarOpen(false);
      
      // Refresh data
      onRefetch();
    } catch (err) {
      console.error('Error registering actuacion:', err);
      toast({
        title: 'Error',
        description: 'No se pudo registrar la actuación',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCerrarExpediente = async () => {
    if (!expediente1603) return;

    setClosing(true);
    try {
      const { error } = await supabase
        .from('expedientes_1603')
        .update({ estado: 'Cerrado' })
        .eq('id', expediente1603.id);

      if (error) throw error;

      toast({
        title: 'Expediente cerrado',
        description: 'El expediente PE 16.03 ha sido cerrado correctamente',
      });

      setCerrarOpen(false);
      onRefetch();
    } catch (err) {
      console.error('Error closing expediente:', err);
      toast({
        title: 'Error',
        description: 'No se pudo cerrar el expediente',
        variant: 'destructive',
      });
    } finally {
      setClosing(false);
    }
  };

  // Color map for action types
  const tipoColors: Record<TipoActuacion1603, { primary: [number, number, number]; light: [number, number, number] }> = {
    'Acompañamiento': { primary: [59, 130, 246], light: [219, 234, 254] },   // Blue
    'Registro': { primary: [34, 197, 94], light: [220, 252, 231] },          // Green
    'Alcohol': { primary: [249, 115, 22], light: [255, 237, 213] },          // Orange
    'Drogas': { primary: [168, 85, 247], light: [243, 232, 255] },           // Purple
  };

  const estadoColors: Record<string, [number, number, number]> = {
    'Cumplida': [34, 197, 94],    // Green
    'En ventana': [249, 115, 22], // Orange  
    'Vencida': [239, 68, 68],     // Red
    'Pendiente': [156, 163, 175], // Gray
  };

  // Extract PREVER index from observaciones
  const extractPreverIndex = (observaciones: string | null): string => {
    if (!observaciones) return '-';
    const match = observaciones.match(/Índice PREVER:\s*([^\n]+)/);
    return match ? match[1].trim() : '-';
  };

  const handleExportPDF = async () => {
    if (!expediente1603) return;

    // Fetch actuaciones for this expediente
    const { data: actuaciones, error } = await supabase
      .from('actuaciones_1603')
      .select('*')
      .eq('expediente_id', expediente1603.id)
      .order('fecha_real', { ascending: true });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las actuaciones',
        variant: 'destructive',
      });
      return;
    }

    // Create PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header with colored banner - Renfe corporate magenta
    doc.setFillColor(130, 0, 94); // Renfe Magenta #82005E
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SEGUIMIENTO PE 16.03', pageWidth / 2, 16, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('VIGILANCIA NUEVO ACCESO', pageWidth / 2, 24, { align: 'center' });
    
    doc.setFontSize(9);
    doc.text(`Emitido: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, pageWidth / 2, 31, { align: 'center' });

    // Reset text color
    doc.setTextColor(0, 0, 0);

    // Maquinista info card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 42, pageWidth - 28, 28, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 0, 94); // Renfe Magenta
    doc.text('MAQUINISTA', 20, 52);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`${maquinista.nombre_apellidos}`, 20, 60);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Matrícula: ${maquinista.matricula}  •  Base: ${maquinista.base}`, 20, 66);

    // Expediente info card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 76, pageWidth - 28, 28, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 0, 94); // Renfe Magenta
    doc.text('EXPEDIENTE', 20, 86);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Período: ${format(parseISO(expediente1603.fecha_inicio), 'dd/MM/yyyy')} - ${format(parseISO(expediente1603.fecha_fin_prevista), 'dd/MM/yyyy')}`, 20, 94);
    
    // Estado badge
    const estadoColor = expediente1603.estado === 'Activo' ? [34, 197, 94] : [156, 163, 175];
    doc.setFillColor(estadoColor[0], estadoColor[1], estadoColor[2]);
    doc.roundedRect(pageWidth - 50, 84, 36, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(expediente1603.estado, pageWidth - 32, 89.5, { align: 'center' });
    
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Primer servicio: ${format(parseISO(expediente1603.fecha_primer_servicio), 'dd/MM/yyyy')}`, 20, 100);

    // Reset
    doc.setTextColor(0, 0, 0);

    // Plan summary with colored rows
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 0, 94); // Renfe Magenta
    doc.text('RESUMEN DEL PLAN DE VIGILANCIA', 14, 116);

    const planData = tiposActuacion.map(tipo => {
      const bloques = plan1603.filter(b => b.tipo === tipo);
      const cumplidos = bloques.filter(b => b.estadoCalculado === 'Cumplida').length;
      const enVentana = bloques.filter(b => b.estadoCalculado === 'En ventana').length;
      const vencidos = bloques.filter(b => b.estadoCalculado === 'Vencida').length;
      const pendientes = bloques.filter(b => b.estadoCalculado === 'Pendiente').length;
      return [tipo, bloques.length.toString(), cumplidos.toString(), enVentana.toString(), vencidos.toString(), pendientes.toString()];
    });

    autoTable(doc, {
      startY: 120,
      head: [['Tipo de Acción', 'Total', 'Cumplidas', 'En Ventana', 'Vencidas', 'Pendientes']],
      body: planData,
      theme: 'grid',
      headStyles: { fillColor: [130, 0, 94], textColor: [255, 255, 255], fontStyle: 'bold' }, // Renfe Magenta
      styles: { fontSize: 9, cellPadding: 4 },
      bodyStyles: { textColor: [30, 41, 59] },
      willDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const tipo = data.cell.raw as TipoActuacion1603;
          const colors = tipoColors[tipo];
          if (colors) {
            doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const tipo = data.cell.raw as TipoActuacion1603;
          const colors = tipoColors[tipo];
          if (colors) {
            // Draw colored left border
            doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
            doc.setLineWidth(2);
            doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
          }
        }
      },
    });

    // Detailed blocks table
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 0, 94); // Renfe Magenta
    doc.text('DETALLE DE BLOQUES', 14, finalY + 14);

    const bloquesData = plan1603
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.orden - b.orden)
      .map(b => {
        const actuacion = actuaciones?.find(a => a.tipo === b.tipo && b.actuacion_id === a.id);
        const preverIndex = actuacion ? extractPreverIndex(actuacion.observaciones) : '-';
        return [
          b.tipo,
          b.etiqueta,
          `${format(parseISO(b.inicio_ventana), 'dd/MM/yy')} - ${format(parseISO(b.fin_ventana), 'dd/MM/yy')}`,
          b.estadoCalculado,
          actuacion ? format(parseISO(actuacion.fecha_real), 'dd/MM/yyyy') : '-',
          preverIndex
        ];
      });

    autoTable(doc, {
      startY: finalY + 18,
      head: [['Tipo', 'Bloque', 'Ventana', 'Estado', 'Fecha Real', 'Índice PREVER']],
      body: bloquesData,
      theme: 'grid',
      headStyles: { fillColor: [130, 0, 94], textColor: [255, 255, 255], fontStyle: 'bold' }, // Renfe Magenta
      styles: { fontSize: 8, cellPadding: 3 },
      bodyStyles: { textColor: [30, 41, 59] },
      columnStyles: {
        2: { cellWidth: 32 },
        5: { halign: 'center' },
      },
      willDrawCell: (data) => {
        if (data.section === 'body') {
          // Color the tipo column
          if (data.column.index === 0) {
            const tipo = data.cell.raw as TipoActuacion1603;
            const colors = tipoColors[tipo];
            if (colors) {
              doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
            }
          }
          // Color the estado column
          if (data.column.index === 3) {
            const estado = data.cell.raw as string;
            const color = estadoColors[estado];
            if (color) {
              doc.setFillColor(color[0] + 40 > 255 ? 255 : color[0] + 180, color[1] + 40 > 255 ? 255 : color[1] + 180, color[2] + 40 > 255 ? 255 : color[2] + 180);
            }
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const tipo = data.cell.raw as TipoActuacion1603;
          const colors = tipoColors[tipo];
          if (colors) {
            doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
            doc.setLineWidth(1.5);
            doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
          }
        }
      },
    });

    // Actuaciones list if any
    if (actuaciones && actuaciones.length > 0) {
      const finalY2 = (doc as any).lastAutoTable.finalY || 200;
      
      let tableStartY = finalY2 + 18;
      if (finalY2 > 240) {
        doc.addPage();
        // Header on new page
        doc.setFillColor(130, 0, 94); // Renfe Magenta
        doc.rect(0, 0, pageWidth, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('PE 16.03 - Continuación', pageWidth / 2, 8, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        tableStartY = 24;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(130, 0, 94); // Renfe Magenta
      doc.text('ACTUACIONES REGISTRADAS', 14, tableStartY - 4);

      const actuacionesData = actuaciones.map(a => {
        const preverIndex = extractPreverIndex(a.observaciones);
        // Clean observaciones removing PREVER index line
        const cleanObs = a.observaciones?.replace(/Índice PREVER:[^\n]*\n?/, '').trim() || '-';
        return [
          a.tipo,
          format(parseISO(a.fecha_real), 'dd/MM/yyyy'),
          preverIndex,
          cleanObs
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [['Tipo', 'Fecha', 'Índice PREVER', 'Observaciones']],
        body: actuacionesData,
        theme: 'grid',
        headStyles: { fillColor: [130, 0, 94], textColor: [255, 255, 255], fontStyle: 'bold' }, // Renfe Magenta
        styles: { fontSize: 8, cellPadding: 3 },
        bodyStyles: { textColor: [30, 41, 59] },
        columnStyles: {
          2: { halign: 'center', cellWidth: 28 },
          3: { cellWidth: 70 },
        },
        willDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const tipo = data.cell.raw as TipoActuacion1603;
            const colors = tipoColors[tipo];
            if (colors) {
              doc.setFillColor(colors.light[0], colors.light[1], colors.light[2]);
            }
          }
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 0) {
            const tipo = data.cell.raw as TipoActuacion1603;
            const colors = tipoColors[tipo];
            if (colors) {
              doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
              doc.setLineWidth(1.5);
              doc.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height);
            }
          }
        },
      });
    }

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(152, 153, 155); // Renfe Cool Gray #98999b
      doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
    }

    // Save
    doc.save(`PE1603_${maquinista.matricula}_${format(new Date(), 'yyyyMMdd')}.pdf`);

    toast({
      title: 'PDF generado',
      description: 'El documento se ha descargado correctamente',
    });
  };

  if (!expediente1603) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">PE 16.03 - Nuevo Acceso</h2>
          <p className="text-sm text-muted-foreground">
            Vigilancia durante 3 años desde primer servicio. 
            El expediente se genera automáticamente al dar de alta al maquinista.
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {maquinista.bajo_pe_1603 
                ? 'El expediente PE 16.03 se está generando...'
                : 'Este maquinista no está bajo vigilancia PE 16.03'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expedienteCerrado = expediente1603.estado === 'Cerrado';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">PE 16.03 - Nuevo Acceso</h2>
          <p className="text-sm text-muted-foreground">
            Vigilancia durante 3 años desde primer servicio.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportPDF}>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir PDF
        </Button>
      </div>

      {/* Warning if should auto-close */}
      {deberiaCerrarseAuto && !expedienteCerrado && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700">
                El período de vigilancia ha finalizado
              </p>
              <p className="text-xs text-amber-600">
                La fecha fin prevista ({format(parseISO(expediente1603.fecha_fin_prevista), 'dd/MM/yyyy')}) ya ha pasado. 
                Se recomienda cerrar el expediente.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setCerrarOpen(true)}>
              <Lock className="w-4 h-4 mr-2" />
              Cerrar
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Expediente PE 16.03</CardTitle>
              <CardDescription>
                Inicio: {format(new Date(expediente1603.fecha_inicio), 'dd/MM/yyyy')} • 
                Fin previsto: {format(new Date(expediente1603.fecha_fin_prevista), 'dd/MM/yyyy')}
              </CardDescription>
            </div>
            <StatusBadge estado={expediente1603.estado} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timeline por bandas */}
          <div className="border rounded-lg overflow-hidden">
            {tiposActuacion.map((tipo) => {
              const bloquesTipo = plan1603
                .filter(b => b.tipo === tipo)
                .sort((a, b) => a.orden - b.orden);
              
              if (bloquesTipo.length === 0) return null;
              
              return (
                <div key={tipo} className="timeline-band">
                  <div className="timeline-label">
                    {tipo}
                  </div>
                  <div className="timeline-blocks">
                    {bloquesTipo.map((bloque) => (
                      <div 
                        key={bloque.id} 
                        className={`timeline-block ${
                          bloque.estadoCalculado === 'Cumplida' ? 'bg-status-cumplida-bg border border-status-ok' :
                          bloque.estadoCalculado === 'En ventana' ? 'bg-status-proximo-bg border border-status-proximo animate-pulse-soft' :
                          bloque.estadoCalculado === 'Vencida' ? 'bg-status-vencido-bg border border-status-vencido' :
                          'bg-muted border border-border'
                        }`}
                      >
                        <p className="font-medium text-xs mb-1">{bloque.etiqueta}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(bloque.inicio_ventana), 'dd/MM/yy')} - {format(new Date(bloque.fin_ventana), 'dd/MM/yy')}
                        </p>
                        <div className="mt-2">
                          {bloque.estadoCalculado === 'Cumplida' ? (
                            <CheckCircle2 className="w-4 h-4 text-status-ok mx-auto" />
                          ) : bloque.estadoCalculado === 'Vencida' ? (
                            <XCircle className="w-4 h-4 text-status-vencido mx-auto" />
                          ) : bloque.estadoCalculado === 'En ventana' ? (
                            <Clock className="w-4 h-4 text-status-proximo mx-auto" />
                          ) : (
                            <Calendar className="w-4 h-4 text-muted-foreground mx-auto" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-status-cumplida-bg border border-status-ok"></span>
              Cumplida
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-status-proximo-bg border border-status-proximo"></span>
              En ventana
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-status-vencido-bg border border-status-vencido"></span>
              Vencida
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-muted border border-border"></span>
              Pendiente
            </div>
          </div>

          {/* Action buttons */}
          {!expedienteCerrado && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setRegistrarOpen(true)}
                disabled={!hayBloquesPendientes}
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Actuación
              </Button>
              
              {(todosCumplidos || deberiaCerrarseAuto) && (
                <Button 
                  variant="default"
                  onClick={() => setCerrarOpen(true)}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Cerrar Expediente
                </Button>
              )}
            </div>
          )}

          {expedienteCerrado && (
            <div className="p-3 rounded-lg bg-muted/50 border text-center">
              <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Expediente Cerrado</p>
              <p className="text-xs text-muted-foreground">
                Este expediente ha sido cerrado y no admite más actuaciones
              </p>
            </div>
          )}

          {!hayBloquesPendientes && !expedienteCerrado && !todosCumplidos && (
            <p className="text-xs text-muted-foreground text-center">
              No hay bloques en ventana o vencidos para registrar
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal Registrar Actuación */}
      <Dialog open={registrarOpen} onOpenChange={setRegistrarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Registrar Actuación
            </DialogTitle>
            <DialogDescription>
              Selecciona el tipo de actuación y la fecha. El sistema determinará automáticamente el bloque correspondiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Select tipo de actuación */}
            <div className="space-y-2">
              <Label>Tipo de acción de vigilancia</Label>
              <Select 
                value={selectedTipo} 
                onValueChange={(v) => setSelectedTipo(v as TipoActuacion1603)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposActuacion.map(tipo => {
                    const pendientes = bloquesPendientesPorTipo[tipo].length;
                    const disabled = pendientes === 0;
                    return (
                      <SelectItem 
                        key={tipo} 
                        value={tipo}
                        disabled={disabled}
                      >
                        {tipo} {pendientes > 0 ? `(${pendientes} pendiente${pendientes > 1 ? 's' : ''})` : '(sin pendientes)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label>Fecha de la actuación</Label>
              <Input
                type="date"
                value={fechaActuacion}
                onChange={(e) => setFechaActuacion(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            {/* Bloque detectado */}
            {selectedTipo && fechaActuacion && (
              <div className="p-3 rounded-lg bg-muted/50 border">
                {bloqueCoincidente ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-status-ok mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Bloque detectado:</p>
                      <p className="text-sm text-muted-foreground">
                        {bloqueCoincidente.etiqueta} ({format(parseISO(bloqueCoincidente.inicio_ventana), 'dd/MM/yy')} - {format(parseISO(bloqueCoincidente.fin_ventana), 'dd/MM/yy')})
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Sin bloque coincidente</p>
                      <p className="text-xs text-muted-foreground">
                        No hay bloques pendientes para este tipo de actuación
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Índice PREVER (opcional) */}
            <div className="space-y-2">
              <Label>Índice PREVER <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                type="text"
                value={indicePrever}
                onChange={(e) => setIndicePrever(e.target.value)}
                placeholder="Ej: PRV-2026-0042"
              />
            </div>

            {/* Resultado (para Alcohol/Drogas) */}
            {selectedTipo && (selectedTipo === 'Alcohol' || selectedTipo === 'Drogas') && (
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select value={resultado} onValueChange={setResultado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona resultado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Negativo">Negativo</SelectItem>
                    <SelectItem value="Positivo">Positivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Observaciones */}
            <div className="space-y-2">
              <Label>Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas adicionales sobre la actuación..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistrarOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRegistrar} 
              disabled={saving || !selectedTipo || !fechaActuacion || !bloqueCoincidente}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cerrar Expediente */}
      <Dialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-primary" />
              Cerrar Expediente
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cerrar este expediente? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
              <p className="text-sm">
                <span className="font-medium">Maquinista:</span> {maquinista.nombre_apellidos}
              </p>
              <p className="text-sm">
                <span className="font-medium">Fecha fin prevista:</span> {format(parseISO(expediente1603.fecha_fin_prevista), 'dd/MM/yyyy')}
              </p>
              <p className="text-sm">
                <span className="font-medium">Bloques cumplidos:</span> {plan1603.filter(b => b.estadoCalculado === 'Cumplida').length} de {plan1603.length}
              </p>
            </div>

            {!todosCumplidos && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    Hay bloques sin cumplir. Al cerrar el expediente quedarán marcados como incompletos.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCerrarOpen(false)} disabled={closing}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCerrarExpediente} 
              disabled={closing}
            >
              {closing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cerrar Expediente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
