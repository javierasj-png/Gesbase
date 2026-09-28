import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MODO_LABEL, type ModoSondeo } from '@/lib/docReglamentaria/parser';
import { fmtPct } from '@/lib/docReglamentaria/resumen';
import { compararAgregados, compararDetalle, compararResumenes, type Comparacion, type Item } from '@/lib/docReglamentaria/comparar';

interface S { id: string; fecha_sondeo: string; base_nombre: string; modo: ModoSondeo }
const fmt = (n: number) => new Intl.NumberFormat('es-ES').format(n);
const fechaEs = (f: string) => f.split('-').reverse().join('/');

async function todas<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) { const { data, error } = await q(i, i + 999); if (error || !data) break; out.push(...data); if (data.length < 1000) break; }
  return out;
}
async function cargar(modo: ModoSondeo, id: string) {
  if (modo === 'agregado') return todas<any>((a, b) => supabase.from('doc_registros_agregados').select('referencia,titulo,incluidos,recibidos,abiertos,leidos').eq('sondeo_id', id).range(a, b));
  if (modo === 'resumen_maquinista') return todas<any>((a, b) => supabase.from('doc_resumenes_maquinista').select('matricula,nombre,asignados,leidos_total').eq('sondeo_id', id).range(a, b));
  return todas<any>((a, b) => supabase.from('doc_detalle_agente').select('matricula,nombre,referencia,titulo,estado').eq('sondeo_id', id).range(a, b));
}

type Cmp = Comparacion<any> & { nuevasLecturas?: number; retrocesos?: number };

export function CompararSondeos({ sondeos, basesDisponibles }: { sondeos: S[]; basesDisponibles: string[] }) {
  const bases = useMemo(() => basesDisponibles.filter(b => sondeos.some(s => s.base_nombre === b)), [sondeos, basesDisponibles]);
  const [base, setBase] = useState('');
  const [modo, setModo] = useState<ModoSondeo | ''>('');
  const [fa, setFa] = useState(''); const [fb, setFb] = useState('');
  const [cmp, setCmp] = useState<Cmp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (!bases.includes(base)) setBase(bases[0] || ''); }, [bases, base]);
  const modos = useMemo(() => (['agregado', 'resumen_maquinista', 'detalle_agente'] as ModoSondeo[]).filter(m => sondeos.some(s => s.base_nombre === base && s.modo === m)), [sondeos, base]);
  useEffect(() => { if (!modos.includes(modo as ModoSondeo)) setModo(modos[0] || ''); }, [modos, modo]);
  const lista = useMemo(() => sondeos.filter(s => s.base_nombre === base && s.modo === modo).sort((a, b) => a.fecha_sondeo.localeCompare(b.fecha_sondeo)), [sondeos, base, modo]);
  useEffect(() => {
    const fs = lista.map(s => s.fecha_sondeo);
    if (!fs.includes(fb)) setFb(fs[fs.length - 1] || '');
    if (!fs.includes(fa)) setFa(fs[fs.length - 2] || '');
  }, [lista, fa, fb]);

  const idA = lista.find(s => s.fecha_sondeo === fa)?.id || '';
  const idB = lista.find(s => s.fecha_sondeo === fb)?.id || '';
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    if (!idA || !idB || idA === idB || !modo) { setCmp(null); setLoading(false); return; }
    let cancel = false; setLoading(true);
    (async () => {
      try {
        const [x, y] = await Promise.all([cargar(modo, idA), cargar(modo, idB)]);
        const c = modo === 'agregado' ? compararAgregados(x, y) : modo === 'resumen_maquinista' ? compararResumenes(x, y) : compararDetalle(x, y);
        if (!cancel) setCmp(c);
      } catch (e) {
        console.error('Comparar sondeos', e);
        if (!cancel) { setCmp(null); setError('No se ha podido cargar la comparación.'); }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [idA, idB, modo]);

  if (!sondeos.length) return null;
  const etiqueta = (it: Item<any>) => modo === 'agregado' ? `${it.clave}${(it.despues || it.antes)?.titulo ? ' · ' + (it.despues || it.antes).titulo : ''}`
    : modo === 'resumen_maquinista' ? `${it.clave}${(it.despues || it.antes)?.nombre ? ' · ' + (it.despues || it.antes).nombre : ''}`
    : (() => { const r = (it.despues || it.antes); return `${r.matricula} ${r.nombre || ''} · ${r.referencia}`; })();
  const valor = (v: any) => !v ? '—' : modo === 'detalle_agente' ? v.estado : modo === 'resumen_maquinista' ? `${v.leidos_total}/${v.asignados} leídos` : `I${v.incluidos} R${v.recibidos} A${v.abiertos} L${v.leidos}`;
  const delta = (a: number, b: number) => { const d = b - a; return d === 0 ? '=' : (d > 0 ? '+' : '') + fmt(d); };
  const pp = (a: number | null, b: number | null) => a === null || b === null ? '—' : `${b - a >= 0 ? '+' : ''}${((b - a) * 100).toFixed(1).replace('.', ',')} p.p.`;

  const bloque = (t: string, l: Item<any>[], nota?: string) => (
    <div className="border rounded-md">
      <div className="px-3 py-2 bg-muted/50 text-xs font-medium flex justify-between"><span>{t}</span><span>{l.length}</span></div>
      {nota && <p className="px-3 pt-2 text-xs text-muted-foreground">{nota}</p>}
      <div className="max-h-56 overflow-y-auto text-xs">
        {l.length === 0 ? <p className="p-3 text-muted-foreground">Ninguno</p> : l.slice(0, 300).map(it => (
          <div key={it.clave} className="px-3 py-1 border-t flex justify-between gap-2">
            <span className="truncate">{etiqueta(it)}</span>
            <span className="shrink-0 capitalize flex items-center gap-1">{valor(it.antes)}<ArrowRight className="w-3 h-3" />{valor(it.despues)}</span>
          </div>))}
        {l.length > 300 && <p className="p-2 text-muted-foreground">…y {l.length - 300} más</p>}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Evolución entre sondeos</CardTitle>
        <p className="text-xs text-muted-foreground">Compara dos fechas de la misma base y tipo de datos.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><label className="text-xs text-muted-foreground">Base</label>
            <Select value={base} onValueChange={setBase}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{bases.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Tipo de datos</label>
            <Select value={modo} onValueChange={v => setModo(v as ModoSondeo)}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{modos.map(m => <SelectItem key={m} value={m}>{MODO_LABEL[m]}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Sondeo anterior</label>
            <Select value={fa} onValueChange={setFa} disabled={lista.length < 2}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{lista.filter(s => s.fecha_sondeo < fb).map(s => <SelectItem key={s.id} value={s.fecha_sondeo}>{fechaEs(s.fecha_sondeo)}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Sondeo posterior</label>
            <Select value={fb} onValueChange={setFb} disabled={lista.length < 2}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{lista.filter(s => s.fecha_sondeo > fa).map(s => <SelectItem key={s.id} value={s.fecha_sondeo}>{fechaEs(s.fecha_sondeo)}</SelectItem>)}</SelectContent></Select></div>
        </div>

        {lista.length < 2 ? <p className="text-sm text-muted-foreground text-center py-4">Todavía no hay comparación disponible: solo hay {lista.length} sondeo para esta base y tipo de datos.</p>
          : loading ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          : error ? <p className="text-sm text-destructive text-center py-4">{error}</p>
          : !cmp ? <p className="text-sm text-muted-foreground text-center py-4">Elige un sondeo anterior y uno posterior para compararlos.</p>
          : <>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="kpi-card border-l-4 border-l-primary"><p className="kpi-label">Porcentaje de lectura</p>
                <p className="kpi-value">{fmtPct(cmp.antes.porcentaje)} → {fmtPct(cmp.despues.porcentaje)}</p><p className="text-xs text-muted-foreground mt-1">{pp(cmp.antes.porcentaje, cmp.despues.porcentaje)}</p></div>
              <div className="kpi-card border-l-4 border-l-primary"><p className="kpi-label">Pendientes</p>
                <p className="kpi-value">{fmt(cmp.antes.pendientes)} → {fmt(cmp.despues.pendientes)}</p><p className="text-xs text-muted-foreground mt-1">{delta(cmp.antes.pendientes, cmp.despues.pendientes)}</p></div>
              <div className="kpi-card border-l-4 border-l-primary"><p className="kpi-label">Asignaciones</p>
                <p className="kpi-value">{fmt(cmp.antes.asignaciones)} → {fmt(cmp.despues.asignaciones)}</p><p className="text-xs text-muted-foreground mt-1">{delta(cmp.antes.asignaciones, cmp.despues.asignaciones)}</p></div>
            </div>
            {modo === 'detalle_agente' && <p className="text-xs text-muted-foreground">Cambios de estado: {cmp.nuevasLecturas} pasan a leído · {cmp.retrocesos} dejan de figurar como leído · {cmp.iguales} sin cambios.</p>}
            {modo === 'agregado' && <p className="text-xs text-muted-foreground">Datos agregados por documento: no permiten saber qué maquinistas han leído.</p>}
            <div className="grid gap-3 md:grid-cols-3">
              {bloque(modo === 'detalle_agente' ? 'Asignaciones nuevas' : 'Aparecen', cmp.aparecen)}
              {bloque(modo === 'detalle_agente' ? 'Asignaciones retiradas' : 'Desaparecen', cmp.desaparecen, 'Que desaparezca no significa que se haya leído.')}
              {bloque(modo === 'detalle_agente' ? 'Cambios de estado' : 'Cambian sus recuentos', cmp.cambian)}
            </div>
          </>}
      </CardContent>
    </Card>
  );
}
