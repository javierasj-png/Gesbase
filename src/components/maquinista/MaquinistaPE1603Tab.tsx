import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
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
  Lock,
  User,
  CalendarClock,
  Pencil
} from 'lucide-react';
import { format, addMonths, parseISO, isAfter, isBefore, addYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
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

// Map lowercase types to display labels
const tipoLabels: Record<TipoActuacion1603, string> = {
  'acompanamiento': 'Acompañamiento',
  'registro': 'Registro',
  'alcohol': 'Alcohol',
  'drogas': 'Drogas'
};

const tiposActuacion: TipoActuacion1603[] = ['acompanamiento', 'registro', 'alcohol', 'drogas'];

export function MaquinistaPE1603Tab({ 
  maquinista, 
  expediente1603, 
  plan1603,
  onRefetch 
}: MaquinistaPE1603TabProps) {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editingActuacion, setEditingActuacion] = useState<any>(null);
  
  // Form state
  const [selectedTipo, setSelectedTipo] = useState<TipoActuacion1603 | ''>('');
  const [selectedMes, setSelectedMes] = useState<number | null>(null);
  const [fechaActuacion, setFechaActuacion] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [indicePrever, setIndicePrever] = useState('');
  const [resultado, setResultado] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');

  // Check if expediente is closed
  const expedienteCerrado = expediente1603?.estado === 'cerrado';
  
  // Permissions: solo admin puede editar fichas cerradas
  const puedeEditar = !expedienteCerrado || isAdmin;
  
  // Solo mandos pueden cerrar manualmente (admins también)
  const puedeCerrarManual = !expedienteCerrado;

  // Calculate fecha_fin_prevista (3 years from primer servicio)
  const fechaFinPrevista = useMemo(() => {
    if (!expediente1603?.fecha_primer_servicio) return null;
    return addYears(parseISO(expediente1603.fecha_primer_servicio), 3);
  }, [expediente1603?.fecha_primer_servicio]);

  // Check if expediente should be auto-closed (past 3 years)
  const deberiaCerrarseAuto = useMemo(() => {
    if (!expediente1603 || expediente1603.estado === 'cerrado' || !fechaFinPrevista) return false;
    return isAfter(new Date(), fechaFinPrevista);
  }, [expediente1603, fechaFinPrevista]);

  // Calculate block state based on mes and fecha_primer_servicio
  const getBlockState = (bloque: PlanBloque1603): 'pendiente' | 'en_ventana' | 'vencida' | 'cumplida' => {
    if (bloque.actuacion_id) return 'cumplida';
    if (!expediente1603?.fecha_primer_servicio) return 'pendiente';
    
    const primerServicio = parseISO(expediente1603.fecha_primer_servicio);
    const inicioVentana = addMonths(primerServicio, (bloque.mes - 1) * 6);
    const finVentana = addMonths(primerServicio, bloque.mes * 6);
    const now = new Date();
    
    if (isAfter(now, finVentana)) return 'vencida';
    if (isAfter(now, inicioVentana) && isBefore(now, finVentana)) return 'en_ventana';
    return 'pendiente';
  };

  // Get window dates for a block
  const getBlockWindow = (bloque: PlanBloque1603): { inicio: Date; fin: Date } | null => {
    if (!expediente1603?.fecha_primer_servicio) return null;
    const primerServicio = parseISO(expediente1603.fecha_primer_servicio);
    return {
      inicio: addMonths(primerServicio, (bloque.mes - 1) * 6),
      fin: addMonths(primerServicio, bloque.mes * 6)
    };
  };

  // Count pending blocks per type (for display)
  const bloquesPendientesPorTipo = useMemo(() => {
    const result: Record<TipoActuacion1603, PlanBloque1603[]> = {
      'acompanamiento': [],
      'registro': [],
      'alcohol': [],
      'drogas': []
    };
    
    plan1603.forEach(b => {
      if (!b.actuacion_id) {
        result[b.tipo].push(b);
      }
    });
    
    return result;
  }, [plan1603]);

  // Check if all blocks are completed
  const todosCumplidos = useMemo(() => {
    return plan1603.length > 0 && plan1603.every(b => b.actuacion_id !== null);
  }, [plan1603]);

  // Find matching block for registration
  const bloqueCoincidente = useMemo(() => {
    if (!selectedTipo || !selectedMes) return null;
    return plan1603.find(b => b.tipo === selectedTipo && b.mes === selectedMes && !b.actuacion_id);
  }, [selectedTipo, selectedMes, plan1603]);

  const handleRegistrar = async () => {
    if (!selectedTipo || !selectedMes || !fechaActuacion || !expediente1603 || !bloqueCoincidente) return;

    // Validar permisos si está cerrado
    if (expedienteCerrado && !isAdmin) {
      toast({
        title: 'Sin permisos',
        description: 'Solo un administrador puede modificar una ficha cerrada.',
        variant: 'destructive',
      });
      return;
    }

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
          indice_prever: indicePrever ? parseFloat(indicePrever) : null,
          observaciones: observaciones || null,
        })
        .select()
        .single();

      if (actError) throw actError;

      // 2. Update plan block with actuacion_id and estado
      const { error: planError } = await supabase
        .from('plan_1603')
        .update({
          actuacion_id: actuacion.id,
          estado: 'realizado',
        })
        .eq('id', bloqueCoincidente.id);

      if (planError) throw planError;

      toast({
        title: 'Actuación registrada',
        description: `${tipoLabels[selectedTipo]} - Semestre ${selectedMes} marcado como cumplido`,
      });

      // Reset form and close
      setSelectedTipo('');
      setSelectedMes(null);
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
        .update({ 
          estado: 'cerrado',
          cierre_manual: true,
          fecha_cierre: new Date().toISOString(),
          cerrado_por: user?.id,
        })
        .eq('id', expediente1603.id);

      if (error) throw error;

      toast({
        title: 'Expediente cerrado',
        description: 'El expediente PE 16.03 ha sido cerrado manualmente',
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

  // Handle edit actuacion
  const handleEditarActuacion = async () => {
    if (!editingActuacion) return;
    
    // Validar permisos si está cerrado
    if (expedienteCerrado && !isAdmin) {
      toast({
        title: 'Sin permisos',
        description: 'Solo un administrador puede modificar una ficha cerrada.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('actuaciones_1603')
        .update({
          fecha_real: fechaActuacion,
          resultado: resultado || null,
          indice_prever: indicePrever ? parseFloat(indicePrever) : null,
          observaciones: observaciones || null,
        })
        .eq('id', editingActuacion.id);

      if (error) throw error;

      toast({
        title: 'Actuación actualizada',
        description: 'Los cambios se han guardado correctamente',
      });

      // Reset form and close
      setEditingActuacion(null);
      setSelectedTipo('');
      setSelectedMes(null);
      setFechaActuacion(format(new Date(), 'yyyy-MM-dd'));
      setIndicePrever('');
      setResultado('');
      setObservaciones('');
      setEditarOpen(false);
      
      // Refresh data
      onRefetch();
    } catch (err) {
      console.error('Error updating actuacion:', err);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la actuación',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (actuacion: any, tipo: TipoActuacion1603) => {
    setEditingActuacion(actuacion);
    setSelectedTipo(tipo);
    setFechaActuacion(actuacion.fecha_real);
    setIndicePrever(actuacion.indice_prever?.toString() || '');
    setObservaciones(actuacion.observaciones || '');
    setResultado(actuacion.resultado || '');
    setEditarOpen(true);
  };

  // Color map for action types
  const tipoColors: Record<TipoActuacion1603, { primary: [number, number, number]; light: [number, number, number] }> = {
    'acompanamiento': { primary: [59, 130, 246], light: [219, 234, 254] },
    'registro': { primary: [34, 197, 94], light: [220, 252, 231] },
    'alcohol': { primary: [249, 115, 22], light: [255, 237, 213] },
    'drogas': { primary: [168, 85, 247], light: [243, 232, 255] },
  };

  const estadoColors: Record<string, [number, number, number]> = {
    'cumplida': [34, 197, 94],
    'en_ventana': [249, 115, 22],
    'vencida': [239, 68, 68],
    'pendiente': [156, 163, 175],
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
    doc.setFillColor(130, 0, 94);
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
    doc.setTextColor(130, 0, 94);
    doc.text('MAQUINISTA', 20, 52);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`${maquinista.nombre_apellidos}`, 20, 60);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Matrícula: ${maquinista.matricula}  •  Base: ${maquinista.base}`, 20, 66);

    // Expediente info card with closure info
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 76, pageWidth - 28, 32, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 0, 94);
    doc.text('EXPEDIENTE', 20, 86);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const fechaFinStr = fechaFinPrevista ? format(fechaFinPrevista, 'dd/MM/yyyy') : 'N/A';
    doc.text(`Período: ${format(parseISO(expediente1603.fecha_inicio), 'dd/MM/yyyy')} - ${fechaFinStr}`, 20, 94);
    
    // Estado badge
    const estadoLabel = expediente1603.estado === 'abierto' ? 'Activo' : 'Cerrado';
    const estadoColor = expediente1603.estado === 'abierto' ? [34, 197, 94] : [156, 163, 175];
    doc.setFillColor(estadoColor[0], estadoColor[1], estadoColor[2]);
    doc.roundedRect(pageWidth - 50, 84, 36, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(estadoLabel, pageWidth - 32, 89.5, { align: 'center' });
    
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    if (expediente1603.fecha_primer_servicio) {
      doc.text(`Primer servicio: ${format(parseISO(expediente1603.fecha_primer_servicio), 'dd/MM/yyyy')}`, 20, 100);
    }
    
    // Show closure info if closed
    if (expediente1603.estado === 'cerrado' && expediente1603.fecha_cierre) {
      const tipoCierre = expediente1603.cierre_manual ? 'Manual' : 'Automático';
      doc.text(`Cierre: ${tipoCierre} - ${format(parseISO(expediente1603.fecha_cierre), 'dd/MM/yyyy HH:mm')}`, 20, 106);
    }

    // Reset
    doc.setTextColor(0, 0, 0);

    // Plan summary with colored rows
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 0, 94);
    doc.text('RESUMEN DEL PLAN DE VIGILANCIA', 14, 120);

    const planData = tiposActuacion.map(tipo => {
      const bloques = plan1603.filter(b => b.tipo === tipo);
      const cumplidos = bloques.filter(b => getBlockState(b) === 'cumplida').length;
      const enVentana = bloques.filter(b => getBlockState(b) === 'en_ventana').length;
      const vencidos = bloques.filter(b => getBlockState(b) === 'vencida').length;
      const pendientes = bloques.filter(b => getBlockState(b) === 'pendiente').length;
      return [tipoLabels[tipo], bloques.length.toString(), cumplidos.toString(), enVentana.toString(), vencidos.toString(), pendientes.toString()];
    });

    autoTable(doc, {
      startY: 124,
      head: [['Tipo de Acción', 'Total', 'Cumplidas', 'En Ventana', 'Vencidas', 'Pendientes']],
      body: planData,
      theme: 'grid',
      headStyles: { fillColor: [130, 0, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 4, lineColor: [152, 153, 155], lineWidth: 0.5 },
      bodyStyles: { textColor: [30, 41, 59] },
      tableLineColor: [130, 0, 94],
      tableLineWidth: 0.75,
    });

    // Detailed blocks table
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 0, 94);
    doc.text('DETALLE DE BLOQUES', 14, finalY + 14);

    const bloquesData = plan1603
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.mes - b.mes)
      .map(b => {
        const window = getBlockWindow(b);
        const estado = getBlockState(b);
        const actuacion = actuaciones?.find(a => a.tipo === b.tipo && b.actuacion_id === a.id);
        return [
          tipoLabels[b.tipo],
          `Semestre ${b.mes}`,
          window ? `${format(window.inicio, 'dd/MM/yy')} - ${format(window.fin, 'dd/MM/yy')}` : 'N/A',
          estado.charAt(0).toUpperCase() + estado.slice(1).replace('_', ' '),
          actuacion ? format(parseISO(actuacion.fecha_real), 'dd/MM/yyyy') : '-',
          actuacion?.indice_prever?.toString() || '-'
        ];
      });

    autoTable(doc, {
      startY: finalY + 18,
      head: [['Tipo', 'Bloque', 'Ventana', 'Estado', 'Fecha Real', 'Índice PREVER']],
      body: bloquesData,
      theme: 'grid',
      headStyles: { fillColor: [130, 0, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3, lineColor: [152, 153, 155], lineWidth: 0.5 },
      bodyStyles: { textColor: [30, 41, 59] },
      tableLineColor: [130, 0, 94],
      tableLineWidth: 0.75,
      columnStyles: {
        2: { cellWidth: 32 },
        5: { halign: 'center' },
      },
    });

    // Actuaciones list if any
    if (actuaciones && actuaciones.length > 0) {
      const finalY2 = (doc as any).lastAutoTable.finalY || 200;
      
      let tableStartY = finalY2 + 18;
      if (finalY2 > 240) {
        doc.addPage();
        doc.setFillColor(130, 0, 94);
        doc.rect(0, 0, pageWidth, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('PE 16.03 - Continuación', pageWidth / 2, 8, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        tableStartY = 24;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(130, 0, 94);
      doc.text('ACTUACIONES REGISTRADAS', 14, tableStartY - 4);

      const actuacionesData = actuaciones.map(a => {
        return [
          tipoLabels[a.tipo as TipoActuacion1603] || a.tipo,
          format(parseISO(a.fecha_real), 'dd/MM/yyyy'),
          a.indice_prever?.toString() || '-',
          a.observaciones || '-'
        ];
      });

      autoTable(doc, {
        startY: tableStartY,
        head: [['Tipo', 'Fecha', 'Índice PREVER', 'Observaciones']],
        body: actuacionesData,
        theme: 'grid',
        headStyles: { fillColor: [130, 0, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        bodyStyles: { textColor: [30, 41, 59] },
        columnStyles: {
          2: { halign: 'center', cellWidth: 28 },
          3: { cellWidth: 70 },
        },
      });
    }

    // Footer
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(152, 153, 155);
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
      {deberiaCerrarseAuto && !expedienteCerrado && fechaFinPrevista && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700">
                El período de vigilancia ha finalizado
              </p>
              <p className="text-xs text-amber-600">
                La fecha fin prevista ({format(fechaFinPrevista, 'dd/MM/yyyy')}) ya ha pasado. 
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
                Fin previsto: {fechaFinPrevista ? format(fechaFinPrevista, 'dd/MM/yyyy') : 'N/A'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge estado={expediente1603.estado === 'abierto' ? 'Activo' : 'Cerrado'} />
              {expedienteCerrado && (
                <Badge variant="secondary" className="text-xs">
                  {expediente1603.cierre_manual ? 'Manual' : 'Automático'}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Info de cierre si está cerrado */}
          {expedienteCerrado && expediente1603.fecha_cierre && (
            <div className="mt-2 p-2 rounded bg-muted/50 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                Cerrado: {format(parseISO(expediente1603.fecha_cierre), 'dd/MM/yyyy HH:mm', { locale: es })}
              </div>
              {expediente1603.cierre_manual && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Cierre manual
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Timeline por bandas */}
          <div className="border rounded-lg overflow-hidden">
            {tiposActuacion.map((tipo) => {
              const bloquesTipo = plan1603
                .filter(b => b.tipo === tipo)
                .sort((a, b) => a.mes - b.mes);
              
              if (bloquesTipo.length === 0) return null;
              
              return (
                <div key={tipo} className="timeline-band">
                  <div className="timeline-label">
                    {tipoLabels[tipo]}
                  </div>
                  <div className="timeline-blocks">
                    {bloquesTipo.map((bloque) => {
                      const estado = getBlockState(bloque);
                      const window = getBlockWindow(bloque);
                      return (
                        <div 
                          key={bloque.id} 
                          className={`timeline-block ${
                            estado === 'cumplida' ? 'bg-status-cumplida-bg border border-status-ok' :
                            estado === 'en_ventana' ? 'bg-status-proximo-bg border border-status-proximo animate-pulse-soft' :
                            estado === 'vencida' ? 'bg-status-vencido-bg border border-status-vencido' :
                            'bg-muted border border-border'
                          }`}
                        >
                          <p className="font-medium text-xs mb-1">Semestre {bloque.mes}</p>
                          {window && (
                            <p className="text-[10px] text-muted-foreground">
                              {format(window.inicio, 'dd/MM/yy')} - {format(window.fin, 'dd/MM/yy')}
                            </p>
                          )}
                          <div className="mt-2">
                            {estado === 'cumplida' ? (
                              <CheckCircle2 className="w-4 h-4 text-status-ok mx-auto" />
                            ) : estado === 'vencida' ? (
                              <XCircle className="w-4 h-4 text-status-vencido mx-auto" />
                            ) : estado === 'en_ventana' ? (
                              <Clock className="w-4 h-4 text-status-proximo mx-auto" />
                            ) : (
                              <Calendar className="w-4 h-4 text-muted-foreground mx-auto" />
                            )}
                          </div>
                        </div>
                      );
                    })}
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
          {puedeEditar && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setRegistrarOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Actuación
              </Button>
              
              {puedeCerrarManual && (
                <Button 
                  variant="default"
                  onClick={() => setCerrarOpen(true)}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Cierre Manual del Expediente
                </Button>
              )}
            </div>
          )}

          {expedienteCerrado && !isAdmin && (
            <div className="p-3 rounded-lg bg-muted/50 border text-center">
              <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Expediente Cerrado</p>
              <p className="text-xs text-muted-foreground">
                Este expediente está cerrado y solo puede ser modificado por un administrador
              </p>
            </div>
          )}

          {expedienteCerrado && isAdmin && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
              <Lock className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium text-primary">Modo Administrador</p>
              <p className="text-xs text-muted-foreground">
                Como administrador puedes registrar actuaciones en fichas cerradas
              </p>
            </div>
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
              Selecciona el tipo de actuación y el semestre correspondiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Select tipo de actuación */}
            <div className="space-y-2">
              <Label>Tipo de acción de vigilancia</Label>
              <Select 
                value={selectedTipo} 
                onValueChange={(v) => {
                  setSelectedTipo(v as TipoActuacion1603);
                  setSelectedMes(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposActuacion.map(tipo => {
                    const sinCumplir = bloquesPendientesPorTipo[tipo].length;
                    return (
                      <SelectItem 
                        key={tipo} 
                        value={tipo}
                      >
                        {tipoLabels[tipo]} ({sinCumplir} sin cumplir)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Select semestre */}
            {selectedTipo && (
              <div className="space-y-2">
                <Label>Semestre</Label>
                <Select 
                  value={selectedMes?.toString() || ''} 
                  onValueChange={(v) => setSelectedMes(parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un semestre" />
                  </SelectTrigger>
                  <SelectContent>
                    {bloquesPendientesPorTipo[selectedTipo].map(bloque => {
                      const window = getBlockWindow(bloque);
                      return (
                        <SelectItem 
                          key={bloque.id} 
                          value={bloque.mes.toString()}
                        >
                          Semestre {bloque.mes} {window ? `(${format(window.inicio, 'MM/yy')} - ${format(window.fin, 'MM/yy')})` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            {/* Índice PREVER (opcional) */}
            <div className="space-y-2">
              <Label>Índice PREVER <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                type="text"
                value={indicePrever}
                onChange={(e) => setIndicePrever(e.target.value)}
                placeholder="Ej: 4.5"
              />
            </div>

            {/* Resultado (para Alcohol/Drogas) */}
            {selectedTipo && (selectedTipo === 'alcohol' || selectedTipo === 'drogas') && (
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
              disabled={saving || !selectedTipo || !selectedMes || !fechaActuacion}
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
              Cierre Manual del Expediente
            </DialogTitle>
            <DialogDescription>
              Al cerrar el expediente manualmente, quedará bloqueado y solo un administrador podrá modificarlo.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
              <p className="text-sm">
                <span className="font-medium">Maquinista:</span> {maquinista.nombre_apellidos}
              </p>
              <p className="text-sm">
                <span className="font-medium">Fecha fin prevista:</span> {fechaFinPrevista ? format(fechaFinPrevista, 'dd/MM/yyyy') : 'N/A'}
              </p>
              <p className="text-sm">
                <span className="font-medium">Bloques cumplidos:</span> {plan1603.filter(b => b.actuacion_id !== null).length} de {plan1603.length}
              </p>
            </div>

            {!todosCumplidos && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    Hay bloques sin cumplir. Al cerrar la ficha quedarán marcados como incompletos.
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

      {/* Modal Editar Actuación */}
      <Dialog open={editarOpen} onOpenChange={(open) => {
        setEditarOpen(open);
        if (!open) setEditingActuacion(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Actuación
            </DialogTitle>
            <DialogDescription>
              Modifica los datos de la actuación registrada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tipo (solo lectura) */}
            <div className="space-y-2">
              <Label>Tipo de acción</Label>
              <Input
                value={selectedTipo ? tipoLabels[selectedTipo] : ''}
                disabled
                className="bg-muted"
              />
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

            {/* Índice PREVER (opcional) */}
            <div className="space-y-2">
              <Label>Índice PREVER <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                type="text"
                value={indicePrever}
                onChange={(e) => setIndicePrever(e.target.value)}
                placeholder="Ej: 4.5"
              />
            </div>

            {/* Resultado (para Alcohol/Drogas) */}
            {selectedTipo && (selectedTipo === 'alcohol' || selectedTipo === 'drogas') && (
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
            <Button variant="outline" onClick={() => setEditarOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEditarActuacion} 
              disabled={saving || !fechaActuacion}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
