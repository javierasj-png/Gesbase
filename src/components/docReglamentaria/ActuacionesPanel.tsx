import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ESTADOS_ACTUACION, ESTADOS_JUSTIFICAN, CANALES, justificacionPara, type Actuacion } from '@/lib/docReglamentaria/justificaciones';

const fechaEs = (f: string | null) => (f ? f.split('-').reverse().join('/') : '—');
const hoy = () => new Date().toISOString().slice(0, 10);
type Form = { base_nombre: string; matricula: string; nombre: string; referencia: string; responsable: string; fecha_actuacion: string; fecha_comunicacion: string; canal: string; estado: string; vigencia_hasta: string; comentario: string; no_computa: boolean };

export function ActuacionesPanel({ acts, periodo, bases, baseFiltro, onChange, nueva }: { acts: Actuacion[]; periodo: string; bases: string[]; baseFiltro: string; onChange: () => void; nueva?: { base: string; matricula: string; nombre: string; n: number } | null }) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const responsableSesion = [profile?.nombre, profile?.apellidos].filter(Boolean).join(' ') || profile?.email || '';
  const [f, setF] = useState<Form | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const visibles = acts.filter(a => baseFiltro === 'all' || a.base_nombre === baseFiltro)
    .sort((a, b) => b.fecha_actuacion.localeCompare(a.fecha_actuacion) || b.created_at.localeCompare(a.created_at));

  const abrir = (a?: Actuacion, pre?: { base: string; matricula: string; nombre: string }) => {
    setEditId(a?.id || null);
    setF(a ? { base_nombre: a.base_nombre, matricula: a.matricula || '', nombre: a.nombre || '', referencia: a.referencia || '', responsable: a.responsable, fecha_actuacion: a.fecha_actuacion, fecha_comunicacion: a.fecha_comunicacion || '', canal: a.canal || '', estado: a.estado, vigencia_hasta: a.vigencia_hasta || '', comentario: a.comentario || '', no_computa: a.no_computa }
      : { base_nombre: pre?.base || (baseFiltro !== 'all' ? baseFiltro : bases[0] || ''), matricula: pre?.matricula || '', nombre: pre?.nombre || '', referencia: '', responsable: responsableSesion, fecha_actuacion: hoy(), fecha_comunicacion: '', canal: '', estado: 'Seguimiento ordinario', vigencia_hasta: '', comentario: '', no_computa: false });
  };
  useEffect(() => {
    if (!nueva) return;
    const existente = acts.find(a => a.base_nombre === nueva.base && a.matricula === nueva.matricula && a.periodo === periodo);
    abrir(existente, nueva);
  }, [nueva?.n]);
  const set = (p: Partial<Form>) => setF(x => (x ? { ...x, ...p } : x));

  const guardar = async () => {
    if (!f) return;
    const v = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x])) as Form;
    const err = !v.base_nombre || !v.responsable ? 'Indica base y responsable.'
      : v.no_computa && !v.matricula ? 'La justificación que no computa debe indicar la matrícula del maquinista.'
      : v.nombre && !v.matricula ? 'Indica la matrícula para vincular la actuación a una persona.'
      : v.fecha_actuacion > hoy() ? 'La fecha de actuación no puede ser futura.'
      : v.vigencia_hasta && v.vigencia_hasta < v.fecha_actuacion ? 'La revisión no puede ser anterior a la actuación.'
      : v.fecha_comunicacion && (v.fecha_comunicacion > v.fecha_actuacion || v.fecha_comunicacion > hoy()) ? 'La comunicación no puede ser posterior a la actuación ni a hoy.'
      : !!v.fecha_comunicacion !== !!v.canal ? 'Indica fecha y canal de la comunicación, o deja ambos vacíos.'
      : ['Aviso enviado', 'Anomalía comunicada'].includes(v.estado) && !v.fecha_comunicacion ? 'Indica la fecha real de comunicación.' : '';
    if (err) return toast({ title: err, variant: 'destructive' });
    const row = { ...v, matricula: v.matricula || null, nombre: v.nombre || null, referencia: v.referencia || null, fecha_comunicacion: v.fecha_comunicacion || null, canal: v.canal || null, vigencia_hasta: v.vigencia_hasta || null, comentario: v.comentario || null };
    setSaving(true);
    const t = supabase.from('doc_actuaciones' as never);
    const { error } = editId ? await (t as any).update(row).eq('id', editId) : await (t as any).insert({ ...row, periodo });
    setSaving(false);
    if (error) return toast({ title: 'No se ha guardado', description: error.message.includes('doc_act_una_por_sondeo') ? 'Este maquinista ya tiene una acción en este sondeo: edítala.' : error.message, variant: 'destructive' });
    setF(null); onChange(); toast({ title: editId ? 'Actuación actualizada' : 'Actuación registrada' });
  };
  const borrar = async (a: Actuacion) => {
    if (!confirm('¿Borrar esta actuación?')) return;
    const { error, count } = await (supabase.from('doc_actuaciones' as never) as any).delete({ count: 'exact' }).eq('id', a.id);
    if (error || !count) return toast({ title: 'No se ha borrado', description: error?.message || 'Solo quien la creó o un gestor de la base puede borrarla.', variant: 'destructive' });
    onChange();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div><CardTitle className="text-base">Actuaciones y justificaciones</CardTitle>
          <p className="text-xs text-muted-foreground">Se guardan aparte de las lecturas: reimportar un sondeo no las borra. Las marcadas «No computa» restan las asignaciones del maquinista en los resultados de su base mientras estén vigentes. Se registran desde la tabla de maquinistas.</p></div>
      </CardHeader>
      <CardContent>
        {!visibles.length ? <p className="text-sm text-muted-foreground text-center py-4">No hay actuaciones registradas.</p> : (
          <div className="overflow-x-auto border rounded-md max-h-[420px]">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0"><tr>
                <th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Base / agente</th><th className="p-2 text-left">Estado</th><th className="p-2 text-left">Comentario</th>
                <th className="p-2 text-left">Responsable</th><th className="p-2">Revisión hasta</th><th className="p-2">En sondeo {fechaEs(periodo)}</th><th className="p-2 text-left">Registro</th><th className="p-2"></th>
              </tr></thead>
              <tbody>{visibles.map(a => {
                const vig = a.matricula && a.no_computa ? justificacionPara([a], a.matricula, periodo) : null;
                return (
                  <tr key={a.id} className="border-t align-top">
                    <td className="p-2 whitespace-nowrap">{fechaEs(a.fecha_actuacion)}</td>
                    <td className="p-2">{a.base_nombre}<br /><span className="text-muted-foreground">{a.matricula ? `${a.matricula}${a.nombre ? ' · ' + a.nombre : ''}` : 'Toda la base'}{a.referencia ? ` · ${a.referencia}` : ''}</span></td>
                    <td className="p-2">{a.estado}{a.fecha_comunicacion && <><br /><span className="text-muted-foreground">Comunicado {fechaEs(a.fecha_comunicacion)} · {a.canal}</span></>}</td>
                    <td className="p-2 max-w-[260px] whitespace-pre-wrap">{a.comentario || '—'}</td>
                    <td className="p-2">{a.responsable}</td>
                    <td className="p-2 text-center">{fechaEs(a.vigencia_hasta)}</td>
                    <td className="p-2 text-center">{!a.no_computa ? <span className="text-muted-foreground">Computa</span> : vig ? <Badge>No computa</Badge> : <Badge variant="outline">No vigente</Badge>}</td>
                    <td className="p-2 text-muted-foreground whitespace-nowrap">Creada {new Date(a.created_at).toLocaleDateString('es-ES')}{a.updated_by && <><br />Modif. {new Date(a.updated_at).toLocaleDateString('es-ES')}</>}</td>
                    <td className="p-2 whitespace-nowrap"><Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => abrir(a)} aria-label="Editar"><Pencil className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => borrar(a)} aria-label="Borrar"><Trash2 className="w-3 h-3" /></Button></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>)}
      </CardContent>

      <Dialog open={!!f} onOpenChange={o => !o && setF(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editId ? 'Editar acción del sondeo' : `Acción o justificación · sondeo ${fechaEs(periodo)}`}</DialogTitle></DialogHeader>
          {f && <div className="grid gap-3 md:grid-cols-2 text-sm">
            <div><label className="text-xs text-muted-foreground">Base de conducción</label>
              <Select value={f.base_nombre} onValueChange={v => set({ base_nombre: v })} disabled={!!editId}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{bases.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">Estado</label>
              <Select value={f.estado} onValueChange={v => set({ estado: v, no_computa: ESTADOS_JUSTIFICAN.includes(v) })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS_ACTUACION.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
              <p className="text-[11px] text-muted-foreground mt-1">No indiques el motivo personal (salud, vacaciones…). Situaciones de larga duración, como liberado sindical, van como exclusión validada sin fecha de revisión.</p></div>
            <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Resultados del sondeo</label>
              <Select value={f.no_computa ? 'no' : 'si'} onValueChange={v => set({ no_computa: v === 'no' })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="si">Computa: su lectura cuenta en los resultados de la base</SelectItem><SelectItem value="no">No computa: justificado, se resta de los resultados de la base</SelectItem></SelectContent></Select>
              {!f.matricula && <p className="text-xs text-muted-foreground mt-1">Una acción sin matrícula no cambia los resultados.</p>}</div>
            <div><label className="text-xs text-muted-foreground">Matrícula (vacío = toda la base)</label><Input value={f.matricula} readOnly={!!editId} onChange={e => set({ matricula: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Nombre del maquinista</label><Input value={f.nombre} onChange={e => set({ nombre: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Responsable</label><Input maxLength={150} value={f.responsable} onChange={e => set({ responsable: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Fecha de actuación</label><Input type="date" max={hoy()} value={f.fecha_actuacion} onChange={e => set({ fecha_actuacion: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Fecha de comunicación</label><Input type="date" max={hoy()} value={f.fecha_comunicacion} onChange={e => set({ fecha_comunicacion: e.target.value })} /></div>
            <div><label className="text-xs text-muted-foreground">Canal de comunicación</label>
              <Select value={f.canal || 'none'} onValueChange={v => set({ canal: v === 'none' ? '' : v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Sin comunicación</SelectItem>{CANALES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">Revisión / vigencia hasta (opcional)</label><Input type="date" value={f.vigencia_hasta} onChange={e => set({ vigencia_hasta: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-xs text-muted-foreground">Comentario</label><Textarea rows={3} maxLength={4000} placeholder="Situación o actuación realizada. No incluyas detalles médicos." value={f.comentario} onChange={e => set({ comentario: e.target.value })} /></div>
            <p className="md:col-span-2 text-xs text-muted-foreground">Cada maquinista tiene una acción por sondeo.</p>
          </div>}
          <DialogFooter><Button onClick={guardar} disabled={saving}>{editId ? 'Guardar cambios' : 'Guardar actuación'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
