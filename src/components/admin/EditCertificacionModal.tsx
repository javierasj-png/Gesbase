import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Train, Save, Loader2 } from 'lucide-react';
import { CertificacionDB, CertificacionInput } from '@/hooks/useCertificaciones';

interface EditCertificacionModalProps {
  certificacion: CertificacionDB | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CertificacionInput, id?: string) => Promise<boolean>;
  isNew?: boolean;
}

export function EditCertificacionModal({
  certificacion,
  open,
  onOpenChange,
  onSave,
  isNew = false,
}: EditCertificacionModalProps) {
  const [id, setId] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<'vehiculo' | 'linea'>('vehiculo');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (certificacion && open) {
      setId(certificacion.id);
      setNombre(certificacion.nombre);
      setTipo(certificacion.tipo);
      setDescripcion(certificacion.descripcion || '');
    } else if (!certificacion && open) {
      // Nueva certificación
      setId('');
      setNombre('');
      setTipo('vehiculo');
      setDescripcion('');
    }
  }, [certificacion, open]);

  const handleSave = async () => {
    if (!nombre.trim() || (!certificacion && !id.trim())) return;

    setSaving(true);
    const input: CertificacionInput = {
      id: certificacion?.id || id.trim().toUpperCase(),
      nombre: nombre.trim(),
      tipo,
      descripcion: descripcion.trim() || null,
    };

    const success = await onSave(input, certificacion?.id);
    setSaving(false);

    if (success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Train className="w-5 h-5 text-primary" />
            {isNew ? 'Nueva Certificación' : 'Editar Certificación'}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? 'Añade una nueva certificación al catálogo'
              : 'Modifica los datos de la certificación'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isNew && (
            <div className="space-y-2">
              <Label htmlFor="id">ID (código único) *</Label>
              <Input
                id="id"
                value={id}
                onChange={(e) => setId(e.target.value.toUpperCase())}
                placeholder="Ej: S100, LAV-MAD"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Identificador único. Se convertirá a mayúsculas.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Serie 100 (AVE)"
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as 'vehiculo' | 'linea')}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vehiculo">Vehículo</SelectItem>
                <SelectItem value="linea">Línea</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Descripción opcional..."
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !nombre.trim() || (isNew && !id.trim())}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
