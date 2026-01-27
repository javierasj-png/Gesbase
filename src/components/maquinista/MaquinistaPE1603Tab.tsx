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
  AlertCircle
} from 'lucide-react';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Expediente1603Detail, 
  PlanBloque1603, 
  TipoActuacion1603 
} from '@/hooks/useMaquinistaDetail';

interface MaquinistaPE1603TabProps {
  maquinista: {
    id: string;
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
  const [saving, setSaving] = useState(false);
  
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

  // Check if selected type has pending blocks
  const tipoTienePendientes = selectedTipo 
    ? bloquesPendientesPorTipo[selectedTipo].length > 0 
    : false;

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

  // Check if there are any pending blocks at all
  const hayBloquesPendientes = Object.values(bloquesPendientesPorTipo).some(arr => arr.length > 0);

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
      <div>
        <h2 className="text-lg font-semibold">PE 16.03 - Nuevo Acceso</h2>
        <p className="text-sm text-muted-foreground">
          Vigilancia durante 3 años desde primer servicio. 
          El expediente se genera automáticamente al dar de alta al maquinista.
        </p>
      </div>

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

          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => setRegistrarOpen(true)}
            disabled={!hayBloquesPendientes}
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Actuación
          </Button>
          {!hayBloquesPendientes && (
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
    </div>
  );
}
