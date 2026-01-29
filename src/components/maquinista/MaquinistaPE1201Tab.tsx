import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Loader2,
  AlertCircle,
  Lock,
  CalendarClock,
  Pencil,
  AlertTriangle,
  Ban,
  Trash2,
  Users,
  FileText
} from 'lucide-react';
import { format, parseISO, addDays, isAfter, isBefore, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface MaquinistaPE1201TabProps {
  maquinistaId: string;
  maquinistaNombre: string;
  onRefetch?: () => void;
}

type EstadoBloque1201 = 'pendiente' | 'programado' | 'realizado' | 'no_procede';
type TipoBloque1201 = 'acompanamiento' | 'registro';

interface Expediente1201 {
  id: string;
  maquinista_id: string;
  id_suceso: string;
  fecha_suceso: string | null;
  fecha_primer_servicio: string;
  descripcion_suceso: string | null;
  observaciones: string | null;
  estado: 'abierto' | 'cerrado';
  cierre_manual: boolean | null;
  fecha_cierre: string | null;
  cerrado_por: string | null;
  fecha_fin_prevista: string | null;
}

interface PlanBloque1201 {
  id: string;
  expediente_id: string;
  actuacion_id: string | null;
  tipo: string;
  etiqueta: string;
  dia_desde_origen: number;
  fecha_objetivo: string | null;
  estado: EstadoBloque1201;
  obligatorio: boolean;
}

interface Actuacion1201 {
  id: string;
  expediente_id: string;
  plan_id: string | null;
  fecha_programada: string | null;
  fecha_real: string | null;
  tipo_accion: string;
  descripcion: string | null;
  resultado: string | null;
  observaciones: string | null;
}

const tipoLabels: Record<string, string> = {
  acompanamiento: 'Acompañamientos',
  registro: 'Registros',
  hito_obligatorio: 'Hitos', // legacy
};

export function MaquinistaPE1201Tab({ 
  maquinistaId, 
  maquinistaNombre,
  onRefetch 
}: MaquinistaPE1201TabProps) {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [expediente, setExpediente] = useState<Expediente1201 | null>(null);
  const [plan, setPlan] = useState<PlanBloque1201[]>([]);
  const [actuaciones, setActuaciones] = useState<Actuacion1201[]>([]);
  
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [editarExpedienteOpen, setEditarExpedienteOpen] = useState(false);
  const [cerrarOpen, setCerrarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state for actuacion
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedTipoBloque, setSelectedTipoBloque] = useState<TipoBloque1201>('acompanamiento');
  const [fechaActuacion, setFechaActuacion] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [descripcion, setDescripcion] = useState('');
  const [resultado, setResultado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [editingActuacion, setEditingActuacion] = useState<Actuacion1201 | null>(null);
  
  // Form state for expediente edit
  const [editIdSuceso, setEditIdSuceso] = useState('');
  const [editFechaSuceso, setEditFechaSuceso] = useState('');
  const [editFechaPrimerServicio, setEditFechaPrimerServicio] = useState('');
  const [editDescripcionSuceso, setEditDescripcionSuceso] = useState('');
  const [editObservaciones, setEditObservaciones] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch expediente (open or most recent)
      const { data: expData, error: expError } = await supabase
        .from('expedientes_1201')
        .select('*')
        .eq('maquinista_id', maquinistaId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (expError) {
        console.error('Error fetching expediente 1201:', expError);
      }

      if (expData) {
        setExpediente(expData as Expediente1201);

        // Fetch plan
        const { data: planData } = await supabase
          .from('plan_1201')
          .select('*')
          .eq('expediente_id', expData.id)
          .order('tipo')
          .order('dia_desde_origen');

        if (planData) {
          setPlan(planData as PlanBloque1201[]);
        }

        // Fetch actuaciones - orden ascendente por fecha
        const { data: actData } = await supabase
          .from('actuaciones_1201')
          .select('*')
          .eq('expediente_id', expData.id)
          .order('fecha_real', { ascending: true });

        if (actData) {
          setActuaciones(actData as Actuacion1201[]);
        }
      } else {
        setExpediente(null);
        setPlan([]);
        setActuaciones([]);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [maquinistaId]);

  // Calculate states
  const expedienteCerrado = expediente?.estado === 'cerrado';
  
  const fechaFinPrevista = useMemo(() => {
    if (!expediente?.fecha_primer_servicio) return null;
    return addDays(parseISO(expediente.fecha_primer_servicio), 40);
  }, [expediente?.fecha_primer_servicio]);

  const deberiaCerrarseAuto = useMemo(() => {
    if (!expediente || expediente.estado === 'cerrado' || !fechaFinPrevista) return false;
    return isAfter(new Date(), fechaFinPrevista);
  }, [expediente, fechaFinPrevista]);

  // Permissions: only admin can modify after 40 days or when closed
  const puedeEditar = useMemo(() => {
    if (!expediente) return false;
    if (expedienteCerrado) return isAdmin;
    if (deberiaCerrarseAuto) return isAdmin;
    return true; // Open and within 40 days
  }, [expediente, expedienteCerrado, deberiaCerrarseAuto, isAdmin]);

  // PE 12.01 NO tiene ventana de cumplimiento - solo fecha exacta
  const getBlockState = (bloque: PlanBloque1201): 'pendiente' | 'vencida' | 'cumplida' | 'no_procede' => {
    if (bloque.estado === 'no_procede') return 'no_procede';
    if (bloque.actuacion_id) return 'cumplida';
    
    if (!bloque.fecha_objetivo) return 'pendiente';
    
    const fechaObjetivo = parseISO(bloque.fecha_objetivo);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Vencida si ya pasó la fecha objetivo
    if (isAfter(now, fechaObjetivo)) return 'vencida';
    return 'pendiente';
  };

  // Calculate compliance
  const cumplimiento = useMemo(() => {
    if (plan.length === 0) return { total: 0, cumplidas: 0, porcentaje: 0 };
    
    const totalObligatorios = plan.filter(b => b.obligatorio).length;
    const cumplidos = plan.filter(b => b.obligatorio && (b.actuacion_id || b.estado === 'no_procede')).length;
    const porcentaje = totalObligatorios > 0 ? Math.round((cumplidos / totalObligatorios) * 100) : 0;
    
    return { total: totalObligatorios, cumplidas: cumplidos, porcentaje };
  }, [plan]);

  // Group plan by type
  const planPorTipo = useMemo(() => {
    const grouped: Record<string, PlanBloque1201[]> = {};
    plan.forEach(bloque => {
      const tipo = bloque.tipo;
      if (!grouped[tipo]) grouped[tipo] = [];
      grouped[tipo].push(bloque);
    });
    return grouped;
  }, [plan]);

  const resetForm = () => {
    setSelectedPlanId(null);
    setSelectedTipoBloque('acompanamiento');
    setFechaActuacion(format(new Date(), 'yyyy-MM-dd'));
    setDescripcion('');
    setResultado('');
    setObservaciones('');
    setEditingActuacion(null);
  };

  // Auto-detect block based on fecha and tipo (sin ventana, asigna al bloque con fecha más cercana)
  const detectBlockForDate = (fecha: string, tipo: TipoBloque1201): PlanBloque1201 | null => {
    if (!fecha || !tipo) return null;
    
    const fechaDate = parseISO(fecha);
    fechaDate.setHours(0, 0, 0, 0);
    const bloquesPendientes = plan.filter(b => b.tipo === tipo && !b.actuacion_id && b.estado !== 'no_procede');
    
    // Ordenar por día y buscar el bloque cuya fecha objetivo coincida o sea la siguiente
    const sortedBloques = bloquesPendientes.sort((a, b) => a.dia_desde_origen - b.dia_desde_origen);
    
    for (const bloque of sortedBloques) {
      if (!bloque.fecha_objetivo) continue;
      const fechaObjetivo = parseISO(bloque.fecha_objetivo);
      fechaObjetivo.setHours(0, 0, 0, 0);
      
      // Si la fecha de actuación es menor o igual a la fecha objetivo, asignar a este bloque
      if (fechaDate.getTime() <= fechaObjetivo.getTime()) {
        return bloque;
      }
    }
    
    // Si la fecha es posterior a todos los bloques, asignar al último pendiente
    return sortedBloques[sortedBloques.length - 1] || null;
  };

  // Auto-detected block based on fecha and tipo
  const bloqueCoincidente = useMemo(() => {
    if (!selectedTipoBloque || !fechaActuacion) return null;
    return detectBlockForDate(fechaActuacion, selectedTipoBloque);
  }, [selectedTipoBloque, fechaActuacion, plan]);

  const handleRegistrar = async () => {
    if (!expediente || !fechaActuacion || !selectedTipoBloque) return;

    // Check for matching block
    if (!bloqueCoincidente) {
      toast({
        title: 'Error',
        description: 'No se encontró un bloque pendiente para la fecha y tipo seleccionados.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Create actuacion - use bloqueCoincidente.tipo as tipo_accion
      const { data: actuacion, error: actError } = await supabase
        .from('actuaciones_1201')
        .insert({
          expediente_id: expediente.id,
          plan_id: bloqueCoincidente.id,
          fecha_real: fechaActuacion,
          tipo_accion: bloqueCoincidente.tipo,
          descripcion: descripcion.trim() || null,
          resultado: resultado.trim() || null,
          observaciones: observaciones.trim() || null,
          registrado_por: user?.id,
        })
        .select()
        .single();

      if (actError) throw actError;

      // Update plan block
      const { error: planError } = await supabase
        .from('plan_1201')
        .update({
          actuacion_id: actuacion.id,
          estado: 'realizado',
        })
        .eq('id', bloqueCoincidente.id);

      if (planError) throw planError;

      toast({
        title: 'Actuación registrada',
        description: `${tipoLabels[bloqueCoincidente.tipo] || bloqueCoincidente.tipo} - ${bloqueCoincidente.etiqueta} marcado como cumplido`,
      });

      resetForm();
      setRegistrarOpen(false);
      fetchData();
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

  const handleEditar = async () => {
    if (!editingActuacion) return;

    // Detect new block if date changed
    const newBlock = detectBlockForDate(fechaActuacion, editingActuacion.tipo_accion as TipoBloque1201);
    const oldPlanId = editingActuacion.plan_id;
    const newPlanId = newBlock?.id || null;

    // If date changed and block changed, validate
    if (oldPlanId !== newPlanId && !newBlock) {
      toast({
        title: 'Error',
        description: 'No se encontró un bloque pendiente para la nueva fecha.',
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }

    setSaving(true);
    try {
      // If block changed, update both old and new
      if (oldPlanId && oldPlanId !== newPlanId) {
        // Reset old block
        await supabase
          .from('plan_1201')
          .update({ actuacion_id: null, estado: 'pendiente' })
          .eq('id', oldPlanId);
      }

      // Update actuacion
      const { error } = await supabase
        .from('actuaciones_1201')
        .update({
          fecha_real: fechaActuacion,
          plan_id: newPlanId,
          descripcion: descripcion.trim() || null,
          resultado: resultado.trim() || null,
          observaciones: observaciones.trim() || null,
        })
        .eq('id', editingActuacion.id);

      if (error) throw error;

      // Update new block if different
      if (newPlanId && oldPlanId !== newPlanId) {
        await supabase
          .from('plan_1201')
          .update({ actuacion_id: editingActuacion.id, estado: 'realizado' })
          .eq('id', newPlanId);
      }

      toast({
        title: 'Actuación actualizada',
        description: 'Los cambios se han guardado correctamente.',
      });

      resetForm();
      setEditarOpen(false);
      fetchData();
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

    setSaving(true);
    try {
      // First unlink from plan_1201
      if (editingActuacion.plan_id) {
        const { error: unlinkError } = await supabase
          .from('plan_1201')
          .update({ actuacion_id: null, estado: 'pendiente' })
          .eq('actuacion_id', editingActuacion.id);

        if (unlinkError) throw unlinkError;
      }

      // Then delete the actuacion
      const { error: deleteError } = await supabase
        .from('actuaciones_1201')
        .delete()
        .eq('id', editingActuacion.id);

      if (deleteError) throw deleteError;

      toast({
        title: 'Actuación eliminada',
        description: 'La actuación se ha eliminado correctamente.',
      });

      resetForm();
      setEditarOpen(false);
      fetchData();
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

  const handleCerrar = async () => {
    if (!expediente) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('expedientes_1201')
        .update({
          estado: 'cerrado',
          cierre_manual: true,
          fecha_cierre: new Date().toISOString(),
          cerrado_por: user?.id,
          updated_by: user?.id,
        })
        .eq('id', expediente.id);

      if (error) throw error;

      toast({
        title: 'Expediente cerrado',
        description: 'El expediente PE 12.01 ha sido cerrado manualmente.',
      });

      setCerrarOpen(false);
      fetchData();
      onRefetch?.();
    } catch (err) {
      console.error('Error closing expediente:', err);
      toast({
        title: 'Error',
        description: (err as any)?.message || 'No se pudo cerrar el expediente',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarNoProcede = async (bloqueId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('plan_1201')
        .update({ estado: 'no_procede' })
        .eq('id', bloqueId);

      if (error) throw error;

      toast({ title: 'Hito marcado como "No procede"' });
      fetchData();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el hito',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevertirNoProcede = async (bloqueId: string) => {
    if (!puedeEditar) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('plan_1201')
        .update({ estado: 'pendiente' })
        .eq('id', bloqueId);

      if (error) throw error;

      toast({ title: 'Hito restaurado a pendiente' });
      fetchData();
    } catch (err) {
      toast({
        title: 'Error',
        description: 'No se pudo restaurar el hito',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (actuacion: Actuacion1201) => {
    setEditingActuacion(actuacion);
    setFechaActuacion(actuacion.fecha_real || format(new Date(), 'yyyy-MM-dd'));
    setDescripcion(actuacion.descripcion || '');
    setResultado(actuacion.resultado || '');
    setObservaciones(actuacion.observaciones || '');
    setEditarOpen(true);
  };

  const openEditExpedienteModal = () => {
    if (!expediente) return;
    setEditIdSuceso(expediente.id_suceso);
    setEditFechaSuceso(expediente.fecha_suceso || '');
    setEditFechaPrimerServicio(expediente.fecha_primer_servicio);
    setEditDescripcionSuceso(expediente.descripcion_suceso || '');
    setEditObservaciones(expediente.observaciones || '');
    setEditarExpedienteOpen(true);
  };

  const handleEditarExpediente = async () => {
    if (!expediente) return;

    setSaving(true);
    try {
      const fechaCambio = editFechaPrimerServicio !== expediente.fecha_primer_servicio;
      
      const { error } = await supabase
        .from('expedientes_1201')
        .update({
          id_suceso: editIdSuceso.trim(),
          fecha_suceso: editFechaSuceso || null,
          fecha_primer_servicio: editFechaPrimerServicio,
          descripcion_suceso: editDescripcionSuceso.trim() || null,
          observaciones: editObservaciones.trim() || null,
          updated_by: user?.id,
        })
        .eq('id', expediente.id);

      if (error) throw error;

      // Si cambió la fecha de primer servicio, recalcular el plan
      if (fechaCambio) {
        const { error: recalcError } = await supabase.rpc('recalcular_plan_1201', {
          _expediente_id: expediente.id,
          _fecha_origen: editFechaPrimerServicio,
        });
        
        if (recalcError) {
          console.error('Error recalculando plan:', recalcError);
          // No lanzamos error porque el expediente ya se actualizó
        }
      }

      toast({
        title: 'Expediente actualizado',
        description: fechaCambio 
          ? 'Los cambios se han guardado y el plan ha sido recalculado.' 
          : 'Los cambios se han guardado correctamente.',
      });

      setEditarExpedienteOpen(false);
      fetchData();
      onRefetch?.();
    } catch (err) {
      console.error('Error updating expediente:', err);
      toast({
        title: 'Error',
        description: (err as any)?.message || 'No se pudo actualizar el expediente',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!expediente) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay expediente PE 12.01 para este maquinista.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Puedes crear uno desde la página PE 12.01 - Factor Humano.
          </p>
        </CardContent>
      </Card>
    );
  }

  const diasRestantes = fechaFinPrevista ? differenceInDays(fechaFinPrevista, new Date()) : 0;

  return (
    <div className="space-y-6">
      {/* Warning if past 40 days and still open */}
      {deberiaCerrarseAuto && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Han pasado más de 40 días desde el primer servicio
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {isAdmin ? 'El expediente debería cerrarse.' : 'Solo un administrador puede modificar este expediente.'}
                </p>
              </div>
            </div>
            {isAdmin && !expedienteCerrado && (
              <Button size="sm" variant="outline" onClick={() => setCerrarOpen(true)}>
                <Lock className="w-4 h-4 mr-2" />
                Cerrar
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Expediente Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-status-proximo" />
                Expediente PE 12.01 - {expediente.id_suceso}
              </CardTitle>
              <CardDescription>
                Suceso: {expediente.fecha_suceso ? format(parseISO(expediente.fecha_suceso), 'dd/MM/yyyy') : 'N/A'} • 
                1er Servicio: {format(parseISO(expediente.fecha_primer_servicio), 'dd/MM/yyyy')} • 
                Cierre previsto: {fechaFinPrevista ? format(fechaFinPrevista, 'dd/MM/yyyy') : 'N/A'}
                {!expedienteCerrado && diasRestantes > 0 && (
                  <span className={diasRestantes <= 7 ? 'text-status-vencido font-medium ml-2' : 'ml-2'}>
                    ({diasRestantes} días restantes)
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {puedeEditar && (
                <Button variant="outline" size="sm" onClick={openEditExpedienteModal}>
                  <Pencil className="w-3 h-3 mr-1" />
                  Editar
                </Button>
              )}
              <StatusBadge estado={expediente.estado === 'abierto' ? 'Abierta' : 'Cerrada'} />
              {expedienteCerrado && expediente.cierre_manual && (
                <Badge variant="secondary" className="text-xs">Manual</Badge>
              )}
            </div>
          </div>

          {/* Descripción del suceso */}
          {expediente.descripcion_suceso && (
            <div className="mt-3 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-1">Descripción del suceso:</p>
              <p className="text-sm text-muted-foreground">{expediente.descripcion_suceso}</p>
            </div>
          )}

          {/* Observaciones */}
          {expediente.observaciones && (
            <div className="mt-2 p-3 bg-muted/30 rounded-lg">
              <p className="text-sm font-medium mb-1">Observaciones:</p>
              <p className="text-sm text-muted-foreground">{expediente.observaciones}</p>
            </div>
          )}

          {/* Info de cierre */}
          {expedienteCerrado && expediente.fecha_cierre && (
            <div className="mt-2 p-2 rounded bg-muted/50 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <CalendarClock className="w-3 h-3" />
                Cerrado: {format(parseISO(expediente.fecha_cierre), 'dd/MM/yyyy HH:mm', { locale: es })}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Cumplimiento */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">% Cumplimiento del Seguimiento</h4>
              <Badge 
                variant={cumplimiento.porcentaje >= 75 ? 'default' : cumplimiento.porcentaje >= 50 ? 'secondary' : 'destructive'}
                className="text-sm"
              >
                {cumplimiento.porcentaje}%
              </Badge>
            </div>
            <Progress value={cumplimiento.porcentaje} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {cumplimiento.cumplidas} de {cumplimiento.total} hitos completados
            </p>
          </div>

          {/* Timeline por bandas - igual que PE 16.03 */}
          <div className="border rounded-lg overflow-hidden">
            {Object.entries(planPorTipo).map(([tipo, bloques]) => {
              if (bloques.length === 0) return null;
              
              return (
                <div key={tipo} className="timeline-band">
                  <div className="timeline-label">
                    {tipo === 'acompanamiento' ? (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {tipoLabels[tipo] || tipo}
                      </div>
                    ) : tipo === 'registro' ? (
                      <div className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {tipoLabels[tipo] || tipo}
                      </div>
                    ) : (
                      tipoLabels[tipo] || tipo
                    )}
                  </div>
                  <div className="timeline-blocks">
                    {bloques.map((bloque) => {
                      const estado = getBlockState(bloque);
                      const isEditable = puedeEditar && bloque.actuacion_id;
                      const actuacion = actuaciones.find(a => a.id === bloque.actuacion_id);
                      
                      return (
                        <div 
                          key={bloque.id} 
                          className={`timeline-block ${
                            estado === 'cumplida' ? 'bg-status-cumplida-bg border border-status-ok' :
                            estado === 'no_procede' ? 'bg-muted/50 border border-muted-foreground/30' :
                            estado === 'vencida' ? 'bg-status-vencido-bg border border-status-vencido' :
                            'bg-muted border border-border'
                          } ${isEditable ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                          onClick={() => actuacion && isEditable && openEditModal(actuacion)}
                          title={isEditable ? 'Clic para editar' : undefined}
                        >
                          <p className="font-medium text-xs mb-1">{bloque.etiqueta}</p>
                          {bloque.fecha_objetivo && (
                            <p className="text-[10px] text-muted-foreground">
                              {format(parseISO(bloque.fecha_objetivo), 'dd/MM/yy')}
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-center gap-1">
                            {estado === 'cumplida' ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-status-ok" />
                                {isEditable && <Pencil className="w-3 h-3 text-muted-foreground" />}
                              </>
                            ) : estado === 'no_procede' ? (
                              <Ban className="w-4 h-4 text-muted-foreground" />
                            ) : estado === 'vencida' ? (
                              <XCircle className="w-4 h-4 text-status-vencido" />
                            ) : (
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          {/* Mark as no procede */}
                          {puedeEditar && !bloque.actuacion_id && bloque.estado !== 'no_procede' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-2 text-xs h-5 px-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarcarNoProcede(bloque.id);
                              }}
                            >
                              No procede
                            </Button>
                          )}
                          {/* Revert no procede */}
                          {puedeEditar && bloque.estado === 'no_procede' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="mt-2 text-xs h-5 px-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevertirNoProcede(bloque.id);
                              }}
                            >
                              Restaurar
                            </Button>
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
          <div className="flex items-center gap-4 text-xs border-t pt-3">
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
              <span className="w-3 h-3 rounded-full bg-muted/50 border border-muted-foreground/30"></span>
              No procede
            </div>
          </div>

          {/* Actuaciones list */}
          {actuaciones.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3">Actuaciones registradas ({actuaciones.length})</h4>
              <div className="space-y-2">
                {actuaciones.map((act) => (
                  <div 
                    key={act.id} 
                    className={`flex items-center justify-between p-3 rounded-lg bg-muted/30 ${puedeEditar ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={() => puedeEditar && openEditModal(act)}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {tipoLabels[act.tipo_accion] || act.tipo_accion || 'Actuación'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {act.fecha_real ? format(parseISO(act.fecha_real), 'dd/MM/yyyy') : '-'}
                        {act.descripcion && ` • ${act.descripcion}`}
                      </p>
                    </div>
                    {puedeEditar && <Pencil className="w-4 h-4 text-muted-foreground" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {puedeEditar && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  resetForm();
                  setRegistrarOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Registrar Actuación
              </Button>
              
              {!expedienteCerrado && (
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
        </CardContent>
      </Card>

      {/* Modal Registrar Actuación */}
      <Dialog open={registrarOpen} onOpenChange={setRegistrarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Actuación</DialogTitle>
            <DialogDescription>
              Selecciona el tipo e introduce la fecha. El sistema detectará automáticamente el hito correspondiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tipo de bloque */}
            <div className="space-y-2">
              <Label>Tipo de hito *</Label>
              <Select value={selectedTipoBloque} onValueChange={(v) => setSelectedTipoBloque(v as TipoBloque1201)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acompanamiento">Acompañamiento</SelectItem>
                  <SelectItem value="registro">Registro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha de la actuación */}
            <div className="space-y-2">
              <Label>Fecha de la actuación *</Label>
              <Input
                type="date"
                value={fechaActuacion}
                onChange={(e) => setFechaActuacion(e.target.value)}
              />
            </div>

            {/* Show detected block */}
            {selectedTipoBloque && fechaActuacion && (
              <div className={`p-3 rounded-lg border ${bloqueCoincidente ? 'bg-status-cumplida-bg border-status-ok' : 'bg-status-vencido-bg border-status-vencido'}`}>
                {bloqueCoincidente ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-status-ok" />
                    <div>
                      <p className="text-sm font-medium">Bloque detectado: {bloqueCoincidente.etiqueta}</p>
                      {bloqueCoincidente.fecha_objetivo && (
                        <p className="text-xs text-muted-foreground">
                          Fecha objetivo: {format(parseISO(bloqueCoincidente.fecha_objetivo), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-status-vencido" />
                    <p className="text-sm">No hay hitos pendientes para esta combinación de tipo y fecha.</p>
                  </div>
                )}
              </div>
            )}

            {/* Descripción */}
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Descripción de la actuación..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Resultado</Label>
              <Input
                placeholder="Resultado de la actuación..."
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistrarOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleRegistrar} disabled={saving || !selectedTipoBloque || !fechaActuacion || !bloqueCoincidente}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Actuación */}
      <Dialog open={editarOpen} onOpenChange={setEditarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Actuación</DialogTitle>
            <DialogDescription>
              {editingActuacion && (
                <span>Tipo: {tipoLabels[editingActuacion.tipo_accion] || editingActuacion.tipo_accion}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fecha de la actuación *</Label>
              <Input
                type="date"
                value={fechaActuacion}
                onChange={(e) => setFechaActuacion(e.target.value)}
              />
            </div>

            {/* Show detected block info when editing */}
            {editingActuacion && fechaActuacion && (
              (() => {
                const newBlock = detectBlockForDate(fechaActuacion, editingActuacion.tipo_accion as TipoBloque1201);
                const oldPlanId = editingActuacion.plan_id;
                const hasChanged = newBlock?.id !== oldPlanId;
                
                return (
                  <div className={`p-3 rounded-lg border ${newBlock ? 'bg-muted/50 border-border' : 'bg-status-vencido-bg border-status-vencido'}`}>
                    {newBlock ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            Bloque: {newBlock.etiqueta}
                            {hasChanged && <span className="text-status-proximo ml-2">(cambiará)</span>}
                          </p>
                          {newBlock.fecha_objetivo && (
                            <p className="text-xs text-muted-foreground">
                              Fecha objetivo: {format(parseISO(newBlock.fecha_objetivo), 'dd/MM/yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-status-vencido" />
                        <p className="text-sm">No hay hitos pendientes para esta fecha.</p>
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                placeholder="Descripción de la actuación..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Resultado</Label>
              <Input
                placeholder="Resultado de la actuación..."
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
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
                    y el hito asociado volverá a estado pendiente.
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
              <Button onClick={handleEditar} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cierre */}
      <Dialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Expediente PE 12.01</DialogTitle>
            <DialogDescription>
              {deberiaCerrarseAuto 
                ? 'Han pasado más de 40 días. ¿Confirmas el cierre del expediente?'
                : '¿Confirmas el cierre manual del expediente antes de los 40 días?'
              }
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
              <p><strong>Cumplimiento:</strong> {cumplimiento.porcentaje}% ({cumplimiento.cumplidas}/{cumplimiento.total} hitos)</p>
              <p><strong>Actuaciones registradas:</strong> {actuaciones.length}</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCerrarOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleCerrar} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cerrar Expediente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Expediente */}
      <Dialog open={editarExpedienteOpen} onOpenChange={setEditarExpedienteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Editar Expediente PE 12.01
            </DialogTitle>
            <DialogDescription>
              Modifica los datos del expediente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* ID Suceso */}
            <div className="space-y-2">
              <Label>ID Suceso *</Label>
              <Input
                placeholder="Ej: SUC-2025-0001"
                value={editIdSuceso}
                onChange={(e) => setEditIdSuceso(e.target.value)}
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha del suceso</Label>
                <Input
                  type="date"
                  value={editFechaSuceso}
                  onChange={(e) => setEditFechaSuceso(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Primer servicio tras suceso *</Label>
                <Input
                  type="date"
                  value={editFechaPrimerServicio}
                  onChange={(e) => setEditFechaPrimerServicio(e.target.value)}
                />
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-2">
              <Label>Descripción del suceso</Label>
              <Textarea
                placeholder="Descripción breve del suceso..."
                value={editDescripcionSuceso}
                onChange={(e) => setEditDescripcionSuceso(e.target.value)}
                rows={3}
              />
            </div>

            {/* Observaciones */}
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea
                placeholder="Notas adicionales..."
                value={editObservaciones}
                onChange={(e) => setEditObservaciones(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditarExpedienteOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleEditarExpediente} disabled={saving || !editIdSuceso.trim() || !editFechaPrimerServicio}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
