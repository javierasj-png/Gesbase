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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Train, Save } from 'lucide-react';
import { Certificacion, TipoCertificacion } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface EditCertificacionModalProps {
  certificacion: Certificacion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (certificacion: Certificacion) => void;
}

export function EditCertificacionModal({
  certificacion,
  open,
  onOpenChange,
  onSave,
}: EditCertificacionModalProps) {
  const { toast } = useToast();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoCertificacion>('vehiculo');
  const [descripcion, setDescripcion] = useState('');
  const [activo, setActivo] = useState(true);

  useEffect(() => {
    if (certificacion && open) {
      setNombre(certificacion.nombre);
      setTipo(certificacion.tipo);
      setDescripcion(certificacion.descripcion || '');
      setActivo(certificacion.activo);
    } else if (!certificacion && open) {
      // Nueva certificación
      setNombre('');
      setTipo('vehiculo');
      setDescripcion('');
      setActivo(true);
    }
  }, [certificacion, open]);

  const handleSave = () => {
    if (!nombre.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre es obligatorio',
        variant: 'destructive',
      });
      return;
    }

    const updated: Certificacion = {
      id: certificacion?.id || `c-${Date.now()}`,
      nombre: nombre.trim(),
      tipo,
      descripcion: descripcion.trim() || undefined,
      activo,
    };

    onSave(updated);
    toast({
      title: certificacion ? 'Certificación actualizada' : 'Certificación creada',
      description: `"${updated.nombre}" guardada correctamente`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Train className="w-5 h-5 text-primary" />
            {certificacion ? 'Editar Certificación' : 'Nueva Certificación'}
          </DialogTitle>
          <DialogDescription>
            {certificacion
              ? 'Modifica los datos de la certificación'
              : 'Añade una nueva certificación al catálogo'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCertificacion)}>
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

          <div className="flex items-center justify-between">
            <Label htmlFor="activo">Activa</Label>
            <Switch
              id="activo"
              checked={activo}
              onCheckedChange={setActivo}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
