import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, CheckCircle2, XCircle, AlertCircle, Loader2, Pencil, Trash2,
  ClipboardList, Users, ShieldAlert, Calendar,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePlanAnual, TipoActuacionPlanAnual, RedType, ActuacionPlanAnual } from '@/hooks/usePlanAnual';
import { Progress } from '@/components/ui/progress';

interface MaquinistaPlanAnualTabProps {
  maquinistaId: string;
  maquinistaNombre: string;
  baseName: string;
}

const tipoLabels: Record<TipoActuacionPlanAnual, string> = {
  'registro': 'Registro',
  'acompanamiento': 'Acompañamiento',
  'alcohol': 'Alcohol',
  'drogas': 'Drogas',
};

const redLabels: Record<RedType, string> = {
  'convencional': 'Convencional',
  'av': 'Alta Velocidad',
};

export function MaquinistaPlanAnualTab({ maquinistaId, maquinistaNombre, baseName }: MaquinistaPlanAnualTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const planAnual = usePlanAnual(maquinistaId, baseName);

  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingActuacion, setEditingActuacion] = useState<ActuacionPlanAnual | null>(null);

  // Form state
  const [selectedTipo, setSelectedTipo] = useState<TipoActuacionPlanAnual | ''>('');
  const [selectedRed, setSelectedRed] = useState<RedType | ''>('');
  const [fechaActuacion, setFechaActuacion] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [kmRecorridos, setKmRecorridos] = useState('');
  const [indicePrever, setIndicePrever] = useState('');
  const [resultado, setResultado] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const resetForm = () => {
    setSelectedTipo('');
    setSelectedRed('');
    setFechaActuacion(format(new Date(), 'yyyy-MM-dd'));
    setKmRecorridos('');
    setIndicePrever('');
    setResultado('');
    setObservaciones('');
  };

  const needsRed = selectedTipo === 'registro' || selectedTipo === 'acompanamiento';
  const needsKm = selectedTipo === 'registro';
  const needsResultado = selectedTipo === 'alcohol' || selectedTipo === 'drogas';

  const handleRegistrar = async () => {
    if (!selectedTipo || !fechaActuacion) return;
    if (needsRed && !selectedRed) return;

    setSaving(true);
    try {
      const km = kmRecorridos ? parseFloat(kmRecorridos.replace(',', '.')) : null;
      const prever = indicePrever ? parseFloat(indicePrever.replace(',', '.')) : null;

      if (needsKm && km !== null && km < 100) {
        toast({ title: 'Km insuficientes', description: 'El mínimo requerido es 100 km.', variant: 'destructive' });
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('actuaciones_plan_anual')
        .insert({
          maquinista_id: maquinistaId,
          anio: planAnual.anio,
          tipo: selectedTipo,
          red: needsRed ? selectedRed : null,
          fecha_real: fechaActuacion,
          km_recorridos: km,
          indice_prever: prever,
          resultado: needsResultado ? resultado || null : null,
          observaciones: observaciones || null,
          registrado_por: user?.id ?? null,
        });

      if (error) throw error;

      toast({ title: 'Actuación registrada', description: `${tipoLabels[selectedTipo]} registrada en el Plan de Acción Anual` });
      resetForm();
      setRegistrarOpen(false);
      planAnual.refetch();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo registrar la actuación', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (actuacion: ActuacionPlanAnual) => {
    if (actuacion.source === 'pe1603') {
      toast({ title: 'Info', description: 'Esta actuación procede de PE 16.03. Edítala desde la pestaña PE 16.03.' });
      return;
    }
    setEditingActuacion(actuacion);
    setSelectedTipo(actuacion.tipo);
    setSelectedRed(actuacion.red || '');
    setFechaActuacion(actuacion.fecha_real);
    setKmRecorridos(actuacion.km_recorridos?.toString() || '');
    setIndicePrever(actuacion.indice_prever?.toString() || '');
    setResultado(actuacion.resultado || '');
    setObservaciones(actuacion.observaciones || '');
    setEditarOpen(true);
  };

  const handleEditar = async () => {
    if (!editingActuacion || !fechaActuacion) return;

    setSaving(true);
    try {
      const km = kmRecorridos ? parseFloat(kmRecorridos.replace(',', '.')) : null;
      const prever = indicePrever ? parseFloat(indicePrever.replace(',', '.')) : null;

      const { error } = await supabase
        .from('actuaciones_plan_anual')
        .update({
          fecha_real: fechaActuacion,
          red: needsRed ? selectedRed || null : null,
          km_recorridos: km,
          indice_prever: prever,
          resultado: needsResultado ? resultado || null : null,
          observaciones: observaciones || null,
        })
        .eq('id', editingActuacion.id);

      if (error) throw error;

      toast({ title: 'Actuación actualizada' });
      setEditingActuacion(null);
      resetForm();
      setEditarOpen(false);
      planAnual.refetch();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEliminar = async () => {
    if (!editingActuacion) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('actuaciones_plan_anual')
        .delete()
        .eq('id', editingActuacion.id);

      if (error) throw error;

      toast({ title: 'Actuación eliminada' });
      setEditingActuacion(null);
      resetForm();
      setEditarOpen(false);
      planAnual.refetch();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (planAnual.loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (planAnual.error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-muted-foreground">{planAnual.error}</p>
        </CardContent>
      </Card>
    );
  }

  const criteriosCumplidos = planAnual.criterios.filter(c => c.cumple).length;
  const totalCriterios = planAnual.criterios.length;
  const porcentajeCumplimiento = totalCriterios > 0 ? Math.round((criteriosCumplidos / totalCriterios) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Plan de Acción Anual {planAnual.anio}
              </CardTitle>
              <CardDescription>
                Criterios individuales de vigilancia — {maquinistaNombre}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={porcentajeCumplimiento === 100 ? 'default' : porcentajeCumplimiento >= 50 ? 'secondary' : 'destructive'}>
                {criteriosCumplidos}/{totalCriterios} criterios
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cumplimiento individual</span>
              <span className="font-medium">{porcentajeCumplimiento}%</span>
            </div>
            <Progress value={porcentajeCumplimiento} className="h-2" />
          </div>

          {planAnual.tuvo1201Reciente && (
            <div className="mt-4 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
              <div className="flex items-center gap-2 text-sm">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  PE 12.01 en los últimos 3 años — Se requieren 2 acompañamientos por red
                </span>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground">
            Redes de la base: {planAnual.redes.map(r => redLabels[r]).join(', ')}
          </div>
        </CardContent>
      </Card>

      {/* Criterios checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criterios de vigilancia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {planAnual.criterios.map((criterio, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg border ${
                criterio.cumple
                  ? 'bg-status-cumplida-bg border-status-ok'
                  : 'bg-status-vencido-bg border-status-vencido'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {criterio.cumple ? (
                    <CheckCircle2 className="w-5 h-5 text-status-ok" />
                  ) : (
                    <XCircle className="w-5 h-5 text-status-vencido" />
                  )}
                  <span className="font-medium text-sm">{criterio.criterio}</span>
                </div>
                <div className="flex items-center gap-2">
                  {criterio.requerido > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {criterio.cumplido}/{criterio.requerido}
                    </Badge>
                  )}
                  {criterio.tipo === 'drogas' && criterio.cumplido > 0 && (
                    <Badge variant="outline" className="text-xs bg-status-cumplida-bg">
                      ✓ Incluido
                    </Badge>
                  )}
                </div>
              </div>
              {/* Show linked actuaciones */}
              {criterio.actuaciones.length > 0 && (
                <div className="mt-2 space-y-1 pl-7">
                  {criterio.actuaciones.map(a => (
                    <div key={a.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>{format(parseISO(a.fecha_real), 'dd/MM/yyyy')}</span>
                      {a.km_recorridos !== null && <span>— {a.km_recorridos} km</span>}
                      {a.indice_prever !== null && <span>— PREVER {a.indice_prever}</span>}
                      {a.resultado && <span>— {a.resultado}</span>}
                      {a.source === 'pe1603' && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">PE 16.03</Badge>
                      )}
                      {a.source === 'plan_anual' && (
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openEditModal(a)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Drug coverage card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Cobertura de Drogas — Base {baseName}
          </CardTitle>
          <CardDescription>Objetivo: 25% de la plantilla activa con control de drogas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {planAnual.coberturaDrogas.conControl} de {planAnual.coberturaDrogas.totalActivos} maquinistas
              </span>
              <span className="font-medium">{planAnual.coberturaDrogas.porcentaje}%</span>
            </div>
            <Progress value={planAnual.coberturaDrogas.porcentaje} className="h-2" />
            <div className="flex items-center gap-2">
              {planAnual.coberturaDrogas.cumple ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-status-ok" />
                  <span className="text-sm text-status-ok font-medium">Objetivo de cobertura cumplido</span>
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 text-status-vencido" />
                  <span className="text-sm text-status-vencido font-medium">
                    Faltan {Math.ceil(planAnual.coberturaDrogas.totalActivos * 0.25) - planAnual.coberturaDrogas.conControl} controles para alcanzar el 25%
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actuaciones registradas */}
      {planAnual.actuaciones.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actuaciones registradas ({planAnual.anio})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {planAnual.actuaciones.map(a => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{tipoLabels[a.tipo]}</span>
                    {a.red && (
                      <Badge variant="outline" className="text-xs">{redLabels[a.red]}</Badge>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <span>{format(parseISO(a.fecha_real), 'dd/MM/yyyy')}</span>
                    {a.km_recorridos !== null && <span>• {a.km_recorridos} km</span>}
                    {a.indice_prever !== null && <span>• PREVER {a.indice_prever}</span>}
                    {a.resultado && <span>• {a.resultado}</span>}
                    {a.source === 'pe1603' && (
                      <Badge variant="secondary" className="text-[10px]">PE 16.03</Badge>
                    )}
                  </div>
                  {a.observaciones && (
                    <p className="text-xs text-muted-foreground mt-1">{a.observaciones}</p>
                  )}
                </div>
                {a.source === 'plan_anual' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEditModal(a)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}


      {/* Modal Registrar */}
      <Dialog open={registrarOpen} onOpenChange={setRegistrarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-primary" />
              Registrar Actuación — Plan Anual
            </DialogTitle>
            <DialogDescription>
              Registra una actuación de vigilancia para el Plan de Acción Anual {planAnual.anio}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Input type="date" value={fechaActuacion} onChange={e => setFechaActuacion(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de actuación *</Label>
              <Select value={selectedTipo} onValueChange={v => setSelectedTipo(v as TipoActuacionPlanAnual)}>
                <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                <SelectContent>
                  {(['registro', 'acompanamiento', 'alcohol', 'drogas'] as TipoActuacionPlanAnual[]).map(t => (
                    <SelectItem key={t} value={t}>{tipoLabels[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {needsRed && (
              <div className="space-y-2">
                <Label>Red *</Label>
                <Select value={selectedRed} onValueChange={v => setSelectedRed(v as RedType)}>
                  <SelectTrigger><SelectValue placeholder="Selecciona red" /></SelectTrigger>
                  <SelectContent>
                    {planAnual.redes.map(r => (
                      <SelectItem key={r} value={r}>{redLabels[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {needsKm && (
              <div className="space-y-2">
                <Label>Km recorridos <span className="text-muted-foreground font-normal">(mínimo 100)</span></Label>
                <Input type="text" value={kmRecorridos} onChange={e => setKmRecorridos(e.target.value)} placeholder="Ej: 150" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Índice PREVER <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input type="text" value={indicePrever} onChange={e => setIndicePrever(e.target.value)} placeholder="Ej: 4.5" />
            </div>
            {needsResultado && (
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select value={resultado} onValueChange={setResultado}>
                  <SelectTrigger><SelectValue placeholder="Selecciona resultado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Negativo">Negativo</SelectItem>
                    <SelectItem value="Positivo">Positivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegistrarOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              onClick={handleRegistrar}
              disabled={saving || !selectedTipo || !fechaActuacion || (needsRed && !selectedRed)}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={editarOpen} onOpenChange={open => { setEditarOpen(open); if (!open) setEditingActuacion(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Editar Actuación
            </DialogTitle>
            <DialogDescription>Modifica los datos de la actuación registrada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Input value={selectedTipo ? tipoLabels[selectedTipo] : ''} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={fechaActuacion} onChange={e => setFechaActuacion(e.target.value)}
                max={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            {needsRed && (
              <div className="space-y-2">
                <Label>Red</Label>
                <Select value={selectedRed} onValueChange={v => setSelectedRed(v as RedType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {planAnual.redes.map(r => (
                      <SelectItem key={r} value={r}>{redLabels[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {needsKm && (
              <div className="space-y-2">
                <Label>Km recorridos</Label>
                <Input type="text" value={kmRecorridos} onChange={e => setKmRecorridos(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Índice PREVER</Label>
              <Input type="text" value={indicePrever} onChange={e => setIndicePrever(e.target.value)} />
            </div>
            {needsResultado && (
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select value={resultado} onValueChange={setResultado}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Negativo">Negativo</SelectItem>
                    <SelectItem value="Positivo">Positivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={saving}>
                  <Trash2 className="w-4 h-4 mr-2" />Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar actuación?</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEliminar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditarOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleEditar} disabled={saving || !fechaActuacion}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Guardar Cambios
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
