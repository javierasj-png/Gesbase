import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useInactividades, MotivoInactividad } from '@/hooks/useInactividades';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maquinista: { id: string; nombre_apellidos: string; activo: boolean } | null;
  onDone?: () => void;
}

const hoy = () => new Date().toISOString().split('T')[0];

export function CambioEstadoMaquinistaDialog({ open, onOpenChange, maquinista, onDone }: Props) {
  const { desactivar, reactivar } = useInactividades();
  const [motivo, setMotivo] = useState<MotivoInactividad>('baja_temporal');
  const [fecha, setFecha] = useState(hoy());
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  if (!maquinista) return null;
  const desactivando = maquinista.activo;

  const handleSave = async () => {
    setSaving(true);
    const ok = desactivando
      ? await desactivar(maquinista.id, motivo, new Date(fecha), observaciones)
      : await reactivar(maquinista.id, new Date(fecha));
    setSaving(false);
    if (ok) {
      setObservaciones('');
      setMotivo('baja_temporal');
      setFecha(hoy());
      onOpenChange(false);
      onDone?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {desactivando ? 'Pasar a inactivo' : 'Reincorporar maquinista'}: {maquinista.nombre_apellidos}
          </DialogTitle>
          <DialogDescription>
            {desactivando
              ? 'Mientras esté inactivo sus acciones quedan fuera de la planificación y de las alertas.'
              : 'Se recuperan sus planes y se justifican automáticamente las acciones vencidas durante la inactividad.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {desactivando && (
            <div className="space-y-2">
              <Label>Motivo</Label>
              <RadioGroup value={motivo} onValueChange={(v) => setMotivo(v as MotivoInactividad)}>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="baja_temporal" id="m-baja" />
                  <Label htmlFor="m-baja" className="font-normal">Baja temporal (volverá a la residencia)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="traslado_externo" id="m-traslado" />
                  <Label htmlFor="m-traslado" className="font-normal">Traslado fuera de la aplicación</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="fecha-estado">
              {desactivando ? 'Fecha de inicio de la inactividad' : 'Fecha de reincorporación'}
            </Label>
            <Input id="fecha-estado" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>

          {desactivando && (
            <div className="space-y-2">
              <Label htmlFor="obs-estado">Observaciones (opcional)</Label>
              <Textarea
                id="obs-estado"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !fecha}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {desactivando ? 'Pasar a inactivo' : 'Reincorporar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
