import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CANALES, type Actuacion } from '@/lib/docReglamentaria/justificaciones';
import { mailto } from '@/lib/docReglamentaria/comunicaciones';

const hoy = () => new Date().toISOString().slice(0, 10);
const fechaEs = (f: string) => f.split('-').reverse().join('/');

export interface ComunicacionProps {
  open: boolean; onClose: () => void;
  titulo: string; ambito: string; email: string; asunto: string; cuerpo: string;
  anteriores: Actuacion[];
  /** Guarda el registro. Devuelve mensaje de error o null. */
  registrar: (r: { fecha: string; canal: string; responsable: string; destinatario: string }) => Promise<string | null>;
}

export function ComunicacionDialog(p: ComunicacionProps) {
  const [email, setEmail] = useState(p.email);
  const [cuerpo, setCuerpo] = useState(p.cuerpo);
  const [fecha, setFecha] = useState(hoy());
  const [canal, setCanal] = useState(CANALES[0]);
  const [resp, setResp] = useState('');
  const [dest, setDest] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!p.open) return;
    setEmail(p.email); setCuerpo(p.cuerpo); setFecha(hoy()); setCanal(CANALES[0]); setDest(p.email);
    supabase.auth.getUser().then(({ data }) => setResp(r => r || data.user?.email || ''));
  }, [p.open, p.email, p.cuerpo]);

  const copiar = async () => {
    try { await navigator.clipboard.writeText(cuerpo); toast.success('Mensaje copiado.'); }
    catch { toast.info('No se pudo copiar. Selecciona el texto y pulsa Ctrl+C.'); }
  };
  const abrir = () => {
    const r = mailto(email, p.asunto, cuerpo);
    if ('error' in r) return toast.error(r.error);
    window.location.href = r.href; // No registra nada
  };
  const guardar = async () => {
    if (!fecha || !resp.trim()) return toast.error('Indica fecha y responsable.');
    if (fecha > hoy()) return toast.error('La fecha no puede ser posterior a hoy.');
    setSaving(true);
    const err = await p.registrar({ fecha, canal, responsable: resp.trim(), destinatario: dest.trim() });
    setSaving(false);
    if (err) return toast.error(err);
    toast.success('Comunicación registrada.'); p.onClose();
  };

  return (
    <Dialog open={p.open} onOpenChange={o => !o && p.onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{p.titulo}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Mensaje generado con los datos del sondeo para {p.ambito}. Revísalo antes de copiarlo o abrir el correo. No se envía nada automáticamente.</p>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground">Correo del destinatario (opcional)</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Sin correo registrado" /></div>
          <div><label className="text-xs text-muted-foreground">Asunto</label><Input value={p.asunto} readOnly /></div>
          <div><label className="text-xs text-muted-foreground">Mensaje</label>
            <Textarea rows={12} value={cuerpo} onChange={e => setCuerpo(e.target.value)} className="font-mono text-xs" /></div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={copiar}>Copiar mensaje</Button>
            <Button onClick={abrir} disabled={!email.trim()}>Abrir correo</Button>
          </div>
          {!email.trim() && <p className="text-xs text-muted-foreground text-right">Sin correo: copia el mensaje o comunícalo por otro canal.</p>}
        </div>
        <div className="border-t pt-3 space-y-3">
          <p className="font-medium text-sm">Registrar la comunicación</p>
          <p className="text-xs text-muted-foreground">Abrir el correo no la marca como realizada. Regístrala cuando la hayas hecho.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="text-xs text-muted-foreground">Fecha de comunicación</label><Input type="date" max={hoy()} value={fecha} onChange={e => setFecha(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Canal</label>
              <Select value={canal} onValueChange={setCanal}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CANALES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">Responsable</label><Input maxLength={150} value={resp} onChange={e => setResp(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Destinatario (opcional)</label><Input maxLength={200} value={dest} onChange={e => setDest(e.target.value)} /></div>
          </div>
          <div className="flex justify-end"><Button onClick={guardar} disabled={saving}>Registrar comunicación</Button></div>
          {p.anteriores.length > 0 && <p className="text-xs text-muted-foreground">Comunicaciones anteriores: {p.anteriores.slice(0, 5).map(a => `${fechaEs(a.fecha_comunicacion || a.fecha_actuacion)} (${a.canal || '—'})`).join(' · ')}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
