import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { useCertificaciones, CertificacionDB } from '@/hooks/useCertificaciones';

interface BaseConduccion {
  id: string;
  nombre: string;
  codigo: string | null;
  activa: boolean;
}

interface BaseCertificacionDB {
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
  const [asignaciones, setAsignaciones] = useState<Record<string, BaseCertificacionDB[]>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [basesRes, certsRes] = await Promise.all([
        supabase.from('bases_conduccion').select('*').eq('activa', true).order('nombre'),
        supabase.from('base_certificaciones').select('*'),
      ]);

      if (basesRes.error) throw basesRes.error;
      if (certsRes.error) throw certsRes.error;

      setBases(basesRes.data || []);

      // Agrupar asignaciones por base
      const grouped: Record<string, BaseCertificacionDB[]> = {};
      (basesRes.data || []).forEach(base => {
        grouped[base.id] = (certsRes.data || []).filter(c => c.base_id === base.id);
      });
      setAsignaciones(grouped);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los datos',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        existingAsignaciones={editingBase ? asignaciones[editingBase.id] || [] : []}
        open={!!editingBase}
        onOpenChange={(open) => !open && setEditingBase(null)}
        onSave={() => {
          fetchData();
          setEditingBase(null);
        }}
      />
    </div>
  );
}

// Modal para editar las asignaciones de una base
interface EditBaseAsignacionModalProps {
  base: BaseConduccion | null;
  existingAsignaciones: BaseCertificacionDB[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

interface CertConfig {
  id: string;
  nombre: string;
  tipo: string;
  asignada: boolean;
  obligatoria: boolean;
  vigilar: boolean;
  periodoMeses: number;
  avisoDias: number;
}

function EditBaseAsignacionModal({ base, existingAsignaciones, open, onOpenChange, onSave }: EditBaseAsignacionModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [certificaciones, setCertificaciones] = useState<CertConfig[]>([]);
  
  // Cargar certificaciones desde la BD
  const { certificaciones: catalogoCertificaciones, loading: loadingCatalogo } = useCertificaciones();

  useEffect(() => {
    if (base && open && !loadingCatalogo) {
      // Usar todas las certificaciones de la BD
      const certs = catalogoCertificaciones.map(cert => {
        const existing = existingAsignaciones.find(e => e.certificacion_id === cert.id);
        return {
          id: cert.id,
          nombre: cert.nombre,
          tipo: cert.tipo,
          asignada: !!existing,
          obligatoria: existing?.obligatoria ?? false,
          vigilar: existing?.vigilar_vencimiento ?? true,
          periodoMeses: existing?.periodo_inactividad_meses ?? 12,
          avisoDias: existing?.aviso_dias ?? 30,
        };
      });
      setCertificaciones(certs);
    }
  }, [base, open, existingAsignaciones, catalogoCertificaciones, loadingCatalogo]);

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
    if (!base) return;
    
    setSaving(true);
    try {
      // Eliminar asignaciones existentes para esta base
      const { error: deleteError } = await supabase
        .from('base_certificaciones')
        .delete()
        .eq('base_id', base.id);

      if (deleteError) throw deleteError;

      // Insertar las nuevas asignaciones
      const asignadas = certificaciones.filter(c => c.asignada);
      
      if (asignadas.length > 0) {
        const toInsert = asignadas.map(c => ({
          base_id: base.id,
          certificacion_id: c.id,
          certificacion_nombre: c.nombre,
          certificacion_tipo: c.tipo,
          obligatoria: c.obligatoria,
          vigilar_vencimiento: c.vigilar,
          periodo_inactividad_meses: c.periodoMeses,
          aviso_dias: c.avisoDias,
        }));

        const { error: insertError } = await supabase
          .from('base_certificaciones')
          .insert(toInsert);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Configuración guardada',
        description: `Se asignaron ${asignadas.length} certificación(es) a ${base.nombre}`,
      });
      onSave();
    } catch (error) {
      console.error('Error saving:', error);
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
  const vehiculos = certificaciones.filter(c => c.tipo === 'vehiculo');
  const lineas = certificaciones.filter(c => c.tipo === 'linea');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Certificaciones de {base.nombre}</DialogTitle>
          <DialogDescription>
            Selecciona las certificaciones disponibles para esta base y configura su vigilancia
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-4 -mx-6 px-6">
          {loadingCatalogo ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Cargando catálogo...</span>
            </div>
          ) : certificaciones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Train className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay certificaciones en el catálogo.</p>
              <p className="text-sm">Añade certificaciones en la pestaña "Certificaciones".</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Vehículos */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2 sticky top-0 bg-background py-1">
                  <Badge variant="outline">Vehículo</Badge>
                  Certificaciones de vehículos ({vehiculos.filter(v => v.asignada).length}/{vehiculos.length})
                </h4>
                <div className="space-y-2">
                  {vehiculos.map(cert => (
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
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2 sticky top-0 bg-background py-1">
                <Badge variant="outline">Línea</Badge>
                Certificaciones de líneas ({lineas.filter(l => l.asignada).length}/{lineas.length})
              </h4>
              <div className="space-y-2">
                {lineas.map(cert => (
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
          )}
        </div>
        <div className="flex-shrink-0 border-t pt-4 -mx-6 px-6 bg-background">
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
  cert: CertConfig;
  onToggleAsignada: () => void;
  onToggleObligatoria: () => void;
  onToggleVigilar: () => void;
}

function CertificacionRow({ cert, onToggleAsignada, onToggleObligatoria, onToggleVigilar }: CertificacionRowProps) {
  return (
    <div className={`p-3 rounded-lg border transition-colors ${cert.asignada ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-transparent'}`}>
      <div className="flex items-center gap-3">
        <Switch
          checked={cert.asignada}
          onCheckedChange={onToggleAsignada}
        />
        <span className={`text-sm ${cert.asignada ? 'font-medium' : 'text-muted-foreground'}`}>
          {cert.nombre}
        </span>
      </div>
      
      {cert.asignada && (
        <div className="ml-10 mt-2 flex items-center gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch
              checked={cert.obligatoria}
              onCheckedChange={onToggleObligatoria}
              className="scale-75"
            />
            <span className="text-muted-foreground">Obligatoria</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
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
