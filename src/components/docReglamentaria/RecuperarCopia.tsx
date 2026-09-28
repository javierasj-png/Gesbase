import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Download, FileJson, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBaseFilter } from '@/hooks/useBaseFilter';
import { MODO_LABEL, norm } from '@/lib/docReglamentaria/parser';
import { clasificarActuacion, construirExportacion, leerCopia, type ActuacionCopia, type Copia, type SondeoCopia } from '@/lib/docReglamentaria/copia';
import type { Actuacion } from '@/lib/docReglamentaria/justificaciones';

const db = (t: string) => supabase.from(t as never) as any;
const fechaEs = (f: string) => f.split('-').reverse().join('/');
async function todas<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) { const { data, error } = await q(i, i + 999); if (error || !data) break; out.push(...data); if (data.length < 1000) break; }
  return out;
}
function sugerir(origen: string, org: Copia['organizacion'], bases: string[]) {
  for (const c of [org[origen]?.base || '', origen]) {
    const o = norm(c); if (!o) continue;
    const b = bases.find(x => norm(x) === o) || bases.find(x => o.includes(norm(x)) || norm(x).includes(o));
    if (b) return b;
  }
  return '';
}

interface Conflictos { sondeos: SondeoCopia[]; acts: { a: ActuacionCopia; base: string; existente: Actuacion }[] }

export function RecuperarCopia({ onDone }: { onDone: () => void }) {
  const { getAccessibleBases } = useBaseFilter();
  const ref = useRef<HTMLInputElement>(null);
  const [copia, setCopia] = useState<Copia | null>(null);
  const [nombre, setNombre] = useState('');
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [secSondeos, setSecSondeos] = useState(true);
  const [secActs, setSecActs] = useState(true);
  const [vinculados, setVinculados] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState<string[]>([]);
  const [conf, setConf] = useState<Conflictos | null>(null);

  const abrir = async (f: File | undefined) => {
    if (!f) return;
    try {
      const c = leerCopia(await f.text());
      setCopia(c); setNombre(f.name); setResultado([]);
      setMapa(Object.fromEntries(c.origenes.map(o => [o, sugerir(o, c.organizacion, getAccessibleBases)])));
      const mats = [...new Set([...c.agentes.map(a => a.matricula), ...c.actuaciones.map(a => a.matricula || '')].filter(Boolean))];
      let n = 0;
      for (let i = 0; i < mats.length; i += 200) { const { data } = await supabase.from('maquinistas').select('matricula').in('matricula', mats.slice(i, i + 200)); n += data?.length || 0; }
      setVinculados(n);
    } catch (e) { toast.error((e as Error).message); }
    if (ref.current) ref.current.value = '';
  };

  const sondeosOk = copia?.sondeos.filter(s => !s.errores.length && mapa[s.origen]) || [];
  const actsOk = copia?.actuaciones.filter(a => !a.errores.length && mapa[a.origen]) || [];
  const sinBase = copia?.origenes.filter(o => !mapa[o]) || [];

  const importar = async () => {
    if (!copia) return;
    setBusy(true);
    const log: string[] = []; const pend: Conflictos = { sondeos: [], acts: [] };
    if (secSondeos) {
      let ok = 0, ya = 0, err = 0;
      for (const s of sondeosOk) {
        const { data, error } = await supabase.rpc('doc_importar_sondeo' as never, { _fecha: s.fecha, _base: mapa[s.origen], _modo: s.modo, _nombre_archivo: s.nombre, _filas: s.filas, _reemplazar: false } as never);
        if (error) { err++; log.push(`Sondeo ${s.origen} ${fechaEs(s.fecha)}: ${error.message}`); continue; }
        const e = (data as any).estado;
        if (e === 'requiere_confirmacion') pend.sondeos.push(s); else if (e === 'ya_importado') ya++; else ok++;
      }
      log.unshift(`Sondeos: ${ok} guardados, ${ya} ya importados, ${pend.sondeos.length} con conflicto, ${err} con error.`);
    }
    if (secActs && actsOk.length) {
      const bases = [...new Set(actsOk.map(a => mapa[a.origen]))];
      const existentes = await todas<Actuacion>((a, b) => db('doc_actuaciones').select('*').in('base_nombre', bases).range(a, b));
      let ok = 0, dup = 0, err = 0;
      for (const a of actsOk) {
        const base = mapa[a.origen];
        const c = clasificarActuacion(a, base, existentes);
        if (c.clase === 'duplicada') { dup++; continue; }
        if (c.clase === 'conflicto') { pend.acts.push({ a, base, existente: c.existente! }); continue; }
        const { idOrigen: _i, origen: _o, errores: _e, ...fila } = a;
        const { data, error } = await db('doc_actuaciones').insert({ ...fila, base_nombre: base }).select('*').single();
        if (error) { err++; log.push(`Actuación ${a.matricula || a.origen} ${fechaEs(a.fecha_actuacion)}: ${error.message}`); } else { ok++; existentes.push(data); }
      }
      log.push(`Actuaciones: ${ok} guardadas, ${dup} ya existían, ${pend.acts.length} con conflicto, ${err} con error.`);
    }
    setResultado(log); setBusy(false); onDone();
    if (pend.sondeos.length || pend.acts.length) setConf(pend);
  };

  const sustituir = async () => {
    if (!conf) return;
    setBusy(true); const log: string[] = [];
    let s1 = 0, a1 = 0;
    for (const s of conf.sondeos) {
      const { error } = await supabase.rpc('doc_importar_sondeo' as never, { _fecha: s.fecha, _base: mapa[s.origen], _modo: s.modo, _nombre_archivo: s.nombre, _filas: s.filas, _reemplazar: true } as never);
      if (error) log.push(`Sondeo ${s.origen}: ${error.message}`); else s1++;
    }
    for (const { a, base, existente } of conf.acts) {
      const { idOrigen: _i, origen: _o, errores: _e, ...fila } = a;
      const { error } = await db('doc_actuaciones').update({ ...fila, base_nombre: base }).eq('id', existente.id);
      if (error) log.push(`Actuación ${a.matricula}: ${error.message}`); else a1++;
    }
    setResultado(r => [...r, `Sustituidos tras confirmar: ${s1} sondeo(s), ${a1} actuación(es).`, ...log]);
    setConf(null); setBusy(false); onDone();
  };

  const exportar = async () => {
    setBusy(true);
    const sondeos = await todas<any>((a, b) => db('doc_sondeos').select('id,fecha_sondeo,base_nombre,modo,nombre_archivo,hash_archivo').range(a, b));
    const ids = (m: string) => sondeos.filter(s => s.modo === m).map(s => s.id);
    const porLotes = async (t: string, cols: string, lista: string[]) => {
      const out: any[] = [];
      for (let i = 0; i < lista.length; i += 50) out.push(...await todas<any>((a, b) => db(t).select(cols).in('sondeo_id', lista.slice(i, i + 50)).range(a, b)));
      return out;
    };
    const json = construirExportacion({
      sondeos,
      agregados: await porLotes('doc_registros_agregados', 'sondeo_id,referencia,titulo,tipo_documento,incluidos,recibidos,abiertos,leidos', ids('agregado')),
      resumenes: await porLotes('doc_resumenes_maquinista', 'sondeo_id,matricula,nombre,incluidos,recibidos,abiertos,leidos,asignados,leidos_total', ids('resumen_maquinista')),
      detalle: await porLotes('doc_detalle_agente', 'sondeo_id,matricula,nombre,referencia,titulo,tipo_documento,estado', ids('detalle_agente')),
      actuaciones: await todas<Actuacion>((a, b) => db('doc_actuaciones').select('*').range(a, b)),
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(json)], { type: 'application/json' }));
    const el = document.createElement('a'); el.href = url; el.download = `documentacion-reglamentaria-${new Date().toISOString().slice(0, 10)}.json`; el.click();
    URL.revokeObjectURL(url); setBusy(false);
    toast.success(`Exportados ${sondeos.length} sondeo(s) y ${json.notes.length} actuación(es) de tus bases.`);
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Copias del tablero</CardTitle>
          <p className="text-xs text-muted-foreground">Recupera una copia de «Guardar copia» del tablero original o exporta los datos de tus bases. Nunca se borra el resto de Gesbase.</p>
        </div>
        <div className="flex gap-2">
          <input ref={ref} type="file" accept=".json,application/json" className="hidden" onChange={e => abrir(e.target.files?.[0])} />
          <Button size="sm" variant="outline" className="gap-1" onClick={() => ref.current?.click()} disabled={busy}><FileJson className="w-4 h-4" />Recuperar copia</Button>
          <Button size="sm" variant="outline" className="gap-1" onClick={exportar} disabled={busy}><Download className="w-4 h-4" />Exportar mis datos</Button>
        </div>
      </CardHeader>
      {copia && <CardContent className="space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-medium">Vista previa · {nombre}</p>
          <Button size="icon" variant="ghost" onClick={() => setCopia(null)}><X className="w-4 h-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{copia.sondeos.length} sondeo(s)</Badge>
          <Badge variant="outline">{copia.actuaciones.length} actuación(es)</Badge>
          <Badge variant="outline">{copia.agentes.length} agente(s) en el censo · {vinculados ?? '…'} matrícula(s) existen en Gesbase</Badge>
          <Badge variant="outline">{Object.keys(copia.organizacion).length} correspondencia(s) organizativa(s)</Badge>
        </div>
        <p className="text-xs text-muted-foreground">El censo de agentes no se importa: los maquinistas se vinculan solo por matrícula con los que ya existen y no se crean nuevos.</p>
        {copia.avisos.map(a => <p key={a} className="text-xs text-muted-foreground">⚠ {a}</p>)}

        <div>
          <p className="font-medium mb-1">1. Bases de origen → bases de Gesbase (obligatorio)</p>
          <div className="grid gap-2 md:grid-cols-2">{copia.origenes.map(o => (
            <div key={o} className="flex items-center gap-2">
              <span className="w-28 font-mono text-xs">{o}</span>
              <Select value={mapa[o] || 'none'} onValueChange={v => setMapa(m => ({ ...m, [o]: v === 'none' ? '' : v }))}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">— No importar —</SelectItem>{getAccessibleBases.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>))}</div>
          {sinBase.length > 0 && <p className="text-xs text-muted-foreground mt-1">Sin base asignada (no se importarán): {sinBase.join(', ')}. Solo aparecen tus bases autorizadas.</p>}
        </div>

        <div>
          <p className="font-medium mb-1">2. Secciones</p>
          <label className="flex items-center gap-2"><Checkbox checked={secSondeos} onCheckedChange={v => setSecSondeos(!!v)} />Sondeos ({sondeosOk.length} de {copia.sondeos.length} listos)</label>
          <label className="flex items-center gap-2"><Checkbox checked={secActs} onCheckedChange={v => setSecActs(!!v)} />Actuaciones ({actsOk.length} de {copia.actuaciones.length} listas)</label>
        </div>

        <div className="overflow-x-auto border rounded-md max-h-64">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0"><tr><th className="p-2 text-left">Sondeo</th><th className="p-2 text-left">Origen → Gesbase</th><th className="p-2 text-left">Tipo</th><th className="p-2">Registros</th><th className="p-2 text-left">Estado</th></tr></thead>
            <tbody>{copia.sondeos.map(s => <tr key={s.clave} className="border-t">
              <td className="p-2">{fechaEs(s.fecha)}</td><td className="p-2">{s.origen} → {mapa[s.origen] || <span className="text-destructive">sin base</span>}</td>
              <td className="p-2">{MODO_LABEL[s.modo]}</td><td className="p-2 text-center">{s.filas.length}</td>
              <td className="p-2">{s.errores.length ? <span className="text-destructive">{s.errores.join(' ')}</span> : mapa[s.origen] ? 'Listo' : 'Requiere correspondencia'}</td></tr>)}</tbody>
          </table>
        </div>
        {copia.actuaciones.length > 0 && <div className="overflow-x-auto border rounded-md max-h-64">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0"><tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Origen</th><th className="p-2 text-left">Agente</th><th className="p-2 text-left">Estado</th><th className="p-2">No computa</th><th className="p-2 text-left">Validación</th></tr></thead>
            <tbody>{copia.actuaciones.map((a, i) => <tr key={a.idOrigen || i} className="border-t">
              <td className="p-2">{fechaEs(a.fecha_actuacion)}</td><td className="p-2">{a.origen}</td><td className="p-2">{a.matricula ? `${a.matricula} ${a.nombre || ''}` : 'Toda la base'}</td>
              <td className="p-2">{a.estado}</td><td className="p-2 text-center">{a.no_computa ? 'Sí' : ''}</td>
              <td className="p-2">{a.errores.length ? <span className="text-destructive">{a.errores.join(' ')}</span> : mapa[a.origen] ? 'Lista' : 'Requiere correspondencia'}</td></tr>)}</tbody>
          </table>
        </div>}

        <div className="flex justify-end">
          <Button onClick={importar} disabled={busy || (!(secSondeos && sondeosOk.length) && !(secActs && actsOk.length))} className="gap-1">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}Importar secciones seleccionadas
          </Button>
        </div>
        {resultado.length > 0 && <div className="rounded-md border p-3 space-y-1">{resultado.map((r, i) => <p key={i} className="text-xs">{r}</p>)}</div>}
      </CardContent>}

      <AlertDialog open={!!conf} onOpenChange={o => !o && setConf(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hay datos distintos ya guardados</AlertDialogTitle>
            <AlertDialogDescription>No se ha cambiado nada de esto. Revisa qué se sustituiría; si cancelas, se conserva lo que ya hay en Gesbase.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-72 overflow-y-auto text-xs space-y-1">
            {conf?.sondeos.map(s => <p key={s.clave}>Sondeo {MODO_LABEL[s.modo]} · {mapa[s.origen]} · {fechaEs(s.fecha)}: se sustituiría por {s.filas.length} registros de la copia.</p>)}
            {conf?.acts.map(({ a, base, existente }) => <p key={existente.id}>Actuación {a.matricula} · {base} · sondeo {fechaEs(a.periodo)}: guardada «{existente.estado}» ({fechaEs(existente.fecha_actuacion)}) → copia «{a.estado}» ({fechaEs(a.fecha_actuacion)}).</p>)}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Conservar lo guardado</AlertDialogCancel>
            <AlertDialogAction onClick={sustituir}>Sustituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
