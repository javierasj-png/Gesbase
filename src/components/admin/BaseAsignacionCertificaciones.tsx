import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, EyeOff, Pencil, Loader2, Building2, Train } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { certificacionesMock } from '@/data/mockData';

interface BaseConduccion {
  id: string;
  nombre: string;
  codigo: string | null;
  activa: boolean;
}

interface CertificacionAsignada {
  id: string;
  base_id: string;
  certificacion_id: string;
  certificacion_nombre: string;
  certificacion_tipo: string;
  obligatoria: boolean;
  vigilar_vencimiento: boolean;
  periodo_inactividad_meses: number;
  aviso_dias: number;
}

export function BaseAsignacionCertificaciones() {
  const { toast } = useToast();
  const [bases, setBases] = useState<BaseConduccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBase, setEditingBase] = useState<BaseConduccion | null>(null);
  const [asignaciones, setAsignaciones] = useState<Record<string, CertificacionAsignada[]>>({});

  useEffect(() => {
    fetchBases();
  }, []);

  const fetchBases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bases_conduccion')
        .select('*')
        .eq('activa', true)
        .order('nombre');

      if (error) throw error;
      setBases(data || []);

      // Por ahora usamos datos mock para las asignaciones
      // En el futuro esto vendrá de la tabla base_certificaciones
      const mockAsignaciones: Record<string, CertificacionAsignada[]> = {};
      (data || []).forEach(base => {
        // Simular algunas asignaciones de ejemplo
        mockAsignaciones[base.id] = [];
      });
      setAsignaciones(mockAsignaciones);

    } catch (error) {
      console.error('Error fetching bases:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las bases de conducción',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <strong>Instrucciones:</strong> Asigna las certificaciones disponibles a cada base. 
            El icono <Eye className="w-4 h-4 inline mx-1" /> indica que la certificación se vigila 
            (control de vencimiento por inactividad). Los maquinistas de cada base heredan automáticamente 
            la configuración de vigilancia al asignárseles la certificación.
          </p>
        </CardContent>
      </Card>

      {bases.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No hay bases de conducción activas. Crea una base en la pestaña "Bases" primero.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bases.map(base => {
            const baseAsignaciones = asignaciones[base.id] || [];
            
            return (
              <Card key={base.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {base.nombre}
                        {base.codigo && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {base.codigo}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {baseAsignaciones.length} certificación(es) asignada(s)
                      </CardDescription>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setEditingBase(base)}
                    >
                      <Pencil className="w-3 h-3 mr-2" />
                      Editar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {baseAsignaciones.length > 0 ? (
                    <div className="space-y-2">
                      {baseAsignaciones.map(cert => (
                        <div 
                          key={cert.id} 
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {cert.certificacion_tipo}
                            </Badge>
                            <span className="text-sm">{cert.certificacion_nombre}</span>
                            {cert.obligatoria && (
                              <Badge variant="secondary" className="text-[10px]">Obligatoria</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {cert.vigilar_vencimiento ? (
                              <span className="flex items-center gap-1 text-xs text-primary">
                                <Eye className="w-3 h-3" />
                                {cert.periodo_inactividad_meses}m / {cert.aviso_dias}d
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <EyeOff className="w-3 h-3" />
                                No vigilar
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Train className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">Sin certificaciones asignadas</p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="mt-1"
                        onClick={() => setEditingBase(base)}
                      >
                        Añadir certificaciones
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de edición */}
      <EditBaseAsignacionModal
        base={editingBase}
        open={!!editingBase}
        onOpenChange={(open) => !open && setEditingBase(null)}
        onSave={() => {
          fetchBases();
          setEditingBase(null);
        }}
      />
    </div>
  );
}

// Modal para editar las asignaciones de una base
interface EditBaseAsignacionModalProps {
  base: BaseConduccion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

function EditBaseAsignacionModal({ base, open, onOpenChange, onSave }: EditBaseAsignacionModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [certificaciones, setCertificaciones] = useState<Array<{
    id: string;
    nombre: string;
    tipo: string;
    asignada: boolean;
    obligatoria: boolean;
    vigilar: boolean;
    periodoMeses: number;
    avisoDias: number;
  }>>([]);

  useEffect(() => {
    if (base && open) {
      // Inicializar con las certificaciones del mock
      const certs = certificacionesMock.map(cert => ({
        id: cert.id,
        nombre: cert.nombre,
        tipo: cert.tipo,
        asignada: false,
        obligatoria: false,
        vigilar: false,
        periodoMeses: 12,
        avisoDias: 30,
      }));
      setCertificaciones(certs);
    }
  }, [base, open]);

  const handleToggleAsignada = (certId: string) => {
    setCertificaciones(prev => prev.map(c => 
      c.id === certId ? { ...c, asignada: !c.asignada } : c
    ));
  };

  const handleToggleObligatoria = (certId: string) => {
    setCertificaciones(prev => prev.map(c => 
      c.id === certId ? { ...c, obligatoria: !c.obligatoria } : c
    ));
  };

  const handleToggleVigilar = (certId: string) => {
    setCertificaciones(prev => prev.map(c => 
      c.id === certId ? { ...c, vigilar: !c.vigilar } : c
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // TODO: Guardar en la base de datos cuando exista la tabla base_certificaciones
      toast({
        title: 'Configuración guardada',
        description: `Las certificaciones de ${base?.nombre} se han actualizado`,
      });
      onSave();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo guardar la configuración',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!base) return null;

  const asignadas = certificaciones.filter(c => c.asignada);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Certificaciones de {base.nombre}</DialogTitle>
          <DialogDescription>
            Selecciona las certificaciones disponibles para esta base y configura su vigilancia
          </DialogDescription>
        </DialogHeader>

        <ScrollArea
          type="always"
          className="flex-1 min-h-0 h-[55vh] overscroll-contain -mr-4 pr-4"
        >
          <div className="space-y-4 py-4 pr-4">
            {/* Vehículos */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Badge variant="outline">Vehículo</Badge>
                Certificaciones de vehículos
              </h4>
              <div className="space-y-2">
                {certificaciones.filter(c => c.tipo === 'vehiculo').map(cert => (
                  <CertificacionRow
                    key={cert.id}
                    cert={cert}
                    onToggleAsignada={() => handleToggleAsignada(cert.id)}
                    onToggleObligatoria={() => handleToggleObligatoria(cert.id)}
                    onToggleVigilar={() => handleToggleVigilar(cert.id)}
                  />
                ))}
              </div>
            </div>

            {/* Líneas */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Badge variant="outline">Línea</Badge>
                Certificaciones de líneas
              </h4>
              <div className="space-y-2">
                {certificaciones.filter(c => c.tipo === 'linea').map(cert => (
                  <CertificacionRow
                    key={cert.id}
                    cert={cert}
                    onToggleAsignada={() => handleToggleAsignada(cert.id)}
                    onToggleObligatoria={() => handleToggleObligatoria(cert.id)}
                    onToggleVigilar={() => handleToggleVigilar(cert.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground mb-4">
            {asignadas.length} certificación(es) seleccionada(s)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
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
  cert: {
    id: string;
    nombre: string;
    tipo: string;
    asignada: boolean;
    obligatoria: boolean;
    vigilar: boolean;
    periodoMeses: number;
    avisoDias: number;
  };
  onToggleAsignada: () => void;
  onToggleObligatoria: () => void;
  onToggleVigilar: () => void;
}

function CertificacionRow({ cert, onToggleAsignada, onToggleObligatoria, onToggleVigilar }: CertificacionRowProps) {
  return (
    <div className={`p-3 rounded-lg border ${cert.asignada ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Switch
            checked={cert.asignada}
            onCheckedChange={onToggleAsignada}
          />
          <span className={`text-sm ${cert.asignada ? 'font-medium' : 'text-muted-foreground'}`}>
            {cert.nombre}
          </span>
        </div>
      </div>
      
      {cert.asignada && (
        <div className="ml-10 flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2">
            <Switch
              checked={cert.obligatoria}
              onCheckedChange={onToggleObligatoria}
              className="scale-75"
            />
            <span className="text-muted-foreground">Obligatoria</span>
          </label>
          <label className="flex items-center gap-2">
            <Switch
              checked={cert.vigilar}
              onCheckedChange={onToggleVigilar}
              className="scale-75"
            />
            <span className="text-muted-foreground flex items-center gap-1">
              {cert.vigilar ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Vigilar vencimiento
            </span>
          </label>
        </div>
      )}
    </div>
  );
}