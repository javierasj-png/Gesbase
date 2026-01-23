import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Users, 
  Train, 
  Settings, 
  Building2,
  FileCheck,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import { 
  maquinistasMock, 
  competenciasUsoMock, 
  competenciasPorBaseMock,
  plantilla1603Mock,
  catalogoHitos1201Mock
} from '@/data/mockData';
import { Base } from '@/types';

const bases: Base[] = ['Madrid-Chamartín', 'Barcelona-Sants', 'Sevilla-Santa Justa', 'Valencia-Joaquín Sorolla'];

export default function AdminPage() {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administración</h1>
          <p className="text-muted-foreground">
            Configuración del sistema, catálogos y plantillas
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="maquinistas" className="space-y-6">
          <TabsList>
            <TabsTrigger value="maquinistas" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Maquinistas
            </TabsTrigger>
            <TabsTrigger value="competencias" className="flex items-center gap-2">
              <Train className="w-4 h-4" />
              Competencias
            </TabsTrigger>
            <TabsTrigger value="asignacion" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Asignación por Base
            </TabsTrigger>
            <TabsTrigger value="plantillas" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Plantillas SGS
            </TabsTrigger>
          </TabsList>

          {/* Maquinistas */}
          <TabsContent value="maquinistas">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Censo de Maquinistas</CardTitle>
                  <CardDescription>Gestión de altas y bajas del censo</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Maquinista
                </Button>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-sm">Matrícula</th>
                      <th className="text-left p-3 font-medium text-sm">Nombre</th>
                      <th className="text-left p-3 font-medium text-sm">Base</th>
                      <th className="text-left p-3 font-medium text-sm">Estado</th>
                      <th className="text-left p-3 font-medium text-sm">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {maquinistasMock.map((maquinista) => (
                      <tr key={maquinista.id} className="border-b last:border-b-0">
                        <td className="p-3 font-mono text-sm">{maquinista.matricula}</td>
                        <td className="p-3 text-sm">{maquinista.nombreApellidos}</td>
                        <td className="p-3 text-sm text-muted-foreground">{maquinista.base}</td>
                        <td className="p-3">
                          <Switch checked={maquinista.activo} />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Competencias */}
          <TabsContent value="competencias">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Catálogo de Competencias de Uso</CardTitle>
                  <CardDescription>Solo las marcadas como "Controlar" se vigilan</CardDescription>
                </div>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Competencia
                </Button>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-sm">Código</th>
                      <th className="text-left p-3 font-medium text-sm">Nombre</th>
                      <th className="text-left p-3 font-medium text-sm">Tipo</th>
                      <th className="text-left p-3 font-medium text-sm">Controlar</th>
                      <th className="text-left p-3 font-medium text-sm">Activa</th>
                      <th className="text-left p-3 font-medium text-sm">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {competenciasUsoMock.map((comp) => (
                      <tr key={comp.id} className="border-b last:border-b-0">
                        <td className="p-3 font-mono text-sm">{comp.codigo}</td>
                        <td className="p-3 text-sm">{comp.nombre}</td>
                        <td className="p-3">
                          <Badge variant="outline">{comp.tipo}</Badge>
                        </td>
                        <td className="p-3">
                          <Switch checked={comp.controlar} />
                        </td>
                        <td className="p-3">
                          <Switch checked={comp.activo} />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Asignación por Base */}
          <TabsContent value="asignacion">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bases.map(base => {
                const asignadas = competenciasPorBaseMock
                  .filter(cb => cb.base === base && cb.activa)
                  .map(cb => competenciasUsoMock.find(c => c.id === cb.competenciaId))
                  .filter(Boolean);
                
                return (
                  <Card key={base}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{base}</CardTitle>
                        <Button variant="outline" size="sm">
                          <Pencil className="w-3 h-3 mr-2" />
                          Editar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {asignadas.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {asignadas.map(comp => comp && (
                            <Badge key={comp.id} variant="secondary">
                              {comp.tipo}: {comp.nombre}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Sin competencias asignadas</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Plantillas SGS */}
          <TabsContent value="plantillas" className="space-y-6">
            {/* Plantilla 16.03 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-primary" />
                  <CardTitle>Plantilla PE 16.03</CardTitle>
                </div>
                <CardDescription>
                  Definición de bloques obligatorios con ventanas temporales (offsets desde primer servicio)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Tipo</th>
                      <th className="text-left p-2 font-medium">Etiqueta</th>
                      <th className="text-left p-2 font-medium">Orden</th>
                      <th className="text-left p-2 font-medium">Inicio (días)</th>
                      <th className="text-left p-2 font-medium">Fin (días)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plantilla1603Mock.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="p-2">{item.tipo}</td>
                        <td className="p-2">{item.etiqueta}</td>
                        <td className="p-2">{item.orden}</td>
                        <td className="p-2 font-mono">{item.offsetInicioDias}</td>
                        <td className="p-2 font-mono">{item.offsetFinDias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Catálogo Hitos 12.01 */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-status-proximo" />
                  <CardTitle>Catálogo Hitos PE 12.01</CardTitle>
                </div>
                <CardDescription>
                  Hitos disponibles para programación ad-hoc (offsets desde 1er servicio tras suceso)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Bloque</th>
                      <th className="text-left p-2 font-medium">Etiqueta</th>
                      <th className="text-left p-2 font-medium">Orden</th>
                      <th className="text-left p-2 font-medium">Offset (días)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogoHitos1201Mock.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="p-2">{item.bloque}</td>
                        <td className="p-2">{item.etiqueta}</td>
                        <td className="p-2">{item.orden}</td>
                        <td className="p-2 font-mono">{item.offsetDias}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
