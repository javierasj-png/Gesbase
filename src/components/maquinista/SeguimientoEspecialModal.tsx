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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo seguimiento especial — {maquinistaNombre}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Anomalía */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">1. Anomalía detectada</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Índice PREVER - Gestión de anomalías</Label>
                <Input type="number" step="0.01" value={prever} onChange={e => setPrever(e.target.value)} />
              </div>
              <div>
                <Label>Fecha anomalía</Label>
                <Input type="date" value={fechaAnomalia} onChange={e => setFechaAnomalia(e.target.value)} />
              </div>
              <div>
                <Label>Fecha inicio seguimiento *</Label>
                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
              </div>
              <div className="col-span-3">
                <Label>Motivo *</Label>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Descripción de la anomalía PREVER, suceso, etc." />
              </div>
            </div>
          </section>

          {/* 2. Email */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">2. Comunicación al maquinista</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Destinatario</Label>
                <Input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
              </div>
              <div>
                <Label>Asunto</Label>
                <Input value={emailAsunto} onChange={e => setEmailAsunto(e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label>Cuerpo</Label>
                <Textarea value={emailCuerpo} onChange={e => setEmailCuerpo(e.target.value)} rows={4} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={abrirMailto} disabled={!emailTo}>
                <Mail className="w-4 h-4 mr-1" /> Abrir en cliente de correo
              </Button>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={emailEnviado} onCheckedChange={v => setEmailEnviado(!!v)} />
                Email enviado
              </label>
            </div>
          </section>

          {/* 3. Observaciones */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">3. Observaciones</h3>
            <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} />
          </section>

          <p className="text-xs text-muted-foreground border-t pt-3">
            El plan de acciones (acompañamientos / registros con periodicidad) podrá diseñarse opcionalmente en la ficha del seguimiento una vez creado.
          </p>
        </div>

        <DialogFooter>
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
