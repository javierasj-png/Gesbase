import { useState } from 'react';
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
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
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
  const [selectedBloque, setSelectedBloque] = useState<string>('');
  const [fechaActuacion, setFechaActuacion] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [resultado, setResultado] = useState<string>('');
  const [observaciones, setObservaciones] = useState('');

  // Get blocks that are "En ventana" or "Vencida" (pending to complete)
  const bloquesPendientes = plan1603.filter(
    b => b.estadoCalculado === 'En ventana' || b.estadoCalculado === 'Vencida'
  );

  const handleRegistrar = async () => {
    if (!selectedBloque || !fechaActuacion || !expediente1603) return;

    const bloque = plan1603.find(b => b.id === selectedBloque);
    if (!bloque) return;

    setSaving(true);
    try {
      // 1. Create actuacion
      const { data: actuacion, error: actError } = await supabase
        .from('actuaciones_1603')
        .insert({
          expediente_id: expediente1603.id,
          tipo: bloque.tipo,
          fecha_real: fechaActuacion,
          resultado: resultado || null,
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
          estado: 'Cumplida',
        })
        .eq('id', selectedBloque);

      if (planError) throw planError;

      toast({
        title: 'Actuación registrada',
        description: `${bloque.tipo} - ${bloque.etiqueta} marcada como cumplida`,
      });

      // Reset form and close
      setSelectedBloque('');
      setFechaActuacion(format(new Date(), 'yyyy-MM-dd'));
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
            disabled={bloquesPendientes.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Actuación
          </Button>
          {bloquesPendientes.length === 0 && (
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
              Registra una actuación del plan PE 16.03 para marcarla como cumplida
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Select bloque */}
            <div className="space-y-2">
              <Label>Bloque a registrar</Label>
              <Select value={selectedBloque} onValueChange={setSelectedBloque}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un bloque" />
                </SelectTrigger>
                <SelectContent>
                  {bloquesPendientes.length > 0 ? (
                    bloquesPendientes.map(bloque => (
                      <SelectItem key={bloque.id} value={bloque.id}>
                        <span className={
                          bloque.estadoCalculado === 'Vencida' 
                            ? 'text-destructive' 
                            : bloque.estadoCalculado === 'En ventana'
                              ? 'text-status-proximo'
                              : ''
                        }>
                          [{bloque.tipo}] {bloque.etiqueta}
                          {bloque.estadoCalculado === 'Vencida' && ' (Vencida)'}
                          {bloque.estadoCalculado === 'En ventana' && ' (En ventana)'}
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__empty__" disabled>
                      No hay bloques pendientes
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Solo bloques en ventana o vencidos
              </p>
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

            {/* Resultado (para Alcohol/Drogas) */}
            {selectedBloque && (() => {
              const bloque = plan1603.find(b => b.id === selectedBloque);
              if (bloque && (bloque.tipo === 'Alcohol' || bloque.tipo === 'Drogas')) {
                return (
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
                );
              }
              return null;
            })()}

            {/* Observaciones */}
            <div className="space-y-2">
              <Label>Observaciones (opcional)</Label>
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
              disabled={saving || !selectedBloque || !fechaActuacion}
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
