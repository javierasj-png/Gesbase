import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Train, Eye, EyeOff, Calendar } from 'lucide-react';
import { useMaquinistaCertificaciones, CertificacionDisponible } from '@/hooks/useMaquinistaCertificaciones';
import { format } from 'date-fns';

interface MaquinistaCertificacionesModalProps {
  maquinistaId: string | null;
  maquinistaNombre: string;
  baseName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CertConfig {
  certificacion_id: string;
  nombre: string;
  tipo: 'vehiculo' | 'linea';
  asignada: boolean;
  obligatoria: boolean;
  vigilar_vencimiento: boolean;
  periodo_inactividad_meses: number;
  aviso_dias: number;
  fecha_ultimo_servicio: string | null;
}

export function MaquinistaCertificacionesModal({
  maquinistaId,
  maquinistaNombre,
  baseName,
  open,
  onOpenChange,
}: MaquinistaCertificacionesModalProps) {
  const { disponibles, loading, toggleObtenida, actualizarFechaServicio, refetch } = useMaquinistaCertificaciones(
    open ? maquinistaId : null,
    open ? baseName : null
  );
  
  const [configs, setConfigs] = useState<CertConfig[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && disponibles.length > 0) {
      setConfigs(disponibles.map(d => ({
        certificacion_id: d.id,
        nombre: d.nombre,
        tipo: d.tipo,
        asignada: d.asignada,
        obligatoria: d.obligatoria,
        vigilar_vencimiento: d.vigilar_vencimiento,
        periodo_inactividad_meses: d.periodo_inactividad_meses,
        aviso_dias: d.aviso_dias,
        fecha_ultimo_servicio: d.fecha_ultimo_servicio,
      })));
    }
  }, [open, disponibles]);

  const handleToggleAsignada = (certId: string) => {
    setConfigs(prev => prev.map(c =>
      c.certificacion_id === certId ? { ...c, asignada: !c.asignada } : c
    ));
  };

  const handleFechaChange = (certId: string, fecha: string) => {
    setConfigs(prev => prev.map(c =>
      c.certificacion_id === certId ? { ...c, fecha_ultimo_servicio: fecha || null } : c
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    
    // For each config, toggle obtenida or update fecha
    for (const config of configs) {
      const disp = disponibles.find(d => d.id === config.certificacion_id);
      const wasAsignada = disp?.asignada ?? false;
      
      if (config.asignada !== wasAsignada) {
        await toggleObtenida(config.certificacion_id, config.asignada);
      }
      
      if (config.asignada && config.fecha_ultimo_servicio) {
        await actualizarFechaServicio(config.certificacion_id, config.fecha_ultimo_servicio);
      }
    }
    
    await refetch();
    setSaving(false);
    onOpenChange(false);
  };

  const vehiculos = configs.filter(c => c.tipo === 'vehiculo');
  const lineas = configs.filter(c => c.tipo === 'linea');
  const asignadas = configs.filter(c => c.asignada);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Certificaciones de {maquinistaNombre}</DialogTitle>
          <DialogDescription>
            Asigna las certificaciones obtenidas y registra la fecha del último servicio para control de vencimiento
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-4 -mx-6 px-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando certificaciones...</span>
            </div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Train className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay certificaciones disponibles en el catálogo.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vehículos */}
              {vehiculos.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2 sticky top-0 bg-background py-1">
                    <Badge variant="outline">Vehículos</Badge>
                    <span className="text-muted-foreground">
                      ({vehiculos.filter(v => v.asignada).length}/{vehiculos.length})
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {vehiculos.map(cert => (
                      <CertificacionRow
                        key={cert.certificacion_id}
                        cert={cert}
                        onToggleAsignada={() => handleToggleAsignada(cert.certificacion_id)}
                        onFechaChange={(fecha) => handleFechaChange(cert.certificacion_id, fecha)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Líneas */}
              {lineas.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2 sticky top-0 bg-background py-1">
                    <Badge variant="outline">Líneas</Badge>
                    <span className="text-muted-foreground">
                      ({lineas.filter(l => l.asignada).length}/{lineas.length})
                    </span>
                  </h4>
                  <div className="space-y-2">
                    {lineas.map(cert => (
                      <CertificacionRow
                        key={cert.certificacion_id}
                        cert={cert}
                        onToggleAsignada={() => handleToggleAsignada(cert.certificacion_id)}
                        onFechaChange={(fecha) => handleFechaChange(cert.certificacion_id, fecha)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t pt-4 -mx-6 px-6 bg-background">
          <p className="text-sm text-muted-foreground mb-4">
            {asignadas.length} certificación(es) asignada(s)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Fila de certificación
interface CertificacionRowProps {
  cert: CertConfig;
  onToggleAsignada: () => void;
  onFechaChange: (fecha: string) => void;
}

function CertificacionRow({ cert, onToggleAsignada, onFechaChange }: CertificacionRowProps) {
  return (
    <div className={`p-3 rounded-lg border transition-colors ${cert.asignada ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-transparent'}`}>
      <div className="flex items-center gap-3">
        <Switch
          checked={cert.asignada}
          onCheckedChange={onToggleAsignada}
        />
        <div className="flex-1">
          <span className={`text-sm ${cert.asignada ? 'font-medium' : 'text-muted-foreground'}`}>
            {cert.nombre}
          </span>
          <div className="flex items-center gap-2 mt-0.5">
            {cert.obligatoria && (
              <Badge variant="secondary" className="text-[10px] h-4">Obligatoria</Badge>
            )}
            {cert.vigilar_vencimiento ? (
              <span className="flex items-center gap-1 text-[10px] text-amber-600">
                <Eye className="w-3 h-3" />
                Vigila {cert.periodo_inactividad_meses}m
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <EyeOff className="w-3 h-3" />
                Sin vigilancia
              </span>
            )}
          </div>
        </div>
      </div>

      {cert.asignada && cert.vigilar_vencimiento && (
        <div className="ml-10 mt-3 flex items-center gap-3">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Últ. renovación:
          </Label>
          <Input
            type="date"
            value={cert.fecha_ultimo_servicio || ''}
            onChange={(e) => onFechaChange(e.target.value)}
            className="h-8 w-40 text-sm"
            max={format(new Date(), 'yyyy-MM-dd')}
          />
        </div>
      )}
    </div>
  );
}
