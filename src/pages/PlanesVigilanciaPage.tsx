import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Loader2, Archive, Trash2, ShieldCheck, Megaphone, UserCheck, Pencil, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBaseFilter } from '@/hooks/useBaseFilter';
import { useGlobalBaseFilter } from '@/hooks/useGlobalBaseFilter';
import {
  usePlanesVigilancia,
  useTiposAccionVigilancia,
  type PlanVigilanciaConProgreso,
} from '@/hooks/usePlanesVigilancia';
import { NuevoPlanWizard } from '@/components/vigilancia/NuevoPlanWizard';
import { PlanVigilanciaDetalle } from '@/components/vigilancia/PlanVigilanciaDetalle';
import { generatePlanVigilanciaMemoriaPDF } from '@/utils/generatePlanVigilanciaMemoriaPDF';
import { format, parseISO } from 'date-fns';


const ESTADO_LABEL: Record<string, string> = {
  propuesta: 'Propuesta',
  validado: 'Validado',
  completado: 'Completado',
  archivado: 'Archivado',
};

const ESTADO_CLASS: Record<string, string> = {
  propuesta: 'bg-amber-100 text-amber-900 border-amber-300',
  validado: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  completado: 'bg-sky-100 text-sky-900 border-sky-300',
  archivado: 'bg-muted text-muted-foreground border-border',
};

export default function PlanesVigilanciaPage() {
  usePageMeta({
    title: 'Planes Específicos — Gestión de Base',
    description: 'Planes específicos de vigilancia y campañas o sondeos: creación, seguimiento y archivo.',
    path: '/planes-vigilancia',
  });
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const { getAccessibleBases } = useBaseFilter();
  const { tipos } = useTiposAccionVigilancia();
  const { planes, loading, refetch } = usePlanesVigilancia();

  const [categoriaTab, setCategoriaTab] = useState<'todos' | 'especifico' | 'campania'>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [baseFilter, setBaseFilter] = useGlobalBaseFilter();
  const [estadoFilter, setEstadoFilter] = useState('activos');
  const [tipoFilter, setTipoFilter] = useState('all');
  const [anioFilter, setAnioFilter] = useState('all');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [detalle, setDetalle] = useState<PlanVigilanciaConProgreso | null>(null);
  const [confirmar, setConfirmar] = useState<{ plan: PlanVigilanciaConProgreso; accion: 'archivar' | 'eliminar' } | null>(null);
  const [editar, setEditar] = useState<PlanVigilanciaConProgreso | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editDescripcion, setEditDescripcion] = useState('');
  const [editInicio, setEditInicio] = useState('');
  const [editFin, setEditFin] = useState('');
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [memoriaId, setMemoriaId] = useState<string | null>(null);

  const descargarMemoria = async (plan: PlanVigilanciaConProgreso) => {
    setMemoriaId(plan.id);
    try {
      await generatePlanVigilanciaMemoriaPDF(plan.id);
      toast({ title: 'Memoria generada' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error al generar la memoria', description: e.message });
    } finally {
      setMemoriaId(null);
    }
  };



  const abrirEdicion = (plan: PlanVigilanciaConProgreso) => {
    setEditar(plan);
    setEditNombre(plan.nombre);
    setEditDescripcion(plan.descripcion || '');
    setEditInicio(plan.fecha_inicio);
    setEditFin(plan.fecha_fin);
  };

  const guardarEdicion = async () => {
    if (!editar || !editNombre.trim()) return;
    if (!editInicio || !editFin || editFin < editInicio) {
      toast({ variant: 'destructive', title: 'Periodo no válido', description: 'La fecha de fin debe ser posterior al inicio.' });
      return;
    }
    setGuardandoEdicion(true);
    try {
      const { error } = await supabase
        .from('planes_vigilancia')
        .update({
          nombre: editNombre.trim(),
          descripcion: editDescripcion.trim() || null,
          fecha_inicio: editInicio,
          fecha_fin: editFin,
        } as any)
        .eq('id', editar.id);
      if (error) throw error;
      toast({ title: 'Plan actualizado' });
      setEditar(null);
      refetch();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el plan.' });
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const anios = useMemo(() => {
    const set = new Set<string>();
    planes.forEach((p) => {
      set.add(p.fecha_inicio.slice(0, 4));
      set.add(p.fecha_fin.slice(0, 4));
    });
    return Array.from(set).sort().reverse();
  }, [planes]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return planes.filter((p) => {
      if (categoriaTab !== 'todos' && p.categoria !== categoriaTab) return false;
      if (baseFilter !== 'all' && p.base !== baseFilter) return false;
      if (estadoFilter === 'activos' && p.estado === 'archivado') return false;
      if (estadoFilter !== 'activos' && estadoFilter !== 'all' && p.estado !== estadoFilter) return false;
      if (tipoFilter !== 'all' && !p.tipos.includes(tipoFilter)) return false;
      if (anioFilter !== 'all' && !(p.fecha_inicio.startsWith(anioFilter) || p.fecha_fin.startsWith(anioFilter))) return false;
      if (q && !p.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [planes, categoriaTab, baseFilter, estadoFilter, tipoFilter, anioFilter, busqueda]);

  const nombreTipo = (id: string) => tipos.find((t) => t.id === id)?.nombre ?? id;

  const ejecutarConfirmacion = async () => {
    if (!confirmar) return;
    const { plan, accion } = confirmar;
    try {
      if (accion === 'archivar') {
        const { error } = await supabase
          .from('planes_vigilancia')
          .update({ estado: 'archivado', archived_at: new Date().toISOString() })
          .eq('id', plan.id);
        if (error) throw error;
        toast({ title: 'Plan archivado' });
      } else {
        await supabase.from('planes_vigilancia_acciones').delete().eq('plan_id', plan.id);
        const { error } = await supabase.from('planes_vigilancia').delete().eq('id', plan.id);
        if (error) throw error;
        toast({ title: 'Plan eliminado' });
      }
      refetch();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la acción.' });
    } finally {
      setConfirmar(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary" />
              Planes Específicos
            </h1>
            <p className="text-sm text-muted-foreground">
              Planes específicos nominales y campañas o sondeos muestrales sobre la base.
            </p>
          </div>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nuevo plan
          </Button>
        </div>

        <Tabs value={categoriaTab} onValueChange={(v) => setCategoriaTab(v as typeof categoriaTab)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="especifico">Planes específicos</TabsTrigger>
            <TabsTrigger value="campania">Campañas y sondeos</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <Select value={baseFilter} onValueChange={setBaseFilter}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las bases</SelectItem>
              {getAccessibleBases.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estadoFilter} onValueChange={setEstadoFilter}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activos">Activos (sin archivar)</SelectItem>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={anioFilter} onValueChange={setAnioFilter}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los años</SelectItem>
              {anios.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando planes...
          </div>
        ) : filtrados.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No hay planes que coincidan con los filtros. Crea uno con «Nuevo plan».
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={
                        p.categoria === 'especifico'
                          ? 'bg-primary/10 text-primary border-primary/30'
                          : 'bg-orange-100 text-orange-900 border-orange-300'
                      }
                    >
                      {p.categoria === 'especifico' ? (
                        <UserCheck className="w-3 h-3 mr-1" />
                      ) : (
                        <Megaphone className="w-3 h-3 mr-1" />
                      )}
                      {p.categoria === 'especifico' ? 'Plan específico' : 'Campaña / sondeo'}
                    </Badge>
                    {(() => {
                      const estadoVisual =
                        p.estado !== 'archivado' && p.totalAcciones > 0 && p.progreso >= 100
                          ? 'completado'
                          : p.estado;
                      return (
                        <Badge variant="outline" className={ESTADO_CLASS[estadoVisual]}>
                          {ESTADO_LABEL[estadoVisual]}
                        </Badge>
                      );
                    })()}
                  </div>

                  <div className="cursor-pointer" onClick={() => setDetalle(p)}>
                    <p className="font-medium text-sm hover:underline">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">{p.base}</p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {p.tipos.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[11px]">{nombreTipo(t)}</Badge>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(p.fecha_inicio), 'dd/MM/yyyy')} – {format(parseISO(p.fecha_fin), 'dd/MM/yyyy')} ·{' '}
                    {p.maquinistas} maquinistas ·{' '}
                    {p.modo_alcance === 'porcentaje' ? `${p.porcentaje}% de la base` : p.modo_alcance === 'todos' ? 'Toda la base' : 'Nominal'}
                  </p>

                  <div className="space-y-1 mt-auto">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progreso</span>
                      <span>{p.accionesRealizadas}/{p.totalAcciones} ({p.progreso}%)</span>
                    </div>
                    <Progress value={p.progreso} className="h-1.5" />
                  </div>

                  <div className="flex gap-1 pt-1">
                    {p.estado === 'archivado' ? (
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={memoriaId === p.id}
                        onClick={() => descargarMemoria(p)}
                      >
                        {memoriaId === p.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 mr-1" />
                        )}
                        Memoria PDF
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setDetalle(p)}>
                          Gestionar
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => abrirEdicion(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setConfirmar({ plan: p, accion: 'archivar' })}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}

                    {(
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-destructive"
                        onClick={() => setConfirmar({ plan: p, accion: 'eliminar' })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editar} onOpenChange={(v) => !v && setEditar(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar plan</DialogTitle>
            <DialogDescription>Modifica el nombre, la descripción o el periodo del plan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea rows={3} value={editDescripcion} onChange={(e) => setEditDescripcion(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Inicio del periodo</Label>
                <Input type="date" value={editInicio} onChange={(e) => setEditInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin del periodo</Label>
                <Input type="date" value={editFin} onChange={(e) => setEditFin(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditar(null)}>Cancelar</Button>
            <Button onClick={guardarEdicion} disabled={guardandoEdicion || !editNombre.trim()}>
              {guardandoEdicion && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NuevoPlanWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        bases={getAccessibleBases}
        onCreated={refetch}
      />

      <PlanVigilanciaDetalle
        plan={detalle}
        open={!!detalle}
        onOpenChange={(o) => !o && setDetalle(null)}
        onChanged={refetch}
      />

      <AlertDialog open={!!confirmar} onOpenChange={(o) => !o && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar?.accion === 'archivar' ? '¿Archivar plan?' : '¿Eliminar plan?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.accion === 'archivar'
                ? 'El plan pasará al histórico y dejará de mostrarse en la vista principal.'
                : 'Se eliminará el plan y todas sus acciones previstas. Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={ejecutarConfirmacion}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
