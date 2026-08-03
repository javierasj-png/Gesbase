import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useTiposAccionVigilancia,
  type CategoriaPlan,
  type DistribucionPlan,
  type ModoAlcance,
} from '@/hooks/usePlanesVigilancia';
import { Loader2, Search, Shuffle, Users, UserCheck, Megaphone } from 'lucide-react';

interface MaquinistaLite {
  id: string;
  matricula: string;
  nombre: string;
  apellidos: string;
  base: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bases: string[];
  onCreated: () => void;
}

const PASOS = ['Categoría', 'Acciones', 'Alcance', 'Periodo'];

export function NuevoPlanWizard({ open, onOpenChange, bases, onCreated }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tipos } = useTiposAccionVigilancia();

  const [paso, setPaso] = useState(0);
  const [saving, setSaving] = useState(false);

  // Paso 1
  const [categoria, setCategoria] = useState<CategoriaPlan | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [responsable, setResponsable] = useState('');
  const [base, setBase] = useState<string>('');

  // Paso 2
  const [seleccionTipos, setSeleccionTipos] = useState<Record<string, number>>({});
  const [tipoLibre, setTipoLibre] = useState('');

  // Paso 3
  const [modo, setModo] = useState<ModoAlcance>('concretos');
  const [porcentaje, setPorcentaje] = useState(25);
  const [maquinistas, setMaquinistas] = useState<MaquinistaLite[]>([]);
  const [seleccionados, setSeleccionados] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState('');

  // Paso 4
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [distribucion, setDistribucion] = useState<DistribucionPlan>('uniforme');

  const reset = () => {
    setPaso(0);
    setCategoria(null);
    setNombre('');
    setDescripcion('');
    setResponsable('');
    setBase(bases[0] || '');
    setSeleccionTipos({});
    setTipoLibre('');
    setModo('concretos');
    setPorcentaje(25);
    setSeleccionados([]);
    setBusqueda('');
    setFechaInicio('');
    setFechaFin('');
    setDistribucion('uniforme');
  };

  useEffect(() => {
    if (open) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!base) return;
    (async () => {
      const { data } = await supabase
        .from('maquinistas')
        .select('id, matricula, nombre, apellidos, base')
        .eq('base', base)
        .eq('activo', true);
      const list = ((data as MaquinistaLite[]) || []).sort((a, b) =>
        `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es')
      );
      setMaquinistas(list);
      setSeleccionados([]);
    })();
  }, [base]);

  // Defaults según categoría
  const elegirCategoria = (c: CategoriaPlan) => {
    setCategoria(c);
    setModo(c === 'especifico' ? 'concretos' : 'porcentaje');
  };

  const sortear = () => {
    const n = Math.max(1, Math.round((maquinistas.length * porcentaje) / 100));
    const pool = [...maquinistas];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setSeleccionados(pool.slice(0, n).map((m) => m.id));
  };

  useEffect(() => {
    if (modo === 'todos') setSeleccionados(maquinistas.map((m) => m.id));
    if (modo === 'porcentaje' && maquinistas.length) sortear();
    if (modo === 'concretos') setSeleccionados([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, maquinistas]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    if (!q) return maquinistas;
    return maquinistas.filter((m) =>
      `${m.apellidos} ${m.nombre} ${m.matricula}`.toLowerCase().includes(q)
    );
  }, [maquinistas, busqueda]);

  const tiposElegidos = Object.entries(seleccionTipos).filter(([, n]) => n > 0);

  const puedeAvanzar = () => {
    if (paso === 0) return !!categoria && nombre.trim().length > 0 && !!base;
    if (paso === 1) return tiposElegidos.length > 0;
    if (paso === 2) return seleccionados.length > 0;
    if (paso === 3) return !!fechaInicio && !!fechaFin && fechaFin >= fechaInicio;
    return false;
  };

  const guardarBorrador = async () => {
    if (!puedeAvanzar()) return;
    setSaving(true);
    try {
      const { data: plan, error } = await supabase
        .from('planes_vigilancia')
        .insert({
          categoria: categoria!,
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          responsable: responsable.trim() || null,
          base,
          modo_alcance: modo,
          porcentaje: modo === 'porcentaje' ? porcentaje : null,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          distribucion,
          estado: 'propuesta',
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Guardar el alcance y los tipos elegidos como acciones base de la propuesta
      const filas: {
        plan_id: string;
        maquinista_id: string;
        tipo_accion: string;
        tipo_accion_libre: string | null;
        fecha_prevista: string;
        created_by: string | null;
      }[] = [];
      for (const mid of seleccionados) {
        for (const [tipo, reps] of tiposElegidos) {
          for (let i = 0; i < reps; i++) {
            filas.push({
              plan_id: plan!.id,
              maquinista_id: mid,
              tipo_accion: tipo,
              tipo_accion_libre: tipo === 'otros' ? tipoLibre.trim() || null : null,
              fecha_prevista: fechaInicio,
              created_by: user?.id ?? null,
            });
          }
        }
      }
      if (filas.length) {
        const { error: accError } = await supabase.from('planes_vigilancia_acciones').insert(filas);
        if (accError) throw accError;
      }

      toast({ title: 'Borrador guardado', description: `Plan "${nombre}" creado con ${filas.length} acciones previstas.` });
      onOpenChange(false);
      onCreated();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el plan.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo plan de vigilancia</DialogTitle>
          <DialogDescription>
            Paso {paso + 1} de {PASOS.length} — {PASOS[paso]}
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-2">
          {PASOS.map((p, i) => (
            <div key={p} className="flex-1">
              <div
                className={cn(
                  'h-1.5 rounded-full',
                  i <= paso ? 'bg-primary' : 'bg-muted'
                )}
              />
              <p className={cn('text-[11px] mt-1', i === paso ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                {p}
              </p>
            </div>
          ))}
        </div>

        {/* Paso 1 */}
        {paso === 0 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Card
                onClick={() => elegirCategoria('especifico')}
                className={cn(
                  'cursor-pointer transition-colors',
                  categoria === 'especifico' ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                )}
              >
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    <p className="font-medium text-sm">Plan específico de vigilancia</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Nominal e individual: maquinistas concretos (vigilancia reforzada, reincorporaciones, noveles).
                  </p>
                </CardContent>
              </Card>
              <Card
                onClick={() => elegirCategoria('campania')}
                className={cn(
                  'cursor-pointer transition-colors',
                  categoria === 'campania' ? 'border-primary ring-1 ring-primary' : 'hover:border-primary/50'
                )}
              >
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-primary" />
                    <p className="font-medium text-sm">Campaña de vigilancia / sondeo</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Colectiva y muestral: un % de la base o toda la base (uniformidad, documentación, alcohol y drogas).
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nombre del plan *</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Campaña de uniformidad 2026" />
              </div>
              <div className="space-y-1.5">
                <Label>Base *</Label>
                <Select value={base} onValueChange={setBase}>
                  <SelectTrigger><SelectValue placeholder="Selecciona base" /></SelectTrigger>
                  <SelectContent>
                    {bases.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descripción / motivo</Label>
                <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Responsable</Label>
                <Input value={responsable} onChange={(e) => setResponsable(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Paso 2 */}
        {paso === 1 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Selecciona los tipos de acción y el número de repeticiones por maquinista.
            </p>
            {tipos.map((t) => {
              const val = seleccionTipos[t.id] || 0;
              return (
                <div key={t.id} className="flex items-center gap-3 border rounded-lg px-3 py-2">
                  <Checkbox
                    checked={val > 0}
                    onCheckedChange={(c) =>
                      setSeleccionTipos((s) => ({ ...s, [t.id]: c ? 1 : 0 }))
                    }
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.nombre}</p>
                    {t.tipo_plan_anual && (
                      <p className="text-[11px] text-muted-foreground">
                        Se volcará como «{t.tipo_plan_anual}» en la planificación anual
                      </p>
                    )}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    className="w-20 h-8"
                    value={val || ''}
                    disabled={val === 0}
                    onChange={(e) =>
                      setSeleccionTipos((s) => ({ ...s, [t.id]: Math.max(1, parseInt(e.target.value || '1', 10)) }))
                    }
                  />
                </div>
              );
            })}
            {(seleccionTipos['otros'] || 0) > 0 && (
              <div className="space-y-1.5 pt-1">
                <Label>Descripción de «Otro»</Label>
                <Input value={tipoLibre} onChange={(e) => setTipoLibre(e.target.value)} placeholder="Ej. uniformidad" />
              </div>
            )}
          </div>
        )}

        {/* Paso 3 */}
        {paso === 2 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {([
                { v: 'concretos', l: 'Maquinistas concretos' },
                { v: 'porcentaje', l: '% de la base' },
                { v: 'todos', l: 'Todos' },
              ] as { v: ModoAlcance; l: string }[]).map((o) => (
                <Button
                  key={o.v}
                  size="sm"
                  variant={modo === o.v ? 'default' : 'outline'}
                  onClick={() => setModo(o.v)}
                >
                  {o.l}
                </Button>
              ))}
            </div>

            {modo === 'porcentaje' && (
              <div className="flex items-end gap-2">
                <div className="space-y-1.5">
                  <Label>Porcentaje de la base</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    className="w-28"
                    value={porcentaje}
                    onChange={(e) => setPorcentaje(Math.min(100, Math.max(1, parseInt(e.target.value || '1', 10))))}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={sortear}>
                  <Shuffle className="w-4 h-4 mr-1" /> Regenerar sorteo
                </Button>
              </div>
            )}

            {modo !== 'todos' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar maquinista..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            )}

            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {filtrados.map((m) => (
                <label key={m.id} className="flex items-center gap-3 px-3 py-1.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={seleccionados.includes(m.id)}
                    onCheckedChange={(c) =>
                      setSeleccionados((s) => (c ? [...s, m.id] : s.filter((x) => x !== m.id)))
                    }
                  />
                  <span className="flex-1">{m.apellidos}, {m.nombre}</span>
                  <span className="text-xs text-muted-foreground">{m.matricula}</span>
                </label>
              ))}
              {filtrados.length === 0 && (
                <p className="text-sm text-muted-foreground px-3 py-4">Sin maquinistas.</p>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              Se aplicará a <strong>{seleccionados.length}</strong> maquinistas
            </div>
          </div>
        )}

        {/* Paso 4 */}
        {paso === 3 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Fecha de inicio *</Label>
                <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de fin *</Label>
                <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
            </div>
            {fechaInicio && fechaFin && fechaFin < fechaInicio && (
              <p className="text-sm text-destructive">La fecha de fin debe ser igual o posterior a la de inicio.</p>
            )}
            <div className="space-y-1.5">
              <Label>Distribución de las acciones</Label>
              <Select value={distribucion} onValueChange={(v) => setDistribucion(v as DistribucionPlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uniforme">Uniforme por meses</SelectItem>
                  <SelectItem value="aleatoria">Aleatoria dentro del periodo</SelectItem>
                  <SelectItem value="manual">Manual (se ajusta en la propuesta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border p-3 text-sm space-y-1 bg-muted/40">
              <p className="font-medium">Resumen</p>
              <p className="text-muted-foreground">
                {categoria === 'especifico' ? 'Plan específico' : 'Campaña / sondeo'} · {base}
              </p>
              <div className="flex flex-wrap gap-1 pt-1">
                {tiposElegidos.map(([id, n]) => (
                  <Badge key={id} variant="secondary">
                    {tipos.find((t) => t.id === id)?.nombre} ×{n}
                  </Badge>
                ))}
              </div>
              <p className="text-muted-foreground">
                {seleccionados.length} maquinistas ·{' '}
                {seleccionados.length * tiposElegidos.reduce((s, [, n]) => s + n, 0)} acciones previstas
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => (paso === 0 ? onOpenChange(false) : setPaso(paso - 1))}>
            {paso === 0 ? 'Cancelar' : 'Atrás'}
          </Button>
          {paso < PASOS.length - 1 ? (
            <Button disabled={!puedeAvanzar()} onClick={() => setPaso(paso + 1)}>
              Siguiente
            </Button>
          ) : (
            <Button disabled={!puedeAvanzar() || saving} onClick={guardarBorrador}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar propuesta
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
