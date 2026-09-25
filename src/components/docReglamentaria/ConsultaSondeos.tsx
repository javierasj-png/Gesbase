import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBaseFilter } from '@/hooks/useBaseFilter';
import { MODO_LABEL, norm, type ModoSondeo } from '@/lib/docReglamentaria/parser';
import { agruparPorDocumento, docsDesdeDetalle, fmtPct, indicadoresDesdeDocs, indicadoresDesdeResumenes, totalDe, type DocFila, type Indicadores } from '@/lib/docReglamentaria/resumen';

interface Sondeo { id: string; fecha_sondeo: string; base_nombre: string; modo: ModoSondeo }
const fmt = (n: number) => new Intl.NumberFormat('es-ES').format(n);
const fechaEs = (f: string) => f.split('-').reverse().join('/');
// Supabase devuelve 1000 filas por defecto; paginamos.
async function todas<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export function ConsultaSondeos({ recarga }: { recarga: number }) {
  const { getAccessibleBases } = useBaseFilter();
  const [sondeos, setSondeos] = useState<Sondeo[]>([]);
  const [fecha, setFecha] = useState('');
  const [base, setBase] = useState('all');
  const [modo, setModo] = useState<ModoSondeo | ''>('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocFila[]>([]);
  const [ind, setInd] = useState<Indicadores | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('doc_sondeos').select('id,fecha_sondeo,base_nombre,modo').order('fecha_sondeo', { ascending: false });
      const s = (data || []) as Sondeo[];
      setSondeos(s);
      setFecha(f => (f && s.some(x => x.fecha_sondeo === f) ? f : s[0]?.fecha_sondeo || ''));
      setLoading(false);
    })();
  }, [recarga]);

  const fechas = useMemo(() => [...new Set(sondeos.map(s => s.fecha_sondeo))], [sondeos]);
  const delDia = useMemo(() => sondeos.filter(s => s.fecha_sondeo === fecha && (base === 'all' || s.base_nombre === base)), [sondeos, fecha, base]);
  const modos = useMemo(() => (['agregado', 'resumen_maquinista', 'detalle_agente'] as ModoSondeo[]).filter(m => delDia.some(s => s.modo === m)), [delDia]);
  useEffect(() => { if (!modos.includes(modo as ModoSondeo)) setModo(modos[0] || ''); }, [modos, modo]);

  useEffect(() => {
    const ids = delDia.filter(s => s.modo === modo).map(s => s.id);
    if (!ids.length) { setDocs([]); setInd(null); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      let d: DocFila[] = []; let i: Indicadores | null = null;
      if (modo === 'agregado') {
        const rows = await todas<DocFila>((a, b) => supabase.from('doc_registros_agregados').select('referencia,titulo,incluidos,recibidos,abiertos,leidos').in('sondeo_id', ids).range(a, b));
        d = agruparPorDocumento(rows); i = indicadoresDesdeDocs(rows);
      } else if (modo === 'detalle_agente') {
        const rows = await todas<{ referencia: string; titulo: string | null; estado: string }>((a, b) => supabase.from('doc_detalle_agente').select('referencia,titulo,estado').in('sondeo_id', ids).range(a, b));
        d = docsDesdeDetalle(rows); i = indicadoresDesdeDocs(d);
      } else {
        const rows = await todas<{ asignados: number; leidos_total: number }>((a, b) => supabase.from('doc_resumenes_maquinista').select('asignados,leidos_total').in('sondeo_id', ids).range(a, b));
        i = indicadoresDesdeResumenes(rows);
      }
      if (!cancel) { setDocs(d); setInd(i); setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [delDia, modo]);

  const q = norm(busca);
  const visibles = q ? docs.filter(r => norm(r.referencia).includes(q) || norm(r.titulo || '').includes(q)) : docs;
  const indVisible = q && modo !== 'resumen_maquinista' ? indicadoresDesdeDocs(visibles) : ind;

  if (!loading && !sondeos.length) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sin datos: todavía no hay sondeos guardados en tus bases.</CardContent></Card>;
  }

  const kpi = (t: string, v: string, s?: string) => (
    <div className="kpi-card border-l-4 border-l-primary"><p className="kpi-label">{t}</p><p className="kpi-value">{v}</p>{s && <p className="text-xs text-muted-foreground mt-1">{s}</p>}</div>
  );

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Consulta de sondeos guardados</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><label className="text-xs text-muted-foreground">Fecha del sondeo</label>
            <Select value={fecha} onValueChange={setFecha}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{fechas.map(f => <SelectItem key={f} value={f}>{fechaEs(f)}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Base</label>
            <Select value={base} onValueChange={setBase}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas mis bases</SelectItem>{getAccessibleBases.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Tipo de datos</label>
            <Select value={modo} onValueChange={v => setModo(v as ModoSondeo)} disabled={!modos.length}><SelectTrigger><SelectValue placeholder="Sin datos" /></SelectTrigger>
              <SelectContent>{modos.map(m => <SelectItem key={m} value={m}>{MODO_LABEL[m]}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Buscar documento</label>
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Referencia o título" disabled={modo === 'resumen_maquinista'} /></div>
        </div>

        {loading ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          : !indVisible ? <p className="text-sm text-muted-foreground py-4 text-center">Sin datos para esta fecha, base y búsqueda.</p>
          : <>
            <div className="grid gap-3 md:grid-cols-4">
              {kpi('Asignaciones totales', fmt(indVisible.asignaciones))}
              {kpi('Lecturas', fmt(indVisible.lecturas))}
              {kpi('Pendientes', fmt(indVisible.pendientes))}
              {kpi('Porcentaje de lectura', fmtPct(indVisible.porcentaje), indVisible.asignaciones ? `${fmt(indVisible.lecturas)} de ${fmt(indVisible.asignaciones)}` : 'Sin asignaciones')}
            </div>
            {modo === 'resumen_maquinista' ? (
              <p className="text-sm text-muted-foreground">Este tipo de datos solo trae totales por maquinista; no incluye recuentos por documento.</p>
            ) : (
              <div className="overflow-x-auto border rounded-md max-h-[480px]">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0"><tr>
                    <th className="p-2 text-left">Referencia</th><th className="p-2 text-left">Título</th>
                    <th className="p-2">Incluido</th><th className="p-2">Recibido</th><th className="p-2">Abierto</th><th className="p-2">Leído</th><th className="p-2">Lectura</th>
                  </tr></thead>
                  <tbody>{visibles.map(r => { const t = totalDe(r); return (
                    <tr key={r.referencia} className="border-t">
                      <td className="p-2 font-mono">{r.referencia}</td><td className="p-2">{r.titulo || '—'}</td>
                      <td className="p-2 text-center">{fmt(r.incluidos)}</td><td className="p-2 text-center">{fmt(r.recibidos)}</td>
                      <td className="p-2 text-center">{fmt(r.abiertos)}</td><td className="p-2 text-center">{fmt(r.leidos)}</td>
                      <td className="p-2 text-center">{fmtPct(t ? r.leidos / t : null)}</td>
                    </tr>); })}</tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2 flex-wrap">{delDia.filter(s => s.modo === modo).map(s => <Badge key={s.id} variant="outline">{s.base_nombre}</Badge>)}</div>
          </>}
      </CardContent>
    </Card>
  );
}
