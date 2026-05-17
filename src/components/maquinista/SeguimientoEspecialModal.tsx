import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Loader2 } from 'lucide-react';
import { NuevoSeguimientoInput, Periodicidad, TipoPlanAcciones } from '@/hooks/useSeguimientosEspeciales';
import { useToast } from '@/hooks/use-toast';

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
  const [fechaFin, setFechaFin] = useState('');
  const [observaciones, setObservaciones] = useState('');

  const [emailTo, setEmailTo] = useState(maquinistaEmail || '');
  const [emailAsunto, setEmailAsunto] = useState(`Comunicación de anomalía — ${maquinistaNombre}`);
  const [emailCuerpo, setEmailCuerpo] = useState('');
  const [emailEnviado, setEmailEnviado] = useState(false);

  const [tipoPlan, setTipoPlan] = useState<TipoPlanAcciones>('ninguno');
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('mensual');

  const reset = () => {
    setMotivo(''); setPrever(''); setFechaAnomalia(today); setFechaInicio(today); setFechaFin('');
    setObservaciones(''); setEmailTo(maquinistaEmail || ''); setEmailAsunto(`Comunicación de anomalía — ${maquinistaNombre}`);
    setEmailCuerpo(''); setEmailEnviado(false); setTipoPlan('ninguno'); setPeriodicidad('mensual');
  };

  const abrirMailto = () => {
    const url = `mailto:${encodeURIComponent(emailTo)}?subject=${encodeURIComponent(emailAsunto)}&body=${encodeURIComponent(emailCuerpo)}`;
    window.open(url, '_blank');
    setEmailEnviado(true);
  };

  const handleSubmit = async () => {
    if (!motivo.trim()) { toast({ title: 'Falta motivo', variant: 'destructive' }); return; }
    if (tipoPlan !== 'ninguno' && !fechaFin) { toast({ title: 'Indica fecha fin para planificar', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await onCreate({
        maquinista_id: maquinistaId,
        motivo: motivo.trim(),
        indice_prever: prever ? Number(prever) : null,
        fecha_anomalia: fechaAnomalia || null,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || null,
        observaciones: observaciones || null,
        email_destinatario: emailTo || null,
        email_asunto: emailAsunto || null,
        email_cuerpo: emailCuerpo || null,
        marcar_email_enviado: emailEnviado,
        plan: { tipo: tipoPlan, periodicidad },
      });
      toast({ title: 'Seguimiento especial creado' });
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
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Motivo *</Label>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder="Descripción de la anomalía PREVER, suceso, etc." />
              </div>
              <div>
                <Label>Índice PREVER</Label>
                <Input type="number" step="0.01" value={prever} onChange={e => setPrever(e.target.value)} />
              </div>
              <div>
                <Label>Fecha anomalía</Label>
                <Input type="date" value={fechaAnomalia} onChange={e => setFechaAnomalia(e.target.value)} />
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

          {/* 3. Plan */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-primary">3. Plan de acciones (opcional)</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fecha inicio *</Label>
                <Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
              </div>
              <div>
                <Label>Tipo de acciones</Label>
                <Select value={tipoPlan} onValueChange={v => setTipoPlan(v as TipoPlanAcciones)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ninguno">Ninguno (solo registro)</SelectItem>
                    <SelectItem value="acompanamiento">Acompañamientos</SelectItem>
                    <SelectItem value="registro">Registros</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Periodicidad</Label>
                <Select value={periodicidad} onValueChange={v => setPeriodicidad(v as Periodicidad)} disabled={tipoPlan === 'ninguno'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quincenal">Quincenal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Observaciones</Label>
                <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} />
              </div>
            </div>
          </section>
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
