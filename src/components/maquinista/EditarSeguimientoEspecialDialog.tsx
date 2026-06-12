import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { SeguimientoEspecial } from '@/hooks/useSeguimientosEspeciales';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  seguimiento: SeguimientoEspecial | null;
  onSave: (id: string, cambios: any) => Promise<unknown>;
}

export function EditarSeguimientoEspecialDialog({ open, onOpenChange, seguimiento, onSave }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [motivo, setMotivo] = useState('');
  const [prever, setPrever] = useState('');
  const [fechaAnomalia, setFechaAnomalia] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailAsunto, setEmailAsunto] = useState('');
  const [emailCuerpo, setEmailCuerpo] = useState('');
  const [emailEnviado, setEmailEnviado] = useState(false);

  useEffect(() => {
    if (!seguimiento) return;
    setMotivo(seguimiento.motivo || '');
    setPrever(seguimiento.indice_prever != null ? String(seguimiento.indice_prever) : '');
    setFechaAnomalia(seguimiento.fecha_anomalia || '');
    setFechaInicio(seguimiento.fecha_inicio || '');
    setObservaciones(seguimiento.observaciones || '');
    setEmailTo(seguimiento.email_destinatario || '');
    setEmailAsunto(seguimiento.email_asunto || '');
    setEmailCuerpo(seguimiento.email_cuerpo || '');
    setEmailEnviado(!!seguimiento.email_enviado_at);
  }, [seguimiento]);

  if (!seguimiento) return null;

  const abrirMailto = () => {
    const url = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailAsunto)}&body=${encodeURIComponent(emailCuerpo)}`;
    window.open(url, '_blank');
    setEmailEnviado(true);
  };

  const handleSave = async () => {
    if (!motivo.trim()) { toast({ title: 'Falta motivo', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const prevEnviado = !!seguimiento.email_enviado_at;
      const cambios: any = {
        motivo: motivo.trim(),
        indice_prever: prever ? Number(prever) : null,
        fecha_anomalia: fechaAnomalia || null,
        fecha_inicio: fechaInicio,
        observaciones: observaciones || null,
        email_destinatario: emailTo || null,
        email_asunto: emailAsunto || null,
        email_cuerpo: emailCuerpo || null,
      };
      if (emailEnviado !== prevEnviado) {
        cambios.marcar_email_enviado = emailEnviado;
      }
      await onSave(seguimiento.id, cambios);
      toast({ title: 'Seguimiento actualizado' });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error al guardar', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <DialogTitle className="text-lg">Editar seguimiento especial</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          <section className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-primary">Anomalía</h3>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-3">
                <Label className="text-xs">Índice PREVER</Label>
                <Input type="number" step="0.01" value={prever} onChange={e => setPrever(e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label className="text-xs">Fecha anomalía</Label>
                <Input type="date" value={fechaAnomalia} onChange={e => setFechaAnomalia(e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label className="text-xs">Fecha inicio *</Label>
                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-12">
                <Label className="text-xs">Motivo *</Label>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} className="mt-1 resize-none" />
              </div>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary">Comunicación</h3>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={emailEnviado} onCheckedChange={v => setEmailEnviado(!!v)} />
                Marcar como enviado
              </label>
            </div>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-5">
                <Label className="text-xs">Destinatario</Label>
                <Input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-12 md:col-span-7">
                <Label className="text-xs">Asunto</Label>
                <Input value={emailAsunto} onChange={e => setEmailAsunto(e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-12">
                <Label className="text-xs">Cuerpo</Label>
                <Textarea value={emailCuerpo} onChange={e => setEmailCuerpo(e.target.value)} rows={6} className="mt-1 resize-none" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" variant="secondary" size="sm" onClick={abrirMailto} disabled={!emailTo}>
                <Mail className="w-4 h-4 mr-1" /> Abrir en cliente de correo
              </Button>
            </div>
          </section>

          <section className="rounded-lg border bg-card p-5 space-y-3 shadow-sm">
            <h3 className="text-sm font-semibold text-primary">Observaciones</h3>
            <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} className="resize-none" />
          </section>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
