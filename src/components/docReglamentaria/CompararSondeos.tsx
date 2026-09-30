import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowUp, Equal, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { type ModoSondeo } from '@/lib/docReglamentaria/parser';
import { docsDesdeDetalle, fmtPct, type DocFila } from '@/lib/docReglamentaria/resumen';
import { evolucion, ratioDocumento, ratioMaquinista, type ResTot, type Tendencia } from '@/lib/docReglamentaria/comparar';

interface Sondeo { id: string; fecha_sondeo: string; base_nombre: string; modo: ModoSondeo }
interface Agregado extends DocFila {}
interface Resumen extends ResTot { matricula: string }
interface Detalle { matricula: string; nombre: string | null; referencia: string; titulo: string | null; estado: string }
interface Resultado<T> { nuevos: T[]; retirados: T[]; comunes: { clave: string; antes: T; despues: T; tendencia: Tendencia }[] }
interface Comparacion { docs: Resultado<Agregado> | null; maqs: Resultado<Resumen> | null; fuentes: string[] }
const fechaEs = (f: string) => f.split('-').reverse().join('/');
const claveDoc = (r: Agregado) => r.referencia;
const claveMaq = (r: Resumen) => r.matricula.trim();

async function todas<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw error;
    if (!data) throw new Error('Respuesta vacía');
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
async function cargar(modo: ModoSondeo, id: string) {
  if (modo === 'agregado') return todas<Agregado>((a, b) => supabase.from('doc_registros_agregados').select('referencia,titulo,incluidos,recibidos,abiertos,leidos').eq('sondeo_id', id).range(a, b));
  if (modo === 'resumen_maquinista') return todas<Resumen>((a, b) => supabase.from('doc_resumenes_maquinista').select('matricula,nombre,asignados,leidos_total').eq('sondeo_id', id).range(a, b));
  return todas<Detalle>((a, b) => supabase.from('doc_detalle_agente').select('matricula,nombre,referencia,titulo,estado').eq('sondeo_id', id).range(a, b));
}
function resumirDetalle(rows: Detalle[]): Resumen[] {
  const m = new Map<string, Resumen>();
  for (const r of rows) {
    const key = r.matricula.trim();
    const current = m.get(key) || { matricula: key, nombre: r.nombre, asignados: 0, leidos_total: 0 };
    current.asignados++;
    if (r.estado === 'leido') current.leidos_total++;
    m.set(key, current);
  }
  return [...m.values()];
}
const ratioLabel = (n: number | null) => fmtPct(n);

function Grupo<T>({ titulo, resultado, nombre, ratio }: { titulo: string; resultado: Resultado<T> | null; nombre: (r: T) => string; ratio: (r: T) => number | null }) {
  if (!resultado) return <section className="space-y-2"><h3 className="font-semibold text-sm">{titulo}</h3><p className="text-xs text-muted-foreground">No hay datos del mismo tipo en ambas fechas.</p></section>;
  const grupos = [
    { key: 'mejora', label: 'Mejoran', Icon: ArrowUp, color: 'text-primary' },
    { key: 'empeora', label: 'Empeoran', Icon: ArrowDown, color: 'text-destructive' },
    { key: 'igual', label: 'Misma lectura', Icon: Equal, color: 'text-muted-foreground' },
    { key: 'sin_datos', label: 'Sin porcentaje comparable', Icon: Equal, color: 'text-muted-foreground' },
  ] as const;
  const totalAntes = resultado.comunes.length + resultado.retirados.length;
  const totalDespues = resultado.comunes.length + resultado.nuevos.length;
  return <section className="space-y-3">
    <h3 className="font-semibold text-sm">{titulo}</h3>
    <p className="text-sm font-medium">{totalAntes} → {totalDespues} <span className="text-muted-foreground font-normal">({totalDespues - totalAntes >= 0 ? '+' : ''}{totalDespues - totalAntes}) · {resultado.nuevos.length} nuevos · {resultado.retirados.length} retirados</span></p>
    <div className="grid gap-3 lg:grid-cols-3">
      {grupos.filter(g => g.key !== 'sin_datos' || resultado.comunes.some(c => c.tendencia === 'sin_datos')).map(g => {
        const filas = resultado.comunes.filter(c => c.tendencia === g.key);
        return <div key={g.key} className="border rounded-md min-w-0">
          <div className="bg-muted px-3 py-2 flex items-center justify-between text-xs font-medium"><span className="flex items-center gap-1"><g.Icon className={`w-3.5 h-3.5 ${g.color}`} />{g.label}</span><span>{filas.length}</span></div>
          <div className="max-h-44 overflow-auto text-xs">{filas.length ? filas.map(c => <div className="border-t px-3 py-2 flex justify-between gap-2" key={c.clave}><span className="min-w-0 break-words">{nombre(c.despues)}</span><span className="shrink-0 whitespace-nowrap">{ratioLabel(ratio(c.antes))} → {ratioLabel(ratio(c.despues))}</span></div>) : <p className="px-3 py-2 text-muted-foreground">Ninguno</p>}</div>
        </div>;
      })}
    </div>
    {(resultado.nuevos.length > 0 || resultado.retirados.length > 0) && <div className="grid gap-2 md:grid-cols-2 text-xs">
      <div><span className="font-medium">Nuevos ({resultado.nuevos.length}): </span><span className="text-muted-foreground">{resultado.nuevos.map(nombre).join(' · ') || 'Ninguno'}</span></div>
      <div><span className="font-medium">Retirados ({resultado.retirados.length}): </span><span className="text-muted-foreground">{resultado.retirados.map(nombre).join(' · ') || 'Ninguno'}</span></div>
    </div>}
  </section>;
}

export function CompararSondeos({ sondeos, base: baseProp }: { sondeos: Sondeo[]; base: string }) {
  const bases = useMemo(() => [...new Set(sondeos.map(s => s.base_nombre))].sort(), [sondeos]);
  // Con una base concreta elegida, nunca se muestra otra base aunque esta no tenga sondeos.
  const base = baseProp !== 'all' ? baseProp : (bases[0] || '');
  const fechas = useMemo(() => [...new Set(sondeos.filter(s => s.base_nombre === base).map(s => s.fecha_sondeo))].sort(), [sondeos, base]);
  const [fa, setFa] = useState(''); const [fb, setFb] = useState('');
  const [cmp, setCmp] = useState<Comparacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!fechas.includes(fb)) setFb(fechas[fechas.length - 1] || '');
    if (!fechas.includes(fa) || fa >= (fechas.includes(fb) ? fb : fechas[fechas.length - 1])) setFa(fechas[fechas.length - 2] || '');
  }, [fechas, fa, fb]);
  const anteriores = useMemo(() => sondeos.filter(s => s.base_nombre === base && s.fecha_sondeo === fa), [sondeos, base, fa]);
  const posteriores = useMemo(() => sondeos.filter(s => s.base_nombre === base && s.fecha_sondeo === fb), [sondeos, base, fb]);
  const ids = (['agregado', 'resumen_maquinista', 'detalle_agente'] as ModoSondeo[]).map(m => {
    const a = anteriores.find(s => s.modo === m)?.id;
    const b = posteriores.find(s => s.modo === m)?.id;
    return a && b ? [m, a, b] as const : null;
  }).filter((x): x is readonly [ModoSondeo, string, string] => x !== null);
  const signature = ids.map(x => x.join(':')).join('|');

  useEffect(() => {
    setError(null);
    if (!fa || !fb || fa >= fb) { setCmp(null); setLoading(false); return; }
    let cancel = false;
    setCmp(null);
    if (!ids.length) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      try {
        const pares = await Promise.all(ids.map(async ([modo, a, b]) => ({ modo, antes: await cargar(modo, a), despues: await cargar(modo, b) })));
        const agregado = pares.find(p => p.modo === 'agregado');
        const resumen = pares.find(p => p.modo === 'resumen_maquinista');
        const detalle = pares.find(p => p.modo === 'detalle_agente');
        const docsA = agregado ? agregado.antes as Agregado[] : detalle ? docsDesdeDetalle(detalle.antes as Detalle[]) : null;
        const docsB = agregado ? agregado.despues as Agregado[] : detalle ? docsDesdeDetalle(detalle.despues as Detalle[]) : null;
        const maqsA = resumen ? resumen.antes as Resumen[] : detalle ? resumirDetalle(detalle.antes as Detalle[]) : null;
        const maqsB = resumen ? resumen.despues as Resumen[] : detalle ? resumirDetalle(detalle.despues as Detalle[]) : null;
        if (!cancel) setCmp({ docs: docsA && docsB ? evolucion<Agregado>(docsA, docsB, claveDoc, ratioDocumento) : null,
          maqs: maqsA && maqsB ? evolucion<Resumen>(maqsA, maqsB, claveMaq, ratioMaquinista) : null,
          fuentes: [agregado ? 'Seguimiento docs' : detalle ? 'Detalle por agente' : '', resumen ? 'Seguimiento maqs.' : detalle ? 'Detalle por agente' : ''].filter((x, i, a) => x && a.indexOf(x) === i) });
      } catch (e) {
        console.error('Comparar sondeos', e);
        if (!cancel) { setCmp(null); setError('No se ha podido cargar la comparación.'); }
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  // La firma recoge solo los identificadores estables de los sondeos seleccionados.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, fa, fb]);

  if (!sondeos.length) return null;
  return <Card><CardHeader className="pb-3"><CardTitle className="text-base">Evolución entre sondeos</CardTitle>
    <p className="text-xs text-muted-foreground">Comparación de documentos y maquinistas de {base || 'la base seleccionada'} entre dos fechas.</p></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div><label className="text-xs text-muted-foreground">Sondeo anterior</label><Select value={fa} onValueChange={setFa} disabled={fechas.length < 2}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{fechas.filter(f => f < fb).map(f => <SelectItem key={f} value={f}>{fechaEs(f)}</SelectItem>)}</SelectContent></Select></div>
        <div><label className="text-xs text-muted-foreground">Sondeo posterior</label><Select value={fb} onValueChange={setFb} disabled={fechas.length < 2}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{fechas.filter(f => f > fa).map(f => <SelectItem key={f} value={f}>{fechaEs(f)}</SelectItem>)}</SelectContent></Select></div>
      </div>
      {fechas.length < 2 ? <p className="text-sm text-muted-foreground">Se necesitan al menos dos fechas para comparar.</p>
        : loading ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
        : error ? <p className="text-sm text-destructive">{error}</p>
        : !cmp ? <p className="text-sm text-muted-foreground">No hay tipos de datos coincidentes entre estas dos fechas.</p>
        : <>
          <p className="text-xs text-muted-foreground">Se compara el porcentaje de lectura de cada registro presente en ambas fechas. Altas y retiradas no se cuentan como mejora o empeoramiento. Fuentes: {cmp.fuentes.join(' · ')}.</p>
          <Grupo<Agregado> titulo="Documentos" resultado={cmp.docs} nombre={r => `${r.referencia}${r.titulo ? ` · ${r.titulo}` : ''}`} ratio={ratioDocumento} />
          <Grupo<Resumen> titulo="Maquinistas" resultado={cmp.maqs} nombre={r => `${r.matricula}${r.nombre ? ` · ${r.nombre}` : ''}`} ratio={ratioMaquinista} />
        </>}
    </CardContent></Card>;
}
