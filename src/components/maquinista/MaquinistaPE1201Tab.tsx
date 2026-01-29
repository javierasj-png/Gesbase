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
  User,
  CalendarClock,
  Pencil,
  AlertTriangle,
  Ban
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

const tiposAccion = [
  { value: 'entrevista', label: 'Entrevista' },
  { value: 'acompanamiento', label: 'Acompañamiento' },
  { value: 'formacion', label: 'Formación' },
  { value: 'evaluacion', label: 'Evaluación' },
  { value: 'otro', label: 'Otro' },
];

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
  const [fechaActuacion, setFechaActuacion] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tipoAccion, setTipoAccion] = useState('entrevista');
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
      // Fetch expediente
      const { data: expData, error: expError } = await supabase
        .from('expedientes_1201')
        .select('*')
        .eq('maquinista_id', maquinistaId)
        .eq('estado', 'abierto')
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
          .order('dia_desde_origen');

        if (planData) {
          setPlan(planData as PlanBloque1201[]);
        }

        // Fetch actuaciones
        const { data: actData } = await supabase
          .from('actuaciones_1201')
          .select('*')
          .eq('expediente_id', expData.id)
          .order('fecha_real', { ascending: false });

        if (actData) {
          setActuaciones(actData as Actuacion1201[]);
        }
      } else {
        // Check for closed expediente
        const { data: closedExp } = await supabase
          .from('expedientes_1201')
          .select('*')
          .eq('maquinista_id', maquinistaId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (closedExp) {
          setExpediente(closedExp as Expediente1201);
          
          const { data: planData } = await supabase
            .from('plan_1201')
            .select('*')
            .eq('expediente_id', closedExp.id)
            .order('dia_desde_origen');

          if (planData) setPlan(planData as PlanBloque1201[]);

          const { data: actData } = await supabase
            .from('actuaciones_1201')
            .select('*')
            .eq('expediente_id', closedExp.id)
            .order('fecha_real', { ascending: false });

          if (actData) setActuaciones(actData as Actuacion1201[]);
        } else {
          setExpediente(null);
          setPlan([]);
          setActuaciones([]);
        }
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

  // Permissions: only admin can modify after 40 days
  const puedeEditar = useMemo(() => {
    if (!expediente) return false;
    if (expedienteCerrado) return isAdmin;
    if (deberiaCerrarseAuto) return isAdmin;
    return true; // Open and within 40 days
  }, [expediente, expedienteCerrado, deberiaCerrarseAuto, isAdmin]);

  const getBlockState = (bloque: PlanBloque1201): 'pendiente' | 'en_ventana' | 'vencida' | 'cumplida' | 'no_procede' => {
    if (bloque.estado === 'no_procede') return 'no_procede';
    if (bloque.actuacion_id) return 'cumplida';
    
    if (!bloque.fecha_objetivo) return 'pendiente';
    
    const fechaObjetivo = parseISO(bloque.fecha_objetivo);
    const now = new Date();
    
    // Window: 2 days before to 2 days after
    const iniciVentana = addDays(fechaObjetivo, -2);
    const finVentana = addDays(fechaObjetivo, 2);
    
    if (isAfter(now, finVentana)) return 'vencida';
    if (isAfter(now, iniciVentana) && isBefore(now, finVentana)) return 'en_ventana';
    return 'pendiente';
  };

  const resetForm = () => {
    setSelectedPlanId(null);
    setFechaActuacion(format(new Date(), 'yyyy-MM-dd'));
    setTipoAccion('entrevista');
    setDescripcion('');
    setResultado('');
    setObservaciones('');
    setEditingActuacion(null);
  };

  const handleRegistrar = async () => {
    if (!expediente || !fechaActuacion || !tipoAccion) return;

    setSaving(true);
    try {
      // Create actuacion
      const { data: actuacion, error: actError } = await supabase
        .from('actuaciones_1201')
        .insert({
          expediente_id: expediente.id,
          plan_id: selectedPlanId,
          fecha_real: fechaActuacion,
          tipo_accion: tipoAccion,
          descripcion: descripcion.trim() || null,
          resultado: resultado.trim() || null,
          observaciones: observaciones.trim() || null,
          registrado_por: user?.id,
        })
        .select()
        .single();

      if (actError) throw actError;

      // Update plan block if selected
      if (selectedPlanId) {
        const { error: planError } = await supabase
          .from('plan_1201')
          .update({
            actuacion_id: actuacion.id,
            estado: 'realizado',
          })
          .eq('id', selectedPlanId);

        if (planError) throw planError;
      }

      toast({
        title: 'Actuación registrada',
        description: 'Se ha guardado correctamente.',
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

    setSaving(true);
    try {
      const { error } = await supabase
        .from('actuaciones_1201')
        .update({
          fecha_real: fechaActuacion,
          tipo_accion: tipoAccion,
          descripcion: descripcion.trim() || null,
          resultado: resultado.trim() || null,
          observaciones: observaciones.trim() || null,
        })
        .eq('id', editingActuacion.id);

      if (error) throw error;

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

  const openEditModal = (actuacion: Actuacion1201) => {
    setEditingActuacion(actuacion);
    setFechaActuacion(actuacion.fecha_real || format(new Date(), 'yyyy-MM-dd'));
    setTipoAccion(actuacion.tipo_accion);
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

      toast({
        title: 'Expediente actualizado',
        description: 'Los cambios se han guardado correctamente.',
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
          <p className="text-muted-foreground">No hay expediente PE 12.01 abierto para este maquinista.</p>
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
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">
                Han pasado más de 40 días desde el primer servicio
              </p>
              <p className="text-xs text-amber-600 ml-2">
                Solo un administrador puede modificar este expediente.
              </p>
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

        <CardContent className="space-y-4">
          {/* Timeline de hitos */}
          <div className="border rounded-lg p-4">
            <h4 className="text-sm font-medium mb-3">Hitos obligatorios</h4>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {plan.map((bloque) => {
                const estado = getBlockState(bloque);
                const isEditable = puedeEditar && bloque.actuacion_id;
                const actuacion = actuaciones.find(a => a.id === bloque.actuacion_id);
                
                return (
                  <div 
                    key={bloque.id} 
                    className={`min-w-[120px] p-3 rounded-lg text-center ${
                      estado === 'cumplida' ? 'bg-status-cumplida-bg border border-status-ok' :
                      estado === 'no_procede' ? 'bg-muted/50 border border-muted-foreground/30' :
                      estado === 'en_ventana' ? 'bg-status-proximo-bg border border-status-proximo' :
                      estado === 'vencida' ? 'bg-status-vencido-bg border border-status-vencido' :
                      'bg-muted border border-border'
                    } ${isEditable ? 'cursor-pointer hover:opacity-80' : ''}`}
                    onClick={() => actuacion && isEditable && openEditModal(actuacion)}
                  >
                    <p className="font-medium text-sm">{bloque.etiqueta}</p>
                    {bloque.fecha_objetivo && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(bloque.fecha_objetivo), 'dd/MM/yyyy')}
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
                      ) : estado === 'en_ventana' ? (
                        <Clock className="w-4 h-4 text-status-proximo" />
                      ) : (
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    {/* Mark as no procede */}
                    {puedeEditar && !bloque.actuacion_id && bloque.estado !== 'no_procede' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 text-xs h-6 px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarcarNoProcede(bloque.id);
                        }}
                      >
                        No procede
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Leyenda */}
            <div className="flex items-center gap-4 text-xs mt-4 pt-3 border-t">
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
          </div>

          {/* Actuaciones list */}
          {actuaciones.length > 0 && (
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-medium mb-3">Actuaciones registradas</h4>
              <div className="space-y-2">
                {actuaciones.map((act) => (
                  <div 
                    key={act.id} 
                    className={`flex items-center justify-between p-3 rounded-lg bg-muted/30 ${puedeEditar ? 'cursor-pointer hover:bg-muted/50' : ''}`}
                    onClick={() => puedeEditar && openEditModal(act)}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {tiposAccion.find(t => t.value === act.tipo_accion)?.label || act.tipo_accion}
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
              Selecciona un hito obligatorio o registra una actuación ad-hoc.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Hito asociado (opcional) */}
            <div className="space-y-2">
              <Label>Hito asociado (opcional)</Label>
              <Select value={selectedPlanId || 'none'} onValueChange={(v) => setSelectedPlanId(v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin hito (actuación ad-hoc)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin hito (actuación ad-hoc)</SelectItem>
                  {plan.filter(b => !b.actuacion_id && b.estado !== 'no_procede').map(bloque => (
                    <SelectItem key={bloque.id} value={bloque.id}>
                      {bloque.etiqueta} - {bloque.fecha_objetivo ? format(parseISO(bloque.fecha_objetivo), 'dd/MM/yyyy') : 'Sin fecha'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha */}
            <div className="space-y-2">
              <Label>Fecha de la actuación *</Label>
              <Input
                type="date"
                value={fechaActuacion}
                onChange={(e) => setFechaActuacion(e.target.value)}
              />
            </div>

            {/* Tipo de acción */}
            <div className="space-y-2">
              <Label>Tipo de acción *</Label>
              <Select value={tipoAccion} onValueChange={setTipoAccion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposAccion.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

            {/* Resultado */}
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Input
                placeholder="Resultado de la actuación..."
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
              />
            </div>

            {/* Observaciones */}
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
            <Button onClick={handleRegistrar} disabled={saving || !fechaActuacion}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar Actuación */}
      <Dialog open={editarOpen} onOpenChange={setEditarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Actuación</DialogTitle>
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

            <div className="space-y-2">
              <Label>Tipo de acción *</Label>
              <Select value={tipoAccion} onValueChange={setTipoAccion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposAccion.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
            <Button variant="outline" onClick={() => setEditarOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleEditar} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Cierre */}
      <Dialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Expediente PE 12.01</DialogTitle>
            <DialogDescription>
              ¿Confirmas el cierre manual del expediente? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
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
