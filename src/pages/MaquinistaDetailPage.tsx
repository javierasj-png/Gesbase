import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  User, 
  Train, 
  FileCheck, 
  AlertTriangle,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { useMaquinistaDetail, TipoActuacion1603 } from '@/hooks/useMaquinistaDetail';
import { 
  obtenerCertificacionesMaquinista, 
  expedientes1201Mock,
  catalogoHitos1201Mock,
  programacion1201Mock,
  actuaciones1201Mock 
} from '@/data/mockData';
import { format, addDays } from 'date-fns';
import { Bloque1201, Etiqueta1201 } from '@/types';

export default function MaquinistaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'certificaciones';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const { maquinista, expediente1603, plan1603, loading, error } = useMaquinistaDetail(id);

  // Loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }
  
  // Error or not found state
  if (error || !maquinista) {
    return (
      <AppLayout>
        <div className="p-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/maquinistas')} className="mb-4">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{error || 'Maquinista no encontrado'}</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/maquinistas')}>
                Volver al listado
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Certificaciones still use mock (for now)
  const certificaciones = obtenerCertificacionesMaquinista(id || '');
  
  // PE 12.01 still uses mock (for now)
  const exp1201 = expedientes1201Mock.filter(e => e.maquinistaId === id);

  // Group plan blocks by type
  const tiposActuacion: TipoActuacion1603[] = ['Acompañamiento', 'Registro', 'Alcohol', 'Drogas'];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/maquinistas')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{maquinista.nombre_apellidos}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">{maquinista.matricula}</span>
                  <span>•</span>
                  <span>{maquinista.base}</span>
                  <span>•</span>
                  <Badge variant={maquinista.activo ? 'default' : 'secondary'}>
                    {maquinista.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                  {maquinista.bajo_pe_1603 && (
                    <Badge variant="outline" className="text-primary border-primary">
                      PE 16.03
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
            <TabsTrigger value="certificaciones" className="flex items-center gap-2">
              <Train className="w-4 h-4" />
              Certificaciones
            </TabsTrigger>
            <TabsTrigger value="pe1603" className="flex items-center gap-2">
              <FileCheck className="w-4 h-4" />
              PE 16.03
            </TabsTrigger>
            <TabsTrigger value="pe1201" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              PE 12.01
            </TabsTrigger>
          </TabsList>

          {/* Tab: Certificaciones */}
          <TabsContent value="certificaciones" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Certificaciones</h2>
                <p className="text-sm text-muted-foreground">Certificaciones de vehículos y líneas (vencimiento por inactividad)</p>
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Servicio
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-medium text-sm">Tipo</th>
                      <th className="text-left p-4 font-medium text-sm">Certificación</th>
                      <th className="text-center p-4 font-medium text-sm">Vigilar</th>
                      <th className="text-left p-4 font-medium text-sm">Último Servicio</th>
                      <th className="text-left p-4 font-medium text-sm">Vencimiento Est.</th>
                      <th className="text-left p-4 font-medium text-sm">Días</th>
                      <th className="text-left p-4 font-medium text-sm">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificaciones.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize">{item.certificacion?.tipo}</Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium text-sm">{item.certificacion?.nombre}</p>
                              {item.obligatoria && (
                                <span className="text-[10px] text-primary">Obligatoria</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {item.vigilarVencimiento ? (
                            <div className="flex flex-col items-center text-xs">
                              <Eye className="w-4 h-4 text-primary" />
                              <span className="text-muted-foreground">{item.periodoInactividadMeses}m</span>
                            </div>
                          ) : (
                            <EyeOff className="w-4 h-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                        <td className="p-4 text-sm">
                          {item.fechaUltimoServicio 
                            ? format(item.fechaUltimoServicio, 'dd/MM/yyyy') 
                            : <span className="text-muted-foreground">Sin registro</span>}
                        </td>
                        <td className="p-4 text-sm">
                          {item.fechaEstimadaVencimiento 
                            ? format(item.fechaEstimadaVencimiento, 'dd/MM/yyyy') 
                            : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="p-4 text-sm font-medium">
                          {item.diasRestantes !== null 
                            ? (item.diasRestantes >= 0 ? item.diasRestantes : `${Math.abs(item.diasRestantes)} venc.`)
                            : '-'}
                        </td>
                        <td className="p-4">
                          <StatusBadge estado={item.estado} size="sm" />
                        </td>
                      </tr>
                    ))}
                    {certificaciones.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No hay certificaciones asignadas a este maquinista
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: PE 16.03 */}
          <TabsContent value="pe1603" className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">PE 16.03 - Nuevo Acceso</h2>
              <p className="text-sm text-muted-foreground">
                Vigilancia durante 3 años desde primer servicio. 
                El expediente se genera automáticamente al dar de alta al maquinista.
              </p>
            </div>

            {expediente1603 ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Expediente PE 16.03</CardTitle>
                      <CardDescription>
                        Inicio: {format(new Date(expediente1603.fecha_inicio), 'dd/MM/yyyy')} • 
                        Fin previsto: {format(new Date(expediente1603.fecha_fin_prevista), 'dd/MM/yyyy')}
                      </CardDescription>
                    </div>
                    <StatusBadge estado={expediente1603.estado} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Timeline por bandas */}
                  <div className="border rounded-lg overflow-hidden">
                    {tiposActuacion.map((tipo) => {
                      const bloquesTipo = plan1603
                        .filter(b => b.tipo === tipo)
                        .sort((a, b) => a.orden - b.orden);
                      
                      if (bloquesTipo.length === 0) return null;
                      
                      return (
                        <div key={tipo} className="timeline-band">
                          <div className="timeline-label">
                            {tipo}
                          </div>
                          <div className="timeline-blocks">
                            {bloquesTipo.map((bloque) => (
                              <div 
                                key={bloque.id} 
                                className={`timeline-block ${
                                  bloque.estadoCalculado === 'Cumplida' ? 'bg-status-cumplida-bg border border-status-ok' :
                                  bloque.estadoCalculado === 'En ventana' ? 'bg-status-proximo-bg border border-status-proximo animate-pulse-soft' :
                                  bloque.estadoCalculado === 'Vencida' ? 'bg-status-vencido-bg border border-status-vencido' :
                                  'bg-muted border border-border'
                                }`}
                              >
                                <p className="font-medium text-xs mb-1">{bloque.etiqueta}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(bloque.inicio_ventana), 'dd/MM/yy')} - {format(new Date(bloque.fin_ventana), 'dd/MM/yy')}
                                </p>
                                <div className="mt-2">
                                  {bloque.estadoCalculado === 'Cumplida' ? (
                                    <CheckCircle2 className="w-4 h-4 text-status-ok mx-auto" />
                                  ) : bloque.estadoCalculado === 'Vencida' ? (
                                    <XCircle className="w-4 h-4 text-status-vencido mx-auto" />
                                  ) : bloque.estadoCalculado === 'En ventana' ? (
                                    <Clock className="w-4 h-4 text-status-proximo mx-auto" />
                                  ) : (
                                    <Calendar className="w-4 h-4 text-muted-foreground mx-auto" />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Leyenda */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-status-cumplida-bg border border-status-ok"></span>
                      Cumplida
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-status-proximo-bg border border-status-proximo"></span>
                      En ventana
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-status-vencido-bg border border-status-vencido"></span>
                      Vencida
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-muted border border-border"></span>
                      Pendiente
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Actuación
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {maquinista.bajo_pe_1603 
                      ? 'El expediente PE 16.03 se está generando...'
                      : 'Este maquinista no está bajo vigilancia PE 16.03'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: PE 12.01 */}
          <TabsContent value="pe1201" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">PE 12.01 - Factor Humano</h2>
                <p className="text-sm text-muted-foreground">Gestión de expedientes tras suceso</p>
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Crear Expediente
              </Button>
            </div>

            {exp1201.map((expediente) => {
              const origen = expediente.fechaPrimerServicioTrasSuceso;
              const fechaCierreRecomendada = addDays(origen, 30);
              
              const bloques: Bloque1201[] = ['Acompañamientos', 'Registros'];
              const etiquetas: Etiqueta1201[] = ['Día 1', 'A los 7 días', 'A los 23 días', 'A los 30 días'];

              // Construir matriz de celdas
              const getCeldaEstado = (bloque: Bloque1201, etiqueta: Etiqueta1201) => {
                const hito = catalogoHitos1201Mock.find(h => h.bloque === bloque && h.etiqueta === etiqueta);
                const fechaObjetivo = hito ? addDays(origen, hito.offsetDias) : origen;
                
                const programacion = programacion1201Mock.find(
                  p => p.expediente1201Id === expediente.id && p.bloque === bloque && p.etiqueta === etiqueta
                );
                
                const actuacion = actuaciones1201Mock.find(
                  a => a.expediente1201Id === expediente.id && a.bloque === bloque && a.etiqueta === etiqueta
                );

                if (actuacion) return { estado: 'Cumplida' as const, fechaObjetivo, actuacion };
                if (programacion) return { estado: 'Pendiente' as const, fechaObjetivo, programacion };
                return { estado: 'No procede' as const, fechaObjetivo };
              };

              return (
                <Card key={expediente.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">Suceso: {expediente.idSuceso}</CardTitle>
                          <StatusBadge estado={expediente.estado} />
                        </div>
                        <CardDescription>
                          1er servicio tras suceso: {format(origen, 'dd/MM/yyyy')} • 
                          Apertura: {format(expediente.fechaAperturaFicha, 'dd/MM/yyyy')}
                        </CardDescription>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">Cierre recomendado:</p>
                        <p className="font-medium">{format(fechaCierreRecomendada, 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Tabla AD-HOC */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="adhoc-table">
                        <thead>
                          <tr>
                            <th className="adhoc-cell adhoc-header"></th>
                            {etiquetas.map(etiqueta => (
                              <th key={etiqueta} className="adhoc-cell adhoc-header">
                                {etiqueta}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {bloques.map(bloque => (
                            <tr key={bloque}>
                              <td className="adhoc-cell adhoc-header">{bloque}</td>
                              {etiquetas.map(etiqueta => {
                                const celda = getCeldaEstado(bloque, etiqueta);
                                return (
                                  <td 
                                    key={`${bloque}-${etiqueta}`} 
                                    className={`adhoc-cell ${
                                      celda.estado === 'Cumplida' ? 'bg-status-cumplida-bg' :
                                      celda.estado === 'Pendiente' ? 'bg-status-pendiente-bg' :
                                      'bg-status-no-procede-bg'
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <p className="text-xs text-muted-foreground">
                                        {format(celda.fechaObjetivo, 'dd/MM')}
                                      </p>
                                      <StatusBadge estado={celda.estado} size="sm" />
                                      {celda.estado === 'No procede' && (
                                        <Button variant="ghost" size="sm" className="text-xs h-6 mt-1">
                                          Programar
                                        </Button>
                                      )}
                                      {celda.estado === 'Pendiente' && (
                                        <Button variant="ghost" size="sm" className="text-xs h-6 mt-1">
                                          Registrar
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Observaciones */}
                    {expediente.observaciones && (
                      <div className="p-3 bg-muted/50 rounded-lg text-sm">
                        <p className="font-medium text-xs text-muted-foreground mb-1">Observaciones:</p>
                        <p>{expediente.observaciones}</p>
                      </div>
                    )}

                    {/* Botón cerrar ficha */}
                    {expediente.estado === 'Abierta' && (
                      <Button variant="outline" className="w-full">
                        Cerrar Ficha
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {exp1201.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay expedientes PE 12.01 para este maquinista</p>
                  <Button variant="outline" className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear expediente por suceso
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
