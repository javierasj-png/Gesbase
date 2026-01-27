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
  EyeOff
} from 'lucide-react';
import { 
  maquinistasMock, 
  calcularPlanCertificacion, 
  expedientes1603Mock, 
  generarPlan1603,
  actuaciones1603Mock,
  expedientes1201Mock,
  catalogoHitos1201Mock,
  programacion1201Mock,
  actuaciones1201Mock 
} from '@/data/mockData';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { TipoActuacion1603, Bloque1201, Etiqueta1201, EstadoBloque1603 } from '@/types';

export default function MaquinistaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'certificaciones';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const maquinista = maquinistasMock.find(m => m.id === id);
  
  if (!maquinista) {
    return (
      <AppLayout>
        <div className="p-6">
          <p>Maquinista no encontrado</p>
        </div>
      </AppLayout>
    );
  }

  const planCertificacion = calcularPlanCertificacion().filter(p => p.maquinistaId === id);
  const exp1603 = expedientes1603Mock.filter(e => e.maquinistaId === id);
  const exp1201 = expedientes1201Mock.filter(e => e.maquinistaId === id);

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
                <h1 className="text-xl font-bold text-foreground">{maquinista.nombreApellidos}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono">{maquinista.matricula}</span>
                  <span>•</span>
                  <span>{maquinista.base}</span>
                  <span>•</span>
                  <Badge variant={maquinista.activo ? 'default' : 'secondary'}>
                    {maquinista.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
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
                <p className="text-sm text-muted-foreground">Certificaciones de vehículos y líneas heredadas de la base (caducidad 12 meses)</p>
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Registrar Paso/Conducción
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
                      <th className="text-left p-4 font-medium text-sm">Última Acción</th>
                      <th className="text-left p-4 font-medium text-sm">Vencimiento</th>
                      <th className="text-left p-4 font-medium text-sm">Días</th>
                      <th className="text-left p-4 font-medium text-sm">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planCertificacion.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-4">
                          <Badge variant="outline">{item.certificacion?.tipo}</Badge>
                        </td>
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-sm">{item.certificacion?.nombre}</p>
                            <p className="text-xs text-muted-foreground font-mono">{item.certificacion?.codigo}</p>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {item.vigilar ? (
                            <Eye className="w-4 h-4 text-primary mx-auto" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-muted-foreground mx-auto" />
                          )}
                        </td>
                        <td className="p-4 text-sm">
                          {item.fechaUltima 
                            ? format(item.fechaUltima, 'dd/MM/yyyy') 
                            : <span className="text-muted-foreground">Sin registro</span>}
                        </td>
                        <td className="p-4 text-sm">
                          {item.fechaVencimiento 
                            ? format(item.fechaVencimiento, 'dd/MM/yyyy') 
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
                    {planCertificacion.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          No hay certificaciones asignadas a esta base
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
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">PE 16.03 - Nuevo Acceso</h2>
                <p className="text-sm text-muted-foreground">Vigilancia durante 3 años desde primer servicio</p>
              </div>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Crear Expediente
              </Button>
            </div>

            {exp1603.map((expediente) => {
              const plan = generarPlan1603(expediente);
              const actuaciones = actuaciones1603Mock.filter(a => a.expediente1603Id === expediente.id);
              
              // Vincular actuaciones a bloques
              const planConActuaciones = plan.map(bloque => {
                const actuacion = actuaciones.find(a => 
                  a.tipo === bloque.tipo && 
                  a.fechaReal >= bloque.inicioVentana && 
                  a.fechaReal <= bloque.finVentana
                );
                return {
                  ...bloque,
                  estado: actuacion ? 'Cumplida' as EstadoBloque1603 : bloque.estado,
                  actuacion
                };
              });

              const tiposActuacion: TipoActuacion1603[] = ['Acompañamiento', 'Registro', 'Alcohol', 'Drogas'];

              return (
                <Card key={expediente.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Expediente PE 16.03</CardTitle>
                        <CardDescription>
                          Inicio: {format(expediente.fechaInicio, 'dd/MM/yyyy')} • 
                          Fin previsto: {format(expediente.fechaFinPrevista, 'dd/MM/yyyy')}
                        </CardDescription>
                      </div>
                      <StatusBadge estado={expediente.estado} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Timeline por bandas */}
                    <div className="border rounded-lg overflow-hidden">
                      {tiposActuacion.map((tipo) => {
                        const bloquesTipo = planConActuaciones
                          .filter(b => b.tipo === tipo)
                          .sort((a, b) => a.orden - b.orden);
                        
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
                                    bloque.estado === 'Cumplida' ? 'bg-status-cumplida-bg border border-status-ok' :
                                    bloque.estado === 'En ventana' ? 'bg-status-proximo-bg border border-status-proximo animate-pulse-soft' :
                                    bloque.estado === 'Vencida' ? 'bg-status-vencido-bg border border-status-vencido' :
                                    'bg-muted border border-border'
                                  }`}
                                >
                                  <p className="font-medium text-xs mb-1">{bloque.etiqueta}</p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {format(bloque.inicioVentana, 'dd/MM/yy')} - {format(bloque.finVentana, 'dd/MM/yy')}
                                  </p>
                                  <div className="mt-2">
                                    {bloque.estado === 'Cumplida' ? (
                                      <CheckCircle2 className="w-4 h-4 text-status-ok mx-auto" />
                                    ) : bloque.estado === 'Vencida' ? (
                                      <XCircle className="w-4 h-4 text-status-vencido mx-auto" />
                                    ) : bloque.estado === 'En ventana' ? (
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
              );
            })}

            {exp1603.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No hay expedientes PE 16.03 para este maquinista</p>
                  <Button variant="outline" className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Crear primer expediente
                  </Button>
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
              const etiquetas: Etiqueta1201[] = ['Día 1', 'A los 7 días', 'A los 23 días'];

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
