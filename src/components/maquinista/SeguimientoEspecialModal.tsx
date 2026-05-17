import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Loader2, Sparkles } from 'lucide-react';
import { NuevoSeguimientoInput } from '@/hooks/useSeguimientosEspeciales';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  maquinistaId: string;
  maquinistaNombre: string;
  maquinistaEmail?: string | null;
  onCreate: (input: NuevoSeguimientoInput) => Promise<unknown>;
}

export function SeguimientoEspecialModal({ open, onOpenChange, maquinistaId, maquinistaNombre, maquinistaEmail, onCreate }: Props) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const [saving, setSaving] = useState(false);
  const [generandoIA, setGenerandoIA] = useState(false);

  const [motivo, setMotivo] = useState('');
  const [prever, setPrever] = useState('');
  const [fechaAnomalia, setFechaAnomalia] = useState(today);
  const [fechaInicio, setFechaInicio] = useState(today);
  const [observaciones, setObservaciones] = useState('');

  const [emailTo, setEmailTo] = useState(maquinistaEmail || '');
  const [emailAsunto, setEmailAsunto] = useState(`Comunicación de anomalía — ${maquinistaNombre}`);
  const [emailCuerpo, setEmailCuerpo] = useState('');
  const [emailEnviado, setEmailEnviado] = useState(false);

  const reset = () => {
    setMotivo(''); setPrever(''); setFechaAnomalia(today); setFechaInicio(today);
    setObservaciones(''); setEmailTo(maquinistaEmail || ''); setEmailAsunto(`Comunicación de anomalía — ${maquinistaNombre}`);
    setEmailCuerpo(''); setEmailEnviado(false);
  };

  const abrirMailto = () => {
    const url = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailAsunto)}&body=${encodeURIComponent(emailCuerpo)}`;
    window.open(url, '_blank');
    setEmailEnviado(true);
  };

  const generarCuerpoIA = async () => {
    if (!motivo.trim()) {
      toast({ title: 'Indica primero el motivo de la anomalía', variant: 'destructive' });
      return;
    }
    setGenerandoIA(true);
    try {
      const { data, error } = await supabase.functions.invoke('generar-email-anomalia', {
        body: {
          maquinista: maquinistaNombre,
          motivo: motivo.trim(),
          indice_prever: prever || null,
          fecha_anomalia: fechaAnomalia || null,
        },
      });
      if (error) throw error;
      if (data?.body) {
        setEmailCuerpo(data.body);
        toast({ title: 'Cuerpo generado por IA' });
      } else if (data?.error) {
        toast({ title: 'IA no disponible', description: data.error, variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Error generando con IA', description: e?.message, variant: 'destructive' });
    } finally {
      setGenerandoIA(false);
    }
  };

  const handleSubmit = async () => {
    if (!motivo.trim()) { toast({ title: 'Falta motivo', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await onCreate({
        maquinista_id: maquinistaId,
        motivo: motivo.trim(),
        indice_prever: prever ? Number(prever) : null,
        fecha_anomalia: fechaAnomalia || null,
        fecha_inicio: fechaInicio,
        fecha_fin: null,
        observaciones: observaciones || null,
        email_destinatario: emailTo || null,
        email_asunto: emailAsunto || null,
        email_cuerpo: emailCuerpo || null,
        marcar_email_enviado: emailEnviado,
      });
      toast({ title: 'Seguimiento especial creado', description: 'Puedes diseñar un plan de acciones desde la ficha.' });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error al crear', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <DialogTitle className="text-lg">
            Nuevo seguimiento especial
            <span className="text-muted-foreground font-normal"> — {maquinistaNombre}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* 1. Anomalía */}
          <section className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">1</span>
              <h3 className="text-sm font-semibold text-primary">Anomalía detectada</h3>
            </div>
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-3">
                <Label className="text-xs">Índice PREVER - Gestión de anomalías</Label>
                <Input type="number" step="0.01" value={prever} onChange={e => setPrever(e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label className="text-xs">Fecha anomalía</Label>
                <Input type="date" value={fechaAnomalia} onChange={e => setFechaAnomalia(e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label className="text-xs">Fecha inicio seguimiento *</Label>
                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="mt-1" />
              </div>
              <div className="col-span-12">
                <Label className="text-xs">Motivo *</Label>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3} placeholder="Descripción de la anomalía PREVER, suceso, etc." className="mt-1 resize-none" />
              </div>
            </div>
          </section>

          {/* 2. Email */}
          <section className="rounded-lg border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">2</span>
                <h3 className="text-sm font-semibold text-primary">Comunicación al maquinista</h3>
              </div>
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
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Cuerpo del mensaje</Label>
                  <Button type="button" variant="outline" size="sm" onClick={generarCuerpoIA} disabled={generandoIA} className="h-7 text-xs">
                    {generandoIA ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    Generar con IA
                  </Button>
                </div>
                <Textarea value={emailCuerpo} onChange={e => setEmailCuerpo(e.target.value)} rows={7} placeholder="Pulsa 'Generar con IA' o redacta manualmente." className="resize-none" />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={abrirMailto} disabled={!emailTo}>
                <Mail className="w-4 h-4 mr-1" /> Abrir en cliente de correo
              </Button>
            </div>
          </section>

          {/* 3. Observaciones */}
          <section className="rounded-lg border bg-card p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">3</span>
              <h3 className="text-sm font-semibold text-primary">Observaciones</h3>
            </div>
            <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} placeholder="Notas internas adicionales..." className="resize-none" />
          </section>

          <p className="text-xs text-muted-foreground italic">
            El plan de acciones (acompañamientos / registros con periodicidad) podrá diseñarse opcionalmente en la ficha del seguimiento una vez creado.
          </p>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear seguimiento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
