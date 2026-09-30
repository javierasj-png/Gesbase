import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Mail, FileDown } from 'lucide-react';
import { generateSondeoPDF } from '@/utils/generateSondeoPDF';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ComunicacionDialog } from './ComunicacionDialog';
import { asuntoBase, comentarioBase, mensajeBase, ESTADO_BASE_COMUNICADO } from '@/lib/docReglamentaria/comunicaciones';
import { supabase } from '@/integrations/supabase/client';
import { useBaseFilter } from '@/hooks/useBaseFilter';
import { useGlobalBaseFilter } from '@/hooks/useGlobalBaseFilter';
import { MODO_LABEL, norm, type ModoSondeo } from '@/lib/docReglamentaria/parser';
import { agruparPorDocumento, docsDesdeDetalle, fmtPct, indicadoresDesdeDocs, indicadoresDesdeResumenes, totalDe, type DocFila, type Indicadores } from '@/lib/docReglamentaria/resumen';
import { SeguimientoMaquinistas } from './SeguimientoMaquinistas';
import { CompararSondeos } from './CompararSondeos';
import { ActuacionesPanel } from './ActuacionesPanel';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { ajustar, justificacionPara, type Actuacion, type ResumenDesglose } from '@/lib/docReglamentaria/justificaciones';

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
  const [base, setBase] = useGlobalBaseFilter();
  const [sondeos, setSondeos] = useState<Sondeo[]>([]);
  const [fecha, setFecha] = useState('');
  const [modo, setModo] = useState<ModoSondeo | ''>('');
  const [busca, setBusca] = useState('');
  const [scrollActivo, setScrollActivo] = useState(false);
  const [msgBase, setMsgBase] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocFila[]>([]);
  const [ind, setInd] = useState<Indicadores | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('doc_sondeos').select('id,fecha_sondeo,base_nombre,modo').order('fecha_sondeo', { ascending: false });
      const s = (data || []) as Sondeo[];
      setSondeos(s);
      setLoading(false);
    })();
  }, [recarga]);

  const fechas = useMemo(() => [...new Set(sondeos.filter(s => base === 'all' || s.base_nombre === base).map(s => s.fecha_sondeo))], [sondeos, base]);
  // Al cambiar de base, si la fecha no existe para esa base, se toma su último sondeo
  useEffect(() => { if (!fechas.includes(fecha)) setFecha(fechas[0] || ''); }, [fechas, fecha]);
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
  const { sortedItems: docsOrdenados, sortConfig, requestSort } = useTableSort(visibles.map(r => ({ ...r, lectura: totalDe(r) ? r.leidos / totalDe(r) : null })));

  // Actuaciones (separadas de las lecturas)
  const [acts, setActs] = useState<Actuacion[]>([]);
  const [nuevaAct, setNuevaAct] = useState<{ base: string; matricula: string; nombre: string; n: number } | null>(null);
  const [recActs, setRecActs] = useState(0);
  useEffect(() => { (async () => {
    const r = await todas<Actuacion>((a, b) => (supabase.from('doc_actuaciones' as never) as any).select('*').order('fecha_actuacion', { ascending: false }).range(a, b));
    setActs(r);
  })(); }, [recActs, recarga]);

  // Resúmenes con desglose del mismo día/base, para el ajuste «no computa» (solo vista agregada sin búsqueda, como el tablero)
  const [resDesglose, setResDesglose] = useState<ResumenDesglose[] | null>(null);
  useEffect(() => {
    const rs = delDia.filter(s => s.modo === 'resumen_maquinista');
    if (!rs.length) { setResDesglose(null); return; }
    const baseDe = new Map(rs.map(s => [s.id, s.base_nombre]));
    (async () => {
      const r = await todas<any>((a, b) => supabase.from('doc_resumenes_maquinista').select('sondeo_id,matricula,nombre,incluidos,recibidos,abiertos,leidos').in('sondeo_id', rs.map(s => s.id)).range(a, b));
      setResDesglose(r.map(x => ({ ...x, base: baseDe.get(x.sondeo_id) || '' })));
    })();
  }, [delDia]);
  const ajusteAplica = modo === 'agregado' && !q && docs.length > 0;
  const orig = docs.reduce<[number, number, number, number]>((s, r) => [s[0] + r.incluidos, s[1] + r.recibidos, s[2] + r.abiertos, s[3] + r.leidos], [0, 0, 0, 0]);
  const ajuste = ajusteAplica && resDesglose ? ajustar(orig, resDesglose, acts, fecha) : null;
  const justificadosSinResumen = ajusteAplica && !resDesglose
    ? [...new Set(acts.filter(a => (base === 'all' || a.base_nombre === base) && delDia.some(s => s.base_nombre === a.base_nombre) && a.matricula && justificacionPara([a], a.matricula, fecha)).map(a => a.matricula!))] : [];

  // En pantalla solo se muestran los resultados tras restar «No computa»
  const ajusteAplicado = !!ajuste && ajuste.excluidos.length > 0;
  const indFinal: Indicadores | null = ajusteAplicado && ajuste ? (() => {
    const total = ajuste.n[0] + ajuste.n[1] + ajuste.n[2] + ajuste.n[3];
    return { asignaciones: total, lecturas: ajuste.n[3], pendientes: total - ajuste.n[3], porcentaje: total ? ajuste.n[3] / total : null };
  })() : indVisible;


  if (!loading && !sondeos.length) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sin datos: todavía no hay sondeos guardados en tus bases.</CardContent></Card>;
  }

  const kpi = (t: string, v: string, s?: string) => (
    <div className="kpi-card border-l-4 border-l-primary"><p className="kpi-label">{t}</p><p className="kpi-value">{v}</p>{s && <p className="text-xs text-muted-foreground mt-1">{s}</p>}</div>
  );

  return (
    <div className="space-y-6">
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
              {kpi('Asignaciones totales', fmt(indFinal!.asignaciones))}
              {kpi('Lecturas', fmt(indFinal!.lecturas))}
              {kpi('Pendientes', fmt(indFinal!.pendientes))}
              {kpi('Porcentaje de lectura', fmtPct(indFinal!.porcentaje), indFinal!.asignaciones ? `${fmt(indFinal!.lecturas)} de ${fmt(indFinal!.asignaciones)}` : 'Sin asignaciones')}
            </div>
            <div className="flex items-center justify-start gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-1" disabled={pdfLoading || !delDia.length} onClick={async () => {
                setPdfLoading(true);
                try { await generateSondeoPDF({ sondeos, base, fecha }); }
                catch (e) { console.error(e); toast.error('No se pudo generar el informe'); }
                finally { setPdfLoading(false); }
              }}>{pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}Descargar informe PDF</Button>
              {base === 'all' || q || modo === 'resumen_maquinista'
                ? <span className="text-xs text-muted-foreground">Para preparar el resumen de la base, elige una base concreta, sin búsqueda y con datos por documento.</span>
                : <Button size="sm" variant="outline" className="gap-1" onClick={() => setMsgBase(true)}><Mail className="w-4 h-4" />Preparar resumen de la base</Button>}
            </div>
            {ajuste && (ajuste.excluidos.length > 0 || ajuste.sinDesglose.length > 0) && (
                <div className="rounded-md border p-3 space-y-2 text-sm">
                  <p className="font-medium">«No computa»</p>
                  {ajuste.excluidos.length > 0 && <>
                    <p className="text-xs text-muted-foreground">Se restan {fmt(ajuste.asignacionesRestadas)} asignaciones de {ajuste.excluidos.length} maquinista(s) justificado(s) vigentes en este sondeo:</p>
                    <ul className="text-xs list-disc pl-5">{ajuste.excluidos.map(e => <li key={e.base + e.matricula}><span className="font-mono">{e.matricula}</span> {e.nombre || ''} ({e.base}) · {e.nota.estado} · {fmt(e.n.reduce((a, b) => a + b, 0))} asignaciones, {fmt(e.n[3])} leídas{e.nota.vigencia_hasta ? ` · revisión ${fechaEs(e.nota.vigencia_hasta)}` : ''}</li>)}</ul>
                  </>}
                  {ajuste.sinDesglose.length > 0 && <p className="text-xs text-destructive">No se restan {ajuste.sinDesglose.length} justificado(s) ({ajuste.sinDesglose.map(s => s.matricula).join(', ')}): su resumen no trae el desglose por estado y no se pueden atribuir sus asignaciones con fiabilidad.</p>}
                </div>
            )}
            {justificadosSinResumen.length > 0 && <p className="text-xs text-destructive">Hay {justificadosSinResumen.length} justificación(es) «No computa» vigentes, pero no hay resumen por maquinista de esta fecha y base. Sin él no se sabe cuántas asignaciones les corresponden, así que no se resta nada.</p>}
            {modo === 'agregado' && q && <p className="text-xs text-muted-foreground">Con búsqueda de documento se muestran todas las asignaciones, sin ajuste «No computa».</p>}
            {modo !== 'resumen_maquinista' && !scrollActivo && <p className="text-xs text-muted-foreground">Haz clic en la tabla para desplazarte dentro de ella.</p>}
            {modo === 'resumen_maquinista' ? (
              <p className="text-sm text-muted-foreground">Este tipo de datos solo trae totales por maquinista; no incluye recuentos por documento.</p>
            ) : (
              <div onClick={() => setScrollActivo(true)} onMouseLeave={() => setScrollActivo(false)}
                style={{ scrollbarWidth: scrollActivo ? 'auto' : 'none' }}
                className={`overflow-x-auto border rounded-md max-h-[480px] ${scrollActivo ? 'overflow-y-auto ring-1 ring-primary/40' : 'overflow-y-hidden [&::-webkit-scrollbar]:hidden'}`}>
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0"><tr>
                    {([['referencia', 'Referencia'], ['titulo', 'Título'], ['incluidos', 'Incluido'], ['recibidos', 'Recibido'], ['abiertos', 'Abierto'], ['leidos', 'Leído'], ['lectura', 'Lectura']] as const).map(([key, label]) =>
                      <SortableTableHead key={key} sortKey={key} currentSortKey={String(sortConfig.key)} direction={sortConfig.direction} onSort={requestSort} className={`h-auto p-2 bg-muted hover:bg-muted ${key === 'referencia' || key === 'titulo' ? 'text-left' : 'text-center'}`}>{label}</SortableTableHead>)}
                  </tr></thead>
                  <tbody>{docsOrdenados.map(r => { const t = totalDe(r); return (
                    <tr key={r.referencia} className="border-t">
                      <td className="p-2 font-mono">{r.referencia}</td><td className="p-2">{r.titulo || '—'}</td>
                      <td className="p-2 text-center">{fmt(r.incluidos)}</td><td className="p-2 text-center">{fmt(r.recibidos)}</td>
                      <td className="p-2 text-center">{fmt(r.abiertos)}</td><td className="p-2 text-center">{fmt(r.leidos)}</td>
                      <td className="p-2 text-center">{fmtPct(t ? r.leidos / t : null)}</td>
                    </tr>); })}</tbody>
                </table>
              </div>
            )}
          </>}
      </CardContent>
    </Card>
    {msgBase && (() => {
      const n = ajuste ? ajuste.n : orig;
      const datos = { base, fecha, leidos: n[3], total: n[0] + n[1] + n[2] + n[3], docs: docs.map(d => ({ referencia: d.referencia, titulo: d.titulo, pendientes: d.incluidos + d.recibidos + d.abiertos })) };
      return <ComunicacionDialog open onClose={() => setMsgBase(false)} titulo={`Preparar resumen de la base · ${base}`} ambito="esta base de conducción"
        email="" asunto={asuntoBase(fecha)} cuerpo={mensajeBase(datos)}
        anteriores={acts.filter(a => a.estado === ESTADO_BASE_COMUNICADO && a.base_nombre === base)}
        registrar={async r => {
          const { error } = await (supabase.from('doc_actuaciones' as never) as any).insert({
            base_nombre: base, matricula: null, nombre: null, responsable: r.responsable, estado: ESTADO_BASE_COMUNICADO,
            fecha_actuacion: r.fecha, fecha_comunicacion: r.fecha, canal: r.canal, periodo: fecha, no_computa: false, comentario: comentarioBase(datos, r.destinatario),
          });
          if (error) return 'No se pudo registrar: ' + error.message;
          setRecActs(x => x + 1); return null;
        }} />;
    })()}
    <SeguimientoMaquinistas sondeos={delDia} acts={acts} periodo={fecha} onChange={() => setRecActs(x => x + 1)}
      onRegistrar={fm => setNuevaAct(p => ({ base: fm.baseSondeo, matricula: fm.matricula, nombre: fm.maestro ? `${fm.maestro.nombre ?? ''} ${fm.maestro.apellidos ?? ''}`.trim() : fm.nombreArchivo, n: (p?.n ?? 0) + 1 }))} />
    <ActuacionesPanel acts={acts} periodo={fecha} bases={getAccessibleBases} baseFiltro={base} onChange={() => setRecActs(x => x + 1)} nueva={nuevaAct} />
    <CompararSondeos sondeos={sondeos} base={base} />
    </div>
  );
}
