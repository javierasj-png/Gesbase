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
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, EyeOff, Train, Save } from 'lucide-react';
import { Base, BaseCertificacion, Certificacion } from '@/types';
import { certificacionesMock, baseCertificacionesMock } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

interface EditBaseCertificacionesModalProps {
  base: Base | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (baseId: Base, certificaciones: BaseCertificacion[]) => void;
}

interface CertificacionConfig {
  certificacion: Certificacion;
  asignada: boolean;
  vigilarVencimiento: boolean;
  periodoInactividadMeses: number;
  avisoDias: number;
  obligatoria: boolean;
}

export function EditBaseCertificacionesModal({
  base,
  open,
  onOpenChange,
  onSave,
}: EditBaseCertificacionesModalProps) {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<CertificacionConfig[]>([]);

  useEffect(() => {
    if (base && open) {
      // Initialize config for all active certifications
      const initialConfigs = certificacionesMock
        .filter(c => c.activo)
        .map(cert => {
          const existing = baseCertificacionesMock.find(
            bc => bc.baseId === base && bc.certificacionId === cert.id
          );
          return {
            certificacion: cert,
            asignada: !!existing,
            vigilarVencimiento: existing?.vigilarVencimiento ?? true,
            periodoInactividadMeses: existing?.periodoInactividadMeses ?? 12,
            avisoDias: existing?.avisoDias ?? 60,
            obligatoria: existing?.obligatoria ?? false,
          };
        });
      setConfigs(initialConfigs);
    }
  }, [base, open]);

  const handleToggleAsignada = (certId: string) => {
    setConfigs(prev =>
      prev.map(c =>
        c.certificacion.id === certId ? { ...c, asignada: !c.asignada } : c
      )
    );
  };

  const handleToggleVigilar = (certId: string) => {
    setConfigs(prev =>
      prev.map(c =>
        c.certificacion.id === certId
          ? { ...c, vigilarVencimiento: !c.vigilarVencimiento }
          : c
      )
    );
  };

  const handleToggleObligatoria = (certId: string) => {
    setConfigs(prev =>
      prev.map(c =>
        c.certificacion.id === certId ? { ...c, obligatoria: !c.obligatoria } : c
      )
    );
  };

  const handleChangePeriodo = (certId: string, value: number) => {
    const validValue = Math.max(1, Math.min(36, value));
    setConfigs(prev =>
      prev.map(c =>
        c.certificacion.id === certId
          ? { ...c, periodoInactividadMeses: validValue }
          : c
      )
    );
  };

  const handleChangeAviso = (certId: string, value: number) => {
    const validValue = Math.max(7, Math.min(180, value));
    setConfigs(prev =>
      prev.map(c =>
        c.certificacion.id === certId ? { ...c, avisoDias: validValue } : c
      )
    );
  };

  const handleSave = () => {
    if (!base) return;

    const nuevasAsignaciones: BaseCertificacion[] = configs
      .filter(c => c.asignada)
      .map(c => ({
        id: `bc-${base}-${c.certificacion.id}`,
        baseId: base,
        certificacionId: c.certificacion.id,
        vigilarVencimiento: c.vigilarVencimiento,
        periodoInactividadMeses: c.periodoInactividadMeses,
        avisoDias: c.avisoDias,
        obligatoria: c.obligatoria,
      }));

    onSave(base, nuevasAsignaciones);
    toast({
      title: 'Configuración guardada',
      description: `Se actualizaron ${nuevasAsignaciones.length} certificación(es) para ${base}`,
    });
    onOpenChange(false);
  };

  const asignadasCount = configs.filter(c => c.asignada).length;
  const vigiladasCount = configs.filter(c => c.asignada && c.vigilarVencimiento).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Train className="w-5 h-5 text-primary" />
            Editar Certificaciones - {base}
          </DialogTitle>
          <DialogDescription>
            Asigna certificaciones y configura la vigilancia de vencimiento por inactividad.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 text-sm text-muted-foreground py-2 border-b">
          <span>
            <strong>{asignadasCount}</strong> asignada(s)
          </span>
          <span>•</span>
          <span>
            <strong>{vigiladasCount}</strong> vigilada(s)
          </span>
        </div>

        <ScrollArea className="flex-1 max-h-[50vh] pr-4 -mr-4">
          <div className="space-y-3 py-2">
            {configs.map(config => (
              <div
                key={config.certificacion.id}
                className={`p-4 rounded-lg border transition-colors ${
                  config.asignada
                    ? 'bg-card border-border'
                    : 'bg-muted/30 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <Switch
                      checked={config.asignada}
                      onCheckedChange={() =>
                        handleToggleAsignada(config.certificacion.id)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-medium text-sm ${
                            !config.asignada ? 'text-muted-foreground' : ''
                          }`}
                        >
                          {config.certificacion.nombre}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">
                          {config.certificacion.tipo}
                        </Badge>
                      </div>
                      {config.certificacion.descripcion && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {config.certificacion.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {config.asignada && (
                  <div className="mt-4 pt-3 border-t border-dashed space-y-4">
                    {/* Vigilar vencimiento */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {config.vigilarVencimiento ? (
                          <Eye className="w-4 h-4 text-primary" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        )}
                        <Label className="text-sm">Vigilar vencimiento</Label>
                      </div>
                      <Switch
                        checked={config.vigilarVencimiento}
                        onCheckedChange={() =>
                          handleToggleVigilar(config.certificacion.id)
                        }
                      />
                    </div>

                    {config.vigilarVencimiento && (
                      <>
                        {/* Periodo inactividad */}
                        <div className="flex items-center justify-between gap-4">
                          <Label className="text-sm text-muted-foreground">
                            Periodo inactividad (meses)
                          </Label>
                          <Input
                            type="number"
                            min={1}
                            max={36}
                            value={config.periodoInactividadMeses}
                            onChange={e =>
                              handleChangePeriodo(
                                config.certificacion.id,
                                parseInt(e.target.value) || 12
                              )
                            }
                            className="w-20 h-8 text-center"
                          />
                        </div>

                        {/* Aviso días */}
                        <div className="flex items-center justify-between gap-4">
                          <Label className="text-sm text-muted-foreground">
                            Aviso anticipado (días)
                          </Label>
                          <Input
                            type="number"
                            min={7}
                            max={180}
                            value={config.avisoDias}
                            onChange={e =>
                              handleChangeAviso(
                                config.certificacion.id,
                                parseInt(e.target.value) || 60
                              )
                            }
                            className="w-20 h-8 text-center"
                          />
                        </div>
                      </>
                    )}

                    {/* Obligatoria */}
                    <div className="flex items-center justify-between">
                      <Label className="text-sm text-muted-foreground">
                        Obligatoria para esta base
                      </Label>
                      <Switch
                        checked={config.obligatoria}
                        onCheckedChange={() =>
                          handleToggleObligatoria(config.certificacion.id)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Guardar Cambios
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
