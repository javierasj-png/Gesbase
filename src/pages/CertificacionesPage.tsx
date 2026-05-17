import { useState } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Eye, 
  EyeOff, 
  Building2,
  Train,
  Loader2,
  CheckCircle2,
  AlertTriangle as AlertTriangleIcon
} from 'lucide-react';
import { useBaseCertificaciones } from '@/hooks/useBaseCertificaciones';
import { useGlobalBaseFilter } from '@/hooks/useGlobalBaseFilter';

export default function CertificacionesPage() {
  const navigate = useNavigate();
  usePageMeta({ title: 'Certificaciones — Gestión de Base', description: 'Estado y vencimientos de certificaciones de maquinistas por base.', path: '/certificaciones' });
  const [globalBaseName, setGlobalBaseName] = useGlobalBaseFilter();
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [soloVigiladas, setSoloVigiladas] = useState(false);
  const [soloObligatorias, setSoloObligatorias] = useState(false);

  const { certificacionesPorBase, loading, kpis, bases } = useBaseCertificaciones();

  // Traducir filtro global (por nombre) ↔ id de base
  const baseFilter = globalBaseName === 'all'
    ? 'all'
    : (bases.find(b => b.nombre === globalBaseName)?.id ?? 'all');

  const setBaseFilter = (id: string) => {
    if (id === 'all') {
      setGlobalBaseName('all');
    } else {
      const found = bases.find(b => b.id === id);
      setGlobalBaseName(found?.nombre ?? 'all');
    }
  };

  // Filtrar bases
  const filteredBases = certificacionesPorBase.filter(item => {
    if (baseFilter !== 'all' && item.base.id !== baseFilter) return false;
    return true;
  });

  // Filtrar certificaciones dentro de cada base
  const getFilteredCertificaciones = (certificaciones: typeof certificacionesPorBase[0]['certificaciones']) => {
    return certificaciones.filter(cert => {
      if (tipoFilter !== 'all' && cert.certificacion_tipo !== tipoFilter) return false;
      if (soloVigiladas && !cert.vigilar_vencimiento) return false;
      if (soloObligatorias && !cert.obligatoria) return false;
      return true;
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificaciones por Base</h1>
          <p className="text-muted-foreground">
            Configuración de certificaciones, obligatoriedad y vigilancia de vencimiento
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{kpis.totalBases}</p>
                  <p className="text-sm text-muted-foreground">Bases activas</p>
                </div>
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{kpis.totalCertificaciones}</p>
                  <p className="text-sm text-muted-foreground">Asignaciones totales</p>
                </div>
                <Train className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-primary">{kpis.totalObligatorias}</p>
                  <p className="text-sm text-muted-foreground">Obligatorias</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-amber-600">{kpis.totalVigiladas}</p>
                  <p className="text-sm text-muted-foreground">Con vigilancia</p>
                </div>
                <Eye className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <Select value={baseFilter} onValueChange={setBaseFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas las bases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las bases</SelectItem>
                  {bases.map(base => (
                    <SelectItem key={base.id} value={base.id}>{base.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="vehiculo">Vehículo</SelectItem>
                  <SelectItem value="linea">Línea</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant={soloObligatorias ? "default" : "outline"} 
                size="sm"
                onClick={() => setSoloObligatorias(!soloObligatorias)}
                className="flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {soloObligatorias ? 'Solo obligatorias' : 'Obligatorias'}
              </Button>
              <Button 
                variant={soloVigiladas ? "default" : "outline"} 
                size="sm"
                onClick={() => setSoloVigiladas(!soloVigiladas)}
                className="flex items-center gap-2"
              >
                {soloVigiladas ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {soloVigiladas ? 'Solo vigiladas' : 'Con vigilancia'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Certificaciones por Base */}
        {filteredBases.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No hay bases con certificaciones asignadas.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredBases.map(({ base, certificaciones, totalObligatorias, totalVigiladas }) => {
              const filteredCerts = getFilteredCertificaciones(certificaciones);
              
              if (filteredCerts.length === 0 && (soloVigiladas || soloObligatorias || tipoFilter !== 'all')) {
                return null;
              }

              const vehiculos = filteredCerts.filter(c => c.certificacion_tipo === 'vehiculo');
              const lineas = filteredCerts.filter(c => c.certificacion_tipo === 'linea');

              return (
                <Card key={base.id}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {base.nombre}
                          {base.codigo && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {base.codigo}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {certificaciones.length} certificación(es) • 
                          {totalObligatorias} obligatoria(s) • 
                          {totalVigiladas} vigilada(s)
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredCerts.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Train className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Sin certificaciones asignadas a esta base</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Vehículos */}
                        {vehiculos.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Badge variant="outline">Vehículos</Badge>
                              <span className="text-muted-foreground">({vehiculos.length})</span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {vehiculos.map(cert => (
                                <CertificacionCard key={cert.id} cert={cert} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Líneas */}
                        {lineas.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Badge variant="outline">Líneas</Badge>
                              <span className="text-muted-foreground">({lineas.length})</span>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {lineas.map(cert => (
                                <CertificacionCard key={cert.id} cert={cert} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Leyenda */}
        <Card className="bg-muted/30">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-primary">Obligatoria</Badge>
                <span className="text-muted-foreground">El maquinista debe tenerla activa</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" />
                <span className="text-muted-foreground">Vigilancia por fecha de servicio (vencimiento por inactividad)</span>
              </div>
              <div className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sin vigilancia de vencimiento</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// Componente de tarjeta de certificación
function CertificacionCard({ cert }: { cert: ReturnType<typeof useBaseCertificaciones>['allCertificaciones'][0] }) {
  return (
    <div className={`p-3 rounded-lg border ${cert.obligatoria ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm">{cert.certificacion_nombre}</p>
          <div className="flex items-center gap-2 mt-1">
            {cert.obligatoria && (
              <Badge variant="default" className="text-[10px] h-5 bg-primary">
                Obligatoria
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {cert.vigilar_vencimiento ? (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <Eye className="w-3 h-3" />
              <span>{cert.periodo_inactividad_meses}m</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <EyeOff className="w-3 h-3" />
            </div>
          )}
          {cert.vigilar_vencimiento && (
            <span className="text-[10px] text-muted-foreground">
              Aviso: {cert.aviso_dias}d
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
