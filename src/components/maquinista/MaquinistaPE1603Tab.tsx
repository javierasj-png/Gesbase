import { useState, useMemo, useEffect } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
  Pencil,
  Trash2,
  ArrowRightLeft,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import { format, addMonths, parseISO, isAfter, isBefore, addYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Expediente1603Detail, 
  PlanBloque1603, 
  TipoActuacion1603,
  Traslado1603 
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
  traslados1603: Traslado1603[];
  onRefetch: () => void;
}

interface Actuacion1603 {
  id: string;
  expediente_id: string;
  tipo: TipoActuacion1603;
  fecha_real: string;
  indice_prever: number | null;
  km_recorridos: number | null;
  observaciones: string | null;
  resultado: string | null;
  created_at: string | null;
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
  traslados1603,
  onRefetch 
}: MaquinistaPE1603TabProps) {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [trasladoOpen, setTrasladoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editingActuacion, setEditingActuacion] = useState<Actuacion1603 | null>(null);
  const [actuacionesRegistradas, setActuacionesRegistradas] = useState<Actuacion1603[]>([]);
  const [basesActivas, setBasesActivas] = useState<{ id: string; nombre: string }[]>([]);
  
  // Transfer form state
  const [trasladoFecha, setTrasladoFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [trasladoBaseOrigen, setTrasladoBaseOrigen] = useState(maquinista.base);
  const [trasladoBaseOrigenOtra, setTrasladoBaseOrigenOtra] = useState('');
  const [trasladoBaseDestino, setTrasladoBaseDestino] = useState('');
  const [trasladoBaseDestinoOtra, setTrasladoBaseDestinoOtra] = useState('');
  const [trasladoObservaciones, setTrasladoObservaciones] = useState('');
  const [editingTraslado, setEditingTraslado] = useState<Traslado1603 | null>(null);
  const [deletingTrasladoId, setDeletingTrasladoId] = useState<string | null>(null);
  const [comentarioOpen, setComentarioOpen] = useState(false);
  const [comentarioBloqueId, setComentarioBloqueId] = useState<string | null>(null);
  const [comentarioTexto, setComentarioTexto] = useState('');
  
  // Form state
  const [selectedTipo, setSelectedTipo] = useState<TipoActuacion1603 | ''>('');
  const [selectedMes, setSelectedMes] = useState<number | null>(null);
  const [fechaActuacion, setFechaActuacion] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [indicePrever, setIndicePrever] = useState('');
  const [kmRecorridos, setKmRecorridos] = useState('');
  const [resultado, setResultado] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');

  const parseIndicePrever = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // permitir coma decimal
    const normalized = trimmed.replace(',', '.');
    const val = Number.parseFloat(normalized);
    if (Number.isNaN(val)) return null;
    return val;
  };

  const getActuacionSignature = (actuacion: Pick<Actuacion1603, 'tipo' | 'fecha_real' | 'indice_prever' | 'observaciones' | 'resultado'>) => {
    return [
      actuacion.tipo,
      actuacion.fecha_real,
      actuacion.indice_prever ?? '',
      (actuacion.observaciones ?? '').trim(),
      (actuacion.resultado ?? '').trim(),
    ].join('|');
  };

  // Fetch active bases for transfer selector
  useEffect(() => {
    const fetchBases = async () => {
      const { data } = await supabase
        .from('bases_conduccion')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      if (data) setBasesActivas(data);
    };
    fetchBases();
  }, []);

  useEffect(() => {
    const fetchActuaciones = async () => {
      if (!expediente1603?.id) {
        setActuacionesRegistradas([]);
        return;
      }

      const { data, error } = await supabase
        .from('actuaciones_1603')
        .select('id, expediente_id, tipo, fecha_real, indice_prever, km_recorridos, observaciones, resultado, created_at')
        .eq('expediente_id', expediente1603.id)
        .order('fecha_real', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading actuaciones_1603:', error);
        return;
      }

      setActuacionesRegistradas((data ?? []) as Actuacion1603[]);
    };

    fetchActuaciones();
  }, [expediente1603?.id]);

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

  // Calculate block state based on inicio_ventana/fin_ventana from DB
  const getBlockState = (bloque: PlanBloque1603): 'pendiente' | 'en_ventana' | 'vencida' | 'cumplida' | 'justificada' => {
    if (bloque.justificado_traslado) return 'justificada';
    if (bloque.actuacion_id) return 'cumplida';
    
    // Use DB dates if available
    if (bloque.inicio_ventana && bloque.fin_ventana) {
      const inicio = parseISO(bloque.inicio_ventana);
      const fin = parseISO(bloque.fin_ventana);
      const now = new Date();
      
      if (isAfter(now, fin)) return 'vencida';
      if (isAfter(now, inicio) && isBefore(now, fin)) return 'en_ventana';
      return 'pendiente';
    }
    
    // Fallback to old calculation if DB dates not available
    if (!expediente1603?.fecha_primer_servicio) return 'pendiente';
    const primerServicio = parseISO(expediente1603.fecha_primer_servicio);
    const inicioVentana = addMonths(primerServicio, (bloque.mes - 1));
    const finVentana = addMonths(primerServicio, bloque.mes);
    const now = new Date();
    
    if (isAfter(now, finVentana)) return 'vencida';
    if (isAfter(now, inicioVentana) && isBefore(now, finVentana)) return 'en_ventana';
    return 'pendiente';
  };

  // Get window dates for a block - prefer DB values
  const getBlockWindow = (bloque: PlanBloque1603): { inicio: Date; fin: Date } | null => {
    // Use DB dates if available
    if (bloque.inicio_ventana && bloque.fin_ventana) {
      return {
        inicio: parseISO(bloque.inicio_ventana),
        fin: parseISO(bloque.fin_ventana)
      };
    }
    
    // Fallback to calculation
    if (!expediente1603?.fecha_primer_servicio) return null;
    const primerServicio = parseISO(expediente1603.fecha_primer_servicio);
    return {
      inicio: addMonths(primerServicio, bloque.mes - 1),
      fin: addMonths(primerServicio, bloque.mes)
    };
  };

  // Auto-detect block based on fecha and tipo
  const detectBlockForDate = (fecha: string, tipo: TipoActuacion1603): PlanBloque1603 | null => {
    if (!fecha || !tipo) return null;
    
    const fechaDate = parseISO(fecha);
    // Allow all blocks of this type (including already fulfilled ones - multiple actuaciones per block allowed)
    const bloquesDelTipo = plan1603.filter(b => b.tipo === tipo);
    
    // Find block where fecha is within window (strict match only)
    for (const bloque of bloquesDelTipo) {
      const window = getBlockWindow(bloque);
      if (window) {
        if ((isAfter(fechaDate, window.inicio) || fechaDate.getTime() === window.inicio.getTime()) && 
            (isBefore(fechaDate, window.fin) || fechaDate.getTime() === window.fin.getTime())) {
          return bloque;
        }
      }
    }
    
    // No fallback - only assign if date falls within a window
    return null;
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

  // Find matching block for registration - now uses detectBlockForDate
  const bloqueCoincidente = useMemo(() => {
    if (!selectedTipo || !fechaActuacion) return null;
    // If selectedMes is set (manual override), use it
    if (selectedMes) {
      return plan1603.find(b => b.tipo === selectedTipo && b.mes === selectedMes) || null;
    }
    return detectBlockForDate(fechaActuacion, selectedTipo);
  }, [selectedTipo, selectedMes, fechaActuacion, plan1603]);

  const handleRegistrar = async () => {
    if (!selectedTipo || !fechaActuacion || !expediente1603 || !bloqueCoincidente) return;

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
      const indicePreverValue = parseIndicePrever(indicePrever);
      if (indicePrever.trim() && indicePreverValue === null) {
        toast({
          title: 'Dato inválido',
          description: 'El Índice PREVER debe ser numérico.',
          variant: 'destructive',
        });
        return;
      }

      const duplicateSignature = getActuacionSignature({
        tipo: selectedTipo,
        fecha_real: fechaActuacion,
        indice_prever: indicePreverValue,
        observaciones: observaciones || null,
        resultado: resultado || null,
      });

      const existingDuplicate = actuacionesRegistradas.find(
        (actuacion) => getActuacionSignature(actuacion) === duplicateSignature
      );

      if (existingDuplicate) {
        toast({
          title: 'Actuación duplicada',
          description: 'Ya existe una actuación igual registrada en esta ficha.',
          variant: 'destructive',
        });
        return;
      }

      // 1. Create actuacion
      const kmValue = kmRecorridos.trim() ? parseFloat(kmRecorridos.replace(',', '.')) : null;
      const { data: actuacion, error: actError } = await supabase
        .from('actuaciones_1603')
        .insert({
          expediente_id: expediente1603.id,
          tipo: selectedTipo,
          fecha_real: fechaActuacion,
          resultado: resultado || null,
          indice_prever: indicePreverValue,
          km_recorridos: selectedTipo === 'registro' ? kmValue : null,
          observaciones: observaciones || null,
          registrado_por: user?.id ?? null,
        })
        .select()
        .single();

      if (actError) throw actError;

      // 2. Update plan block only if not already fulfilled
      if (!bloqueCoincidente.actuacion_id) {
        const { error: planError } = await supabase
          .from('plan_1603')
          .update({
            actuacion_id: actuacion.id,
            estado: 'realizado',
          })
          .eq('id', bloqueCoincidente.id);

        if (planError) throw planError;
      }

      toast({
        title: 'Actuación registrada',
        description: `${tipoLabels[selectedTipo]} registrada correctamente`,
      });

      // Reset form and close
      setSelectedTipo('');
      setSelectedMes(null);
      setFechaActuacion(format(new Date(), 'yyyy-MM-dd'));
      setIndicePrever('');
      setKmRecorridos('');
      setResultado('');
      setObservaciones('');
      setRegistrarOpen(false);
      
      // Refresh data
      onRefetch();
    } catch (err) {
      console.error('Error registering actuacion:', err);
      toast({
        title: 'Error',
        description: (err as any)?.message || 'No se pudo registrar la actuación',
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
      const indicePreverValue = parseIndicePrever(indicePrever);
      if (indicePrever.trim() && indicePreverValue === null) {
        toast({
          title: 'Dato inválido',
          description: 'El Índice PREVER debe ser numérico.',
          variant: 'destructive',
        });
        return;
      }

      const duplicateSignature = getActuacionSignature({
        tipo: editingActuacion.tipo,
        fecha_real: fechaActuacion,
        indice_prever: indicePreverValue,
        observaciones: observaciones || null,
        resultado: resultado || null,
      });

      const existingDuplicate = actuacionesRegistradas.find(
        (actuacion) => actuacion.id !== editingActuacion.id && getActuacionSignature(actuacion) === duplicateSignature
      );

      if (existingDuplicate) {
        toast({
          title: 'Actuación duplicada',
          description: 'Ya existe otra actuación con esos mismos datos en esta ficha.',
          variant: 'destructive',
        });
        return;
      }

      const kmValue = kmRecorridos.trim() ? parseFloat(kmRecorridos.replace(',', '.')) : null;
      const { error } = await supabase
        .from('actuaciones_1603')
        .update({
          fecha_real: fechaActuacion,
          resultado: resultado || null,
          indice_prever: indicePreverValue,
          km_recorridos: editingActuacion.tipo === 'registro' ? kmValue : null,
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
      setKmRecorridos('');
      setResultado('');
      setObservaciones('');
      setEditarOpen(false);
      
      // Refresh data
      onRefetch();
    } catch (err) {
      console.error('Error updating actuacion:', err);
      toast({
        title: 'Error',
        description: (err as any)?.message || 'No se pudo actualizar la actuación',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarActuacion = async () => {
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
      // Primero desvincular del plan_1603
      const { error: unlinkError } = await supabase
        .from('plan_1603')
        .update({ actuacion_id: null, estado: 'pendiente' })
        .eq('actuacion_id', editingActuacion.id);

      if (unlinkError) throw unlinkError;

      // Luego eliminar la actuación
      const { error: deleteError } = await supabase
        .from('actuaciones_1603')
        .delete()
        .eq('id', editingActuacion.id);

      if (deleteError) throw deleteError;

      toast({
        title: 'Actuación eliminada',
        description: 'La actuación se ha eliminado correctamente',
      });

      // Reset form and close
      setEditingActuacion(null);
      setSelectedTipo('');
      setSelectedMes(null);
      setFechaActuacion(format(new Date(), 'yyyy-MM-dd'));
      setIndicePrever('');
      setKmRecorridos('');
      setResultado('');
      setObservaciones('');
      setEditarOpen(false);
      
      // Refresh data
      onRefetch();
    } catch (err) {
      console.error('Error deleting actuacion:', err);
      toast({
        title: 'Error',
        description: (err as any)?.message || 'No se pudo eliminar la actuación',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (actuacion: Actuacion1603, tipo: TipoActuacion1603) => {
    setEditingActuacion(actuacion);
    setSelectedTipo(tipo);
    setSelectedMes(null);
    setFechaActuacion(actuacion.fecha_real);
    setIndicePrever(actuacion.indice_prever?.toString() || '');
    setKmRecorridos(actuacion.km_recorridos?.toString() || '');
    setObservaciones(actuacion.observaciones || '');
    setResultado(actuacion.resultado || '');
    setEditarOpen(true);
  };

  // Handle registrar traslado
  const handleRegistrarTraslado = async () => {
    const baseOrigenFinal = trasladoBaseOrigen === '__otra__' ? trasladoBaseOrigenOtra : trasladoBaseOrigen;
    const baseDestinoFinal = trasladoBaseDestino === '__otra__' ? trasladoBaseDestinoOtra : trasladoBaseDestino;
    if (!expediente1603 || !trasladoFecha || !baseOrigenFinal || !baseDestinoFinal) return;

    const esBaseGesbase = basesActivas.some(b => b.nombre === baseDestinoFinal);

    setSaving(true);
    try {
      // 1. Create traslado record
      const { data: traslado, error: tError } = await supabase
        .from('traslados_1603')
        .insert({
          expediente_id: expediente1603.id,
          fecha_traslado: trasladoFecha,
          base_origen: baseOrigenFinal,
          base_destino: baseDestinoFinal,
          observaciones: trasladoObservaciones || null,
          registrado_por: user?.id ?? null,
        })
        .select()
        .single();

      if (tError) throw tError;

      // 2. Justify all overdue blocks up to the transfer date
      const trasladoDate = parseISO(trasladoFecha);
      const bloquesVencidos = plan1603.filter(b => {
        if (b.actuacion_id || b.justificado_traslado) return false;
        if (!b.fin_ventana) return false;
        const fin = parseISO(b.fin_ventana);
        return isBefore(fin, trasladoDate) || fin.getTime() === trasladoDate.getTime();
      });

      if (bloquesVencidos.length > 0) {
        const { error: updateError } = await supabase
          .from('plan_1603')
          .update({
            justificado_traslado: true,
            traslado_id: traslado.id,
          })
          .in('id', bloquesVencidos.map(b => b.id));

        if (updateError) throw updateError;
      }

      // 3. Update maquinista base to destination (if it's a GESBASE base)
      if (esBaseGesbase) {
        const { error: baseError } = await supabase
          .from('maquinistas')
          .update({ base: baseDestinoFinal })
          .eq('id', maquinista.id);

        if (baseError) throw baseError;
      }

      toast({
        title: 'Traslado registrado',
        description: esBaseGesbase
          ? `Base actualizada a ${baseDestinoFinal}. ${bloquesVencidos.length} bloque(s) justificado(s).`
          : `${bloquesVencidos.length} bloque(s) justificado(s) por traslado`,
      });

      // Reset form and close
      setTrasladoFecha(format(new Date(), 'yyyy-MM-dd'));
      setTrasladoBaseOrigen(maquinista.base);
      setTrasladoBaseOrigenOtra('');
      setTrasladoBaseDestino('');
      setTrasladoBaseDestinoOtra('');
      setTrasladoObservaciones('');
      setTrasladoOpen(false);
      
      onRefetch();
    } catch (err) {
      console.error('Error registering traslado:', err);
      toast({
        title: 'Error',
        description: (err as any)?.message || 'No se pudo registrar el traslado',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  // Handle edit traslado - open modal prefilled
  const handleEditTraslado = (traslado: Traslado1603) => {
    setEditingTraslado(traslado);
    setTrasladoFecha(traslado.fecha_traslado);
    const isOrigenGesbase = basesActivas.some(b => b.nombre === traslado.base_origen);
    setTrasladoBaseOrigen(isOrigenGesbase ? traslado.base_origen : '__otra__');
    setTrasladoBaseOrigenOtra(isOrigenGesbase ? '' : traslado.base_origen);
    const isGesbase = basesActivas.some(b => b.nombre === traslado.base_destino);
    setTrasladoBaseDestino(isGesbase ? traslado.base_destino : '__otra__');
    setTrasladoBaseDestinoOtra(isGesbase ? '' : traslado.base_destino);
    setTrasladoObservaciones(traslado.observaciones || '');
    setTrasladoOpen(true);
  };

  // Handle update existing traslado
  const handleUpdateTraslado = async () => {
    if (!editingTraslado || !trasladoFecha) return;
    const baseOrigenFinal = trasladoBaseOrigen === '__otra__' ? trasladoBaseOrigenOtra : trasladoBaseOrigen;
    const baseDestinoFinal = trasladoBaseDestino === '__otra__' ? trasladoBaseDestinoOtra : trasladoBaseDestino;
    if (!baseOrigenFinal || !baseDestinoFinal) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('traslados_1603')
        .update({
          fecha_traslado: trasladoFecha,
          base_origen: baseOrigenFinal,
          base_destino: baseDestinoFinal,
          observaciones: trasladoObservaciones || null,
        })
        .eq('id', editingTraslado.id);

      if (error) throw error;

      // Re-justify: first un-justify all blocks linked to this traslado
      await supabase
        .from('plan_1603')
        .update({ justificado_traslado: false, traslado_id: null })
        .eq('traslado_id', editingTraslado.id);

      // Then re-justify blocks overdue at the new transfer date
      const trasladoDate = parseISO(trasladoFecha);
      const bloquesVencidos = plan1603.filter(b => {
        if (b.actuacion_id) return false;
        if (!b.fin_ventana) return false;
        const fin = parseISO(b.fin_ventana);
        return isBefore(fin, trasladoDate) || fin.getTime() === trasladoDate.getTime();
      });

      // Filter out blocks already justified by OTHER traslados
      const bloquesParaJustificar = bloquesVencidos.filter(b => 
        !b.justificado_traslado || b.traslado_id === editingTraslado.id
      );

      if (bloquesParaJustificar.length > 0) {
        await supabase
          .from('plan_1603')
          .update({ justificado_traslado: true, traslado_id: editingTraslado.id })
          .in('id', bloquesParaJustificar.map(b => b.id));
      }

      // Update maquinista base if destination is a GESBASE base
      const esBaseGesbase = basesActivas.some(b => b.nombre === baseDestinoFinal);
      if (esBaseGesbase) {
        await supabase
          .from('maquinistas')
          .update({ base: baseDestinoFinal })
          .eq('id', maquinista.id);
      }

      toast({ title: 'Traslado actualizado', description: 'Los datos del traslado se han modificado correctamente' });

      setEditingTraslado(null);
      setTrasladoOpen(false);
      setTrasladoFecha(format(new Date(), 'yyyy-MM-dd'));
      setTrasladoBaseOrigen(maquinista.base);
      setTrasladoBaseOrigenOtra('');
      setTrasladoBaseDestino('');
      setTrasladoBaseDestinoOtra('');
      setTrasladoObservaciones('');
      onRefetch();
    } catch (err) {
      console.error('Error updating traslado:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el traslado' });
    } finally {
      setSaving(false);
    }
  };

  // Handle delete traslado
  const handleDeleteTraslado = async (trasladoId: string) => {
    setSaving(true);
    try {
      // 1. Un-justify all blocks linked to this traslado
      await supabase
        .from('plan_1603')
        .update({ justificado_traslado: false, traslado_id: null })
        .eq('traslado_id', trasladoId);

      // 2. Get traslado info before deleting (to revert base)
      const { data: trasladoData } = await supabase
        .from('traslados_1603')
        .select('base_origen')
        .eq('id', trasladoId)
        .single();

      // 3. Delete the traslado record
      const { error } = await supabase
        .from('traslados_1603')
        .delete()
        .eq('id', trasladoId);

      if (error) throw error;

      // 4. Revert maquinista base to origin
      if (trasladoData?.base_origen) {
        await supabase
          .from('maquinistas')
          .update({ base: trasladoData.base_origen })
          .eq('id', maquinista.id);
      }

      toast({ title: 'Traslado eliminado', description: 'La base del maquinista se ha revertido a ' + (trasladoData?.base_origen || 'origen') });
      setDeletingTrasladoId(null);
      onRefetch();
    } catch (err) {
      console.error('Error deleting traslado:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el traslado' });
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarComentarioVencida = async () => {
    if (!comentarioBloqueId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('plan_1603')
        .update({ comentario_vencida: comentarioTexto.trim() || null })
        .eq('id', comentarioBloqueId);
      if (error) throw error;
      toast({ title: 'Comentario guardado' });
      setComentarioOpen(false);
      setComentarioBloqueId(null);
      setComentarioTexto('');
      onRefetch();
    } catch (err) {
      console.error('Error saving comment:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el comentario' });
    } finally {
      setSaving(false);
    }
  };

  const handleBlockClick = async (bloque: PlanBloque1603) => {
    if (!puedeEditar) return;
    if (!bloque.actuacion_id) return; // Only editable if has actuacion
    
    try {
      const { data: actuacion, error } = await supabase
        .from('actuaciones_1603')
        .select('*')
        .eq('id', bloque.actuacion_id)
        .single();
      
      if (error) throw error;
      if (actuacion) {
        openEditModal(actuacion as Actuacion1603, bloque.tipo);
      }
    } catch (err) {
      console.error('Error loading actuacion:', err);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la actuación',
        variant: 'destructive',
      });
    }
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
    doc.text(`Período: ${format(parseISO(expediente1603.fecha_primer_servicio || expediente1603.fecha_inicio), 'dd/MM/yyyy')} - ${fechaFinStr}`, 20, 94);
    
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

    // Calculate overall compliance percentage (justified blocks count as compliant)
    const totalBloques = plan1603.length;
    const bloquesCumplidos = plan1603.filter(b => getBlockState(b) === 'cumplida' || getBlockState(b) === 'justificada').length;
    const porcentajeCumplimiento = totalBloques > 0 ? Math.round((bloquesCumplidos / totalBloques) * 100) : 0;

    const planData = tiposActuacion.map(tipo => {
      const bloques = plan1603.filter(b => b.tipo === tipo);
      const cumplidos = bloques.filter(b => getBlockState(b) === 'cumplida').length;
      const justificados = bloques.filter(b => getBlockState(b) === 'justificada').length;
      const enVentana = bloques.filter(b => getBlockState(b) === 'en_ventana').length;
      const vencidos = bloques.filter(b => getBlockState(b) === 'vencida').length;
      const pendientes = bloques.filter(b => getBlockState(b) === 'pendiente').length;
      return [tipoLabels[tipo], bloques.length.toString(), cumplidos.toString(), justificados.toString(), enVentana.toString(), vencidos.toString(), pendientes.toString()];
    });

    autoTable(doc, {
      startY: 142,
      head: [['Tipo de Acción', 'Total', 'Cumplidas', 'Justificadas', 'En Ventana', 'Vencidas', 'Pendientes']],
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

    const BLUE: [number, number, number] = [59, 130, 246];
    const bloquesData = plan1603
      .sort((a, b) => a.tipo.localeCompare(b.tipo) || a.mes - b.mes)
      .map(b => {
        const window = getBlockWindow(b);
        const estado = getBlockState(b);
        const actuacion = actuaciones?.find(a => a.tipo === b.tipo && b.actuacion_id === a.id);
        const estadoLabel = estado === 'justificada' ? 'Justificada' : estado.charAt(0).toUpperCase() + estado.slice(1).replace('_', ' ');
        return [
          tipoLabels[b.tipo],
          b.etiqueta || `Semestre ${b.mes}`,
          window ? `${format(window.inicio, 'dd/MM/yy')} - ${format(window.fin, 'dd/MM/yy')}` : 'N/A',
          estadoLabel,
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
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 3) {
          const val = data.cell.raw as string;
          if (val === 'Cumplida') data.cell.styles.textColor = [34, 197, 94];
          else if (val === 'Justificada') data.cell.styles.textColor = BLUE;
          else if (val === 'Vencida') data.cell.styles.textColor = [239, 68, 68];
          else if (val === 'En ventana') data.cell.styles.textColor = [234, 179, 8];
        }
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

      // Deduplicate actuaciones by business signature to avoid repeated entries in the PDF
      const uniqueActuaciones = actuaciones.filter((a, index, self) => {
        const signature = [
          a.tipo,
          a.fecha_real,
          a.indice_prever ?? '',
          (a.observaciones ?? '').trim(),
        ].join('|');

        return index === self.findIndex(item => [
          item.tipo,
          item.fecha_real,
          item.indice_prever ?? '',
          (item.observaciones ?? '').trim(),
        ].join('|') === signature);
      });

      const actuacionesData = uniqueActuaciones.map(a => {
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

    // Traslados section
    if (traslados1603 && traslados1603.length > 0) {
      const finalY3 = (doc as any).lastAutoTable?.finalY || 200;
      
      let trasladoStartY = finalY3 + 18;
      if (finalY3 > 240) {
        doc.addPage();
        doc.setFillColor(130, 0, 94);
        doc.rect(0, 0, pageWidth, 12, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.text('PE 16.03 - Continuación', pageWidth / 2, 8, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        trasladoStartY = 24;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(130, 0, 94);
      doc.text('TRASLADOS REGISTRADOS', 14, trasladoStartY - 4);

      const trasladosData = traslados1603.map(t => [
        format(parseISO(t.fecha_traslado), 'dd/MM/yyyy'),
        t.base_origen,
        t.base_destino,
        t.observaciones || '-',
      ]);

      autoTable(doc, {
        startY: trasladoStartY,
        head: [['Fecha 1er turno nueva residencia', 'Base Origen', 'Base Destino', 'Observaciones']],
        body: trasladosData,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3, lineColor: [152, 153, 155], lineWidth: 0.5 },
        bodyStyles: { textColor: [30, 41, 59] },
        columnStyles: { 3: { cellWidth: 70 } },
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
                Inicio: {format(new Date(expediente1603.fecha_primer_servicio || expediente1603.fecha_inicio), 'dd/MM/yyyy')} • 
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
          {/* Action buttons - arriba para acceso rápido */}
          {puedeEditar && (
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                onClick={() => setRegistrarOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Actuación
              </Button>

              <Button 
                variant="outline"
                onClick={() => {
                  setTrasladoBaseOrigen(maquinista.base);
                  setTrasladoBaseOrigenOtra('');
                  setTrasladoOpen(true);
                }}
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Registrar Traslado
              </Button>
              
              {puedeCerrarManual && (
                <Button 
                  variant="default"
                  onClick={() => setCerrarOpen(true)}
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Cierre Manual
                </Button>
              )}
            </div>
          )}

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
                      const isEditable = puedeEditar && bloque.actuacion_id;
                      return (
                        <div 
                          key={bloque.id} 
                          className={`timeline-block ${
                            estado === 'justificada' ? 'bg-blue-50 border border-blue-300 dark:bg-blue-950/30 dark:border-blue-700' :
                            estado === 'cumplida' ? 'bg-status-cumplida-bg border border-status-ok' :
                            estado === 'en_ventana' ? 'bg-status-proximo-bg border border-status-proximo animate-pulse-soft' :
                            estado === 'vencida' ? 'bg-status-vencido-bg border border-status-vencido' :
                            'bg-muted border border-border'
                          } ${isEditable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                          onClick={() => isEditable && handleBlockClick(bloque)}
                          title={estado === 'justificada' ? 'Justificado por traslado' : isEditable ? 'Clic para editar' : undefined}
                        >
                          <p className="font-medium text-xs mb-1">{bloque.etiqueta || `Mes ${bloque.mes}`}</p>
                          {window && (
                            <p className="text-[10px] text-muted-foreground">
                              {format(window.inicio, 'dd/MM/yy')} - {format(window.fin, 'dd/MM/yy')}
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-center gap-1">
                            {estado === 'justificada' ? (
                              <ShieldCheck className="w-4 h-4 text-blue-500" />
                            ) : estado === 'cumplida' ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-status-ok" />
                                {isEditable && <Pencil className="w-3 h-3 text-muted-foreground" />}
                              </>
                            ) : estado === 'vencida' ? (
                              <XCircle className="w-4 h-4 text-status-vencido" />
                            ) : estado === 'en_ventana' ? (
                              <Clock className="w-4 h-4 text-status-proximo" />
                            ) : (
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          {/* Comment button for vencida blocks */}
                          {estado === 'vencida' && puedeEditar && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-1 text-xs h-5 px-1 gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setComentarioBloqueId(bloque.id);
                                setComentarioTexto(bloque.comentario_vencida || '');
                                setComentarioOpen(true);
                              }}
                            >
                              <MessageSquare className="w-3 h-3" />
                              {bloque.comentario_vencida ? 'Editar' : 'Comentar'}
                            </Button>
                          )}
                          {/* Show existing comment */}
                          {bloque.comentario_vencida && estado === 'vencida' && (
                            <p className="text-[9px] text-muted-foreground mt-1 truncate max-w-full" title={bloque.comentario_vencida}>
                              💬 {bloque.comentario_vencida}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
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
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-50 border border-blue-300 dark:bg-blue-950/30 dark:border-blue-700"></span>
              Justificada (traslado)
            </div>
          </div>

          {/* Traslados registrados */}
          {traslados1603.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Traslados registrados</p>
              {traslados1603.map(t => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-blue-50/50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800 text-sm">
                  <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="font-medium">{format(parseISO(t.fecha_traslado), 'dd/MM/yyyy')}</span>
                  <span className="text-muted-foreground flex-1">{t.base_origen} → {t.base_destino}</span>
                  {t.observaciones && <span className="text-muted-foreground text-xs truncate max-w-[120px]">— {t.observaciones}</span>}
                  {puedeEditar && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditTraslado(t)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog open={deletingTrasladoId === t.id} onOpenChange={(open) => !open && setDeletingTrasladoId(null)}>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingTrasladoId(t.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminar traslado</AlertDialogTitle>
                            <AlertDialogDescription>
                              Se eliminará el traslado del {format(parseISO(t.fecha_traslado), 'dd/MM/yyyy')} ({t.base_origen} → {t.base_destino}) y se restaurarán los bloques justificados asociados. ¿Continuar?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteTraslado(t.id)}>Eliminar</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actuaciones registradas */}
          {actuacionesRegistradas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actuaciones registradas</p>
              <div className="space-y-2">
                {actuacionesRegistradas.map((actuacion) => (
                  <div key={actuacion.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium">{tipoLabels[actuacion.tipo]}</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{format(parseISO(actuacion.fecha_real), 'dd/MM/yyyy')}</span>
                        {actuacion.indice_prever !== null && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <span>PREVER {actuacion.indice_prever}</span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {actuacion.observaciones ? <span>{actuacion.observaciones}</span> : <span>Sin observaciones</span>}
                        {actuacion.resultado && (
                          <>
                            <span>•</span>
                            <span>Resultado: {actuacion.resultado}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {puedeEditar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => openEditModal(actuacion, actuacion.tipo)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
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
              Introduce la fecha de la actuación para detectar automáticamente el bloque.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Fecha PRIMERO - detecta bloque automáticamente */}
            <div className="space-y-2">
              <Label>Fecha de la actuación *</Label>
              <Input
                type="date"
                value={fechaActuacion}
                onChange={(e) => {
                  setFechaActuacion(e.target.value);
                  // Auto-detect block if tipo is selected
                  if (selectedTipo && e.target.value) {
                    const detected = detectBlockForDate(e.target.value, selectedTipo);
                    if (detected) {
                      setSelectedMes(detected.mes);
                    }
                  }
                }}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            {/* Select tipo de actuación */}
            <div className="space-y-2">
              <Label>Tipo de acción de vigilancia *</Label>
              <Select 
                value={selectedTipo} 
                onValueChange={(v) => {
                  const tipo = v as TipoActuacion1603;
                  setSelectedTipo(tipo);
                  // Auto-detect block based on fecha
                  if (fechaActuacion) {
                    const detected = detectBlockForDate(fechaActuacion, tipo);
                    if (detected) {
                      setSelectedMes(detected.mes);
                    } else {
                      setSelectedMes(null);
                    }
                  } else {
                    setSelectedMes(null);
                  }
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

            {/* Bloque detectado automáticamente o manual */}
            {selectedTipo && (
              <div className="space-y-2">
                <Label>Bloque asignado</Label>
                {bloqueCoincidente ? (
                  <div className="p-3 rounded-lg bg-status-ok-bg border border-status-ok">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-status-ok" />
                      <span className="font-medium text-sm">
                        {bloqueCoincidente.etiqueta || `Mes ${bloqueCoincidente.mes}`}
                      </span>
                    </div>
                    {bloqueCoincidente.inicio_ventana && bloqueCoincidente.fin_ventana && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Ventana: {format(parseISO(bloqueCoincidente.inicio_ventana), 'dd/MM/yyyy')} - {format(parseISO(bloqueCoincidente.fin_ventana), 'dd/MM/yyyy')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-status-vencido-bg border border-status-vencido">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-status-vencido" />
                      <span className="font-medium text-sm text-status-vencido">
                        No hay bloque para este tipo y fecha
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      La fecha no coincide con ninguna ventana. Selecciona manualmente:
                    </p>
                    <Select 
                      value={selectedMes?.toString() || ''} 
                      onValueChange={(v) => setSelectedMes(parseInt(v))}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Seleccionar bloque manualmente" />
                      </SelectTrigger>
                      <SelectContent>
                        {plan1603.filter(b => b.tipo === selectedTipo).map(bloque => {
                          const window = getBlockWindow(bloque);
                          return (
                            <SelectItem 
                              key={bloque.id} 
                              value={bloque.mes.toString()}
                            >
                              {bloque.etiqueta || `Mes ${bloque.mes}`} {window ? `(${format(window.inicio, 'dd/MM/yy')} - ${format(window.fin, 'dd/MM/yy')})` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Km recorridos (solo para registro) */}
            {selectedTipo === 'registro' && (
              <div className="space-y-2">
                <Label>Km analizados <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  type="text"
                  value={kmRecorridos}
                  onChange={(e) => setKmRecorridos(e.target.value)}
                  placeholder="Ej: 45"
                />
                <p className="text-xs text-muted-foreground">Suma para el criterio de 100 km del Plan de Acción Anual</p>
              </div>
            )}

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
              disabled={saving || !selectedTipo || !bloqueCoincidente || !fechaActuacion}
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

            {/* Km recorridos (solo para registro) */}
            {selectedTipo === 'registro' && (
              <div className="space-y-2">
                <Label>Km analizados <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  type="text"
                  value={kmRecorridos}
                  onChange={(e) => setKmRecorridos(e.target.value)}
                  placeholder="Ej: 45"
                />
                <p className="text-xs text-muted-foreground">Suma para el criterio de 100 km del Plan de Acción Anual</p>
              </div>
            )}

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

          <DialogFooter className="flex justify-between sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={saving}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar actuación?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción no se puede deshacer. La actuación será eliminada permanentemente
                    y el bloque del plan volverá a estado pendiente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEliminarActuacion} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Registrar/Editar Traslado */}
      <Dialog open={trasladoOpen} onOpenChange={(open) => {
        setTrasladoOpen(open);
        if (!open) {
          setEditingTraslado(null);
          setTrasladoFecha(format(new Date(), 'yyyy-MM-dd'));
           setTrasladoBaseOrigen(maquinista.base);
           setTrasladoBaseOrigenOtra('');
          setTrasladoBaseDestino('');
          setTrasladoBaseDestinoOtra('');
          setTrasladoObservaciones('');
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-500" />
              {editingTraslado ? 'Editar Traslado' : 'Registrar Traslado'}
            </DialogTitle>
            <DialogDescription>
              {editingTraslado
                ? 'Modifica los datos del traslado. Se recalcularán los bloques justificados.'
                : 'Registra un traslado de base. Las actuaciones vencidas quedarán justificadas. Si la base de destino es GESBASE, se actualizará la base del maquinista.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fecha primer turno en nueva residencia *</Label>
              <Input
                type="date"
                value={trasladoFecha}
                onChange={(e) => setTrasladoFecha(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div className="space-y-2">
              <Label>Base de origen *</Label>
              <Select value={trasladoBaseOrigen} onValueChange={(v) => {
                setTrasladoBaseOrigen(v);
                if (v !== '__otra__') setTrasladoBaseOrigenOtra('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar base de origen" />
                </SelectTrigger>
                <SelectContent>
                  {basesActivas.map(b => (
                    <SelectItem key={b.id} value={b.nombre}>{b.nombre}</SelectItem>
                  ))}
                  <SelectItem value="__otra__">Otra (no GESBASE)</SelectItem>
                </SelectContent>
              </Select>
              {trasladoBaseOrigen === '__otra__' && (
                <Input
                  value={trasladoBaseOrigenOtra}
                  onChange={(e) => setTrasladoBaseOrigenOtra(e.target.value)}
                  placeholder="Nombre de la base externa"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Base de destino *</Label>
              <Select value={trasladoBaseDestino} onValueChange={(v) => {
                setTrasladoBaseDestino(v);
                if (v !== '__otra__') setTrasladoBaseDestinoOtra('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar base de destino" />
                </SelectTrigger>
                <SelectContent>
                  {basesActivas
                    .filter(b => b.nombre !== trasladoBaseOrigen)
                    .map(b => (
                      <SelectItem key={b.id} value={b.nombre}>{b.nombre}</SelectItem>
                    ))}
                  <SelectItem value="__otra__">Otra (no GESBASE)</SelectItem>
                </SelectContent>
              </Select>
              {trasladoBaseDestino === '__otra__' && (
                <Input
                  value={trasladoBaseDestinoOtra}
                  onChange={(e) => setTrasladoBaseDestinoOtra(e.target.value)}
                  placeholder="Nombre de la base externa"
                  className="mt-2"
                />
              )}
            </div>

            {/* Info: base will be updated */}
            {trasladoBaseDestino && trasladoBaseDestino !== '__otra__' && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800">
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  ✓ La base del maquinista se actualizará automáticamente a <strong>{trasladoBaseDestino}</strong>
                </p>
              </div>
            )}

            {/* Preview of blocks that will be justified */}
            {trasladoFecha && (() => {
              const trasladoDate = parseISO(trasladoFecha);
              const bloquesAJustificar = plan1603.filter(b => {
                if (b.actuacion_id || b.justificado_traslado) return false;
                if (!b.fin_ventana) return false;
                const fin = parseISO(b.fin_ventana);
                return isBefore(fin, trasladoDate) || fin.getTime() === trasladoDate.getTime();
              });

              return bloquesAJustificar.length > 0 ? (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-sm">{bloquesAJustificar.length} bloque(s) se justificarán</span>
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {bloquesAJustificar.map(b => (
                      <li key={b.id}>• {tipoLabels[b.tipo]} - {b.etiqueta || `Mes ${b.mes}`}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">No hay bloques vencidos que justificar para esta fecha.</p>
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label>Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea
                value={trasladoObservaciones}
                onChange={(e) => setTrasladoObservaciones(e.target.value)}
                placeholder="Motivo del traslado, circunstancias..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTrasladoOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button 
              onClick={editingTraslado ? handleUpdateTraslado : handleRegistrarTraslado} 
              disabled={saving || !trasladoFecha || !trasladoBaseOrigen || !trasladoBaseDestino || (trasladoBaseDestino === '__otra__' && !trasladoBaseDestinoOtra)}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTraslado ? 'Guardar Cambios' : 'Registrar Traslado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog: Comentar acción vencida */}
      <Dialog open={comentarioOpen} onOpenChange={setComentarioOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comentar acción vencida</DialogTitle>
            <DialogDescription>
              Añade un comentario explicando el motivo del vencimiento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={comentarioTexto}
              onChange={(e) => setComentarioTexto(e.target.value)}
              placeholder="Ej: Maquinista de baja médica, pendiente de reincorporación..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setComentarioOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleGuardarComentarioVencida} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
