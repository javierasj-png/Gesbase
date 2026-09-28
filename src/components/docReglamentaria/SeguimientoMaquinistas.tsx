import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Mail } from 'lucide-react';
import { ComunicacionDialog } from './ComunicacionDialog';
import { asuntoAgente, mensajeAgente } from '@/lib/docReglamentaria/comunicaciones';
import { supabase } from '@/integrations/supabase/client';
import { fmtPct } from '@/lib/docReglamentaria/resumen';
import { justificacionPara, type Actuacion } from '@/lib/docReglamentaria/justificaciones';
import { construirSeguimiento, cifras, type FilaMaquinista, type MaqMaestro } from '@/lib/docReglamentaria/maquinistas';

interface S { id: string; base_nombre: string; modo: string }
const fmt = (n: number) => new Intl.NumberFormat('es-ES').format(n);

async function todas<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export function SeguimientoMaquinistas({ sondeos, acts = [], periodo = '', onChange }: { sondeos: S[]; acts?: Actuacion[]; periodo?: string; onChange?: () => void }) {
  const [filas, setFilas] = useState<FilaMaquinista[] | null>(null);
  const [ver, setVer] = useState<FilaMaquinista | null>(null);
  const [msg, setMsg] = useState<FilaMaquinista | null>(null);
  const key = sondeos.map(s => s.id).sort().join(',');

  useEffect(() => {
    const resIds = sondeos.filter(s => s.modo === 'resumen_maquinista');
    const detIds = sondeos.filter(s => s.modo === 'detalle_agente');
    if (!resIds.length && !detIds.length) { setFilas([]); return; }
    const baseDe = new Map(sondeos.map(s => [s.id, s.base_nombre]));
    let cancel = false;
    setFilas(null);
    (async () => {
      const [r, d] = await Promise.all([
        resIds.length ? todas<{ sondeo_id: string; matricula: string; nombre: string | null; asignados: number; leidos_total: number }>((a, b) =>
          supabase.from('doc_resumenes_maquinista').select('sondeo_id,matricula,nombre,asignados,leidos_total').in('sondeo_id', resIds.map(s => s.id)).range(a, b)) : [],
        detIds.length ? todas<{ sondeo_id: string; matricula: string; nombre: string | null; referencia: string; titulo: string | null; estado: string }>((a, b) =>
          supabase.from('doc_detalle_agente').select('sondeo_id,matricula,nombre,referencia,titulo,estado').in('sondeo_id', detIds.map(s => s.id)).range(a, b)) : [],
      ]);
      const mats = [...new Set([...r, ...d].map(x => x.matricula.trim()))];
      const maestros: MaqMaestro[] = [];
      for (let i = 0; i < mats.length; i += 200) {
        const { data } = await supabase.from('maquinistas').select('id,matricula,nombre,apellidos,base').in('matricula', mats.slice(i, i + 200));
        maestros.push(...((data || []) as MaqMaestro[]));
      }
      const out = construirSeguimiento(
        r.map(x => ({ ...x, base: baseDe.get(x.sondeo_id) || '' })),
        d.map(x => ({ ...x, base: baseDe.get(x.sondeo_id) || '' })),
        maestros,
      );
      if (!cancel) setFilas(out);
    })();
    return () => { cancel = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!sondeos.some(s => s.modo !== 'agregado')) return null;
  const sinVinculo = filas?.filter(f => !f.maestro).length ?? 0;
  const discrep = filas?.filter(f => f.discrepancia).length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Seguimiento por maquinista</CardTitle>
        <p className="text-xs text-muted-foreground">Vinculado con Gesbase solo por matrícula exacta. No se crean ni modifican maquinistas.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!filas ? <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          : !filas.length ? <p className="text-sm text-muted-foreground text-center py-4">Sin datos individuales para esta fecha y base.</p>
          : <>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline">{filas.length} maquinista(s)</Badge>
              {sinVinculo > 0 && <Badge variant="destructive">{sinVinculo} sin correspondencia</Badge>}
              {discrep > 0 && <Badge variant="secondary" className="gap-1"><AlertTriangle className="w-3 h-3" />{discrep} discrepancia(s) resumen/detalle</Badge>}
            </div>
            <div className="overflow-x-auto border rounded-md max-h-[520px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0"><tr>
                  <th className="p-2 text-left">Nombre</th><th className="p-2 text-left">Matrícula</th><th className="p-2 text-left">Base</th>
                  <th className="p-2">Asignaciones</th><th className="p-2">Lecturas</th><th className="p-2">Pendientes</th><th className="p-2">Lectura</th>
                  <th className="p-2">Detalle</th><th className="p-2">Ficha</th>
                </tr></thead>
                <tbody>{filas.map(f => {
                  const c = cifras(f);
                  return (
                    <tr key={f.matricula} className={`border-t ${!f.maestro ? 'bg-destructive/5' : f.discrepancia ? 'bg-accent/40' : ''}`}>
                      <td className="p-2">{f.maestro ? `${f.maestro.apellidos}, ${f.maestro.nombre}` : <span className="text-muted-foreground">{f.nombreArchivo || '—'} <Badge variant="destructive" className="ml-1">Sin correspondencia</Badge></span>}</td>
                      <td className="p-2 font-mono">{f.matricula}</td>
                      <td className="p-2">{f.maestro?.base || f.baseSondeo}</td>
                      {c ? <>
                        <td className="p-2 text-center">{fmt(c.asignaciones)}</td><td className="p-2 text-center">{fmt(c.lecturas)}</td>
                        <td className="p-2 text-center">{fmt(c.pendientes)}</td><td className="p-2 text-center">{(() => { const j = justificacionPara(acts, f.matricula, periodo, f.baseSondeo); return j && c.asignaciones ? <><Badge>No computa</Badge><br /><span className="text-muted-foreground">{fmtPct(c.porcentaje)} · {j.estado}</span></> : fmtPct(c.porcentaje); })()}</td>
                      </> : <td colSpan={4} className="p-2 text-center">
                        <span className="inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-destructive" />Discrepancia — revisar:</span>{' '}
                        Resumen {fmt(f.resumen!.lecturas)}/{fmt(f.resumen!.asignaciones)} · Detalle {fmt(f.detalle!.lecturas)}/{fmt(f.detalle!.asignaciones)}
                      </td>}
                      <td className="p-2 text-center">{f.detalle
                        ? <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setVer(f)} disabled={!f.pendientesDetalle.length}>{f.pendientesDetalle.length ? `${f.pendientesDetalle.length} pendiente(s)` : 'Todo leído'}</Button>
                        : <span className="text-muted-foreground">No se dispone del detalle</span>}</td>
                      <td className="p-2 text-center">{f.maestro ? <Link to={`/maquinistas/${f.maestro.id}`} className="text-primary underline">Ver ficha</Link> : '—'}</td>
                      <td className="p-2 text-center">{c
                        ? <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setMsg(f)}><Mail className="w-3 h-3" />Preparar{!f.maestro?.email && <span className="text-muted-foreground">(sin correo)</span>}</Button>
                        : <span className="text-muted-foreground">Revisar antes</span>}</td>
                    </tr>);
                })}</tbody>
              </table>
            </div>
          </>}
      </CardContent>
      <Dialog open={!!ver} onOpenChange={o => !o && setVer(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Documentos pendientes · {ver?.maestro ? `${ver.maestro.apellidos}, ${ver.maestro.nombre}` : ver?.nombreArchivo} ({ver?.matricula})</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0"><tr><th className="p-2 text-left">Referencia</th><th className="p-2 text-left">Título</th><th className="p-2">Estado</th></tr></thead>
              <tbody>{ver?.pendientesDetalle.map(p => <tr key={p.referencia} className="border-t"><td className="p-2 font-mono">{p.referencia}</td><td className="p-2">{p.titulo || '—'}</td><td className="p-2 text-center capitalize">{p.estado}</td></tr>)}</tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
      {msg && (() => {
        const c = cifras(msg)!;
        const nombre = msg.maestro ? `${msg.maestro.nombre} ${msg.maestro.apellidos}` : msg.nombreArchivo || msg.matricula;
        return <ComunicacionDialog open onClose={() => setMsg(null)}
          titulo={`Preparar mensaje al agente · ${nombre} (${msg.matricula})`} ambito="este agente"
          email={msg.maestro?.email || ''} asunto={asuntoAgente(msg.matricula, periodo)}
          cuerpo={mensajeAgente({ nombre, fecha: periodo, leidos: c.lecturas, total: c.asignaciones, pendientes: msg.detalle ? msg.pendientesDetalle : null })}
          anteriores={acts.filter(a => a.estado === 'Aviso enviado' && (a.matricula || '').trim() === msg.matricula && a.base_nombre === msg.baseSondeo)}
          registrar={async r => {
            const { error } = await (supabase.from('doc_actuaciones' as never) as any).insert({
              base_nombre: msg.baseSondeo, matricula: msg.matricula, nombre: msg.nombreArchivo || nombre, responsable: r.responsable,
              fecha_actuacion: r.fecha, fecha_comunicacion: r.fecha, canal: r.canal, estado: 'Aviso enviado', periodo, no_computa: false,
              comentario: `Comunicación de lectura (sondeo ${periodo.split('-').reverse().join('/')}): ${c.lecturas}/${c.asignaciones} leídos.${r.destinatario ? ' Destinatario: ' + r.destinatario + '.' : ''}`,
            });
            if (error?.code === '23505') return 'Este agente ya tiene una actuación registrada para este sondeo. Edítala en «Actuaciones» para añadir la comunicación.';
            if (error) return 'No se pudo registrar: ' + error.message;
            onChange?.(); return null;
          }} />;
      })()}
    </Card>
  );
}
