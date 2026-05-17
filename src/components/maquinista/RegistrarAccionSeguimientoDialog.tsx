import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import type { AccionSeguimiento, TipoAccionSeg } from '@/hooks/useSeguimientosEspeciales';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  accion: AccionSeguimiento | null;
  onSubmit: (
    accionId: string,
    fechaReal: string,
    extras: { observaciones?: string | null; indice_prever?: number | null; tipo?: TipoAccionSeg }
  ) => Promise<void> | void;
}

const tipoLabels: Record<TipoAccionSeg, string> = {
  acompanamiento: 'Acompañamiento',
  registro: 'Registro de conducción',
  formativa: 'Acción formativa',
};

export function RegistrarAccionSeguimientoDialog({ open, onOpenChange, accion, onSubmit }: Props) {
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [tipo, setTipo] = useState<TipoAccionSeg>('acompanamiento');
  const [indicePrever, setIndicePrever] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && accion) {
      setFecha(format(new Date(), 'yyyy-MM-dd'));
      setTipo(accion.tipo);
      setIndicePrever('');
      setObservaciones('');
    }
  }, [open, accion]);

  if (!accion) return null;

  const handleSave = async () => {
    if (!fecha) return;
    setSaving(true);
    try {
      const prever = indicePrever ? parseFloat(indicePrever.replace(',', '.')) : null;
      await onSubmit(accion.id, fecha, {
        observaciones: observaciones || null,
        indice_prever: Number.isFinite(prever as number) ? prever : null,
        tipo,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Registrar Actuación — Seguimiento Especial
          </DialogTitle>
          <DialogDescription>
            Registra la actuación realizada en el plan de seguimiento especial.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Fecha *</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de actuación *</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as TipoAccionSeg)}>
              <SelectTrigger><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
              <SelectContent>
                {(['acompanamiento', 'registro', 'formativa'] as TipoAccionSeg[]).map(t => (
                  <SelectItem key={t} value={t}>{tipoLabels[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Índice PREVER <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input type="text" value={indicePrever} onChange={e => setIndicePrever(e.target.value)} placeholder="Ej: 4.5" />
          </div>
          <div className="space-y-2">
            <Label>Observaciones <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!fecha || saving}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
