import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { 
  Users, 
  Train, 
  Settings, 
  Building2,
  FileCheck,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Shield
} from 'lucide-react';
import { 
  maquinistasMock, 
  certificacionesMock, 
  baseCertificacionesMock,
  plantilla1603Mock,
  catalogoHitos1201Mock,
  actualizarBaseCertificaciones,
  actualizarCertificacion
} from '@/data/mockData';
import { Base, BaseCertificacion, Certificacion } from '@/types';
import { EditBaseCertificacionesModal } from '@/components/admin/EditBaseCertificacionesModal';
import { EditCertificacionModal } from '@/components/admin/EditCertificacionModal';
import { UserManagement } from '@/components/admin/UserManagement';

const bases: Base[] = ['Madrid-Chamartín', 'Barcelona-Sants', 'Sevilla-Santa Justa', 'Valencia-Joaquín Sorolla'];

export default function AdminPage() {
  const [editingBase, setEditingBase] = useState<Base | null>(null);
  const [editingCertificacion, setEditingCertificacion] = useState<Certificacion | null>(null);
  const [isNewCertificacion, setIsNewCertificacion] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaveBaseCertificaciones = (baseId: Base, certificaciones: BaseCertificacion[]) => {
    actualizarBaseCertificaciones(baseId, certificaciones);
    setRefreshKey(prev => prev + 1);
  };

  const handleSaveCertificacion = (cert: Certificacion) => {
    actualizarCertificacion(cert);
    setRefreshKey(prev => prev + 1);
  };

  const handleEditCertificacion = (cert: Certificacion) => {
    setEditingCertificacion(cert);
    setIsNewCertificacion(false);
  };

  const handleNewCertificacion = () => {
    setEditingCertificacion(null);
    setIsNewCertificacion(true);
  };
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
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="maquinistas" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Maquinistas
            </TabsTrigger>
            <TabsTrigger value="certificaciones" className="flex items-center gap-2">
              <Train className="w-4 h-4" />
              Certificaciones
            </TabsTrigger>
            <TabsTrigger value="asignacion" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Asignación por Base
            </TabsTrigger>
          </TabsList>

          {/* Usuarios */}
          <TabsContent value="usuarios">
            <UserManagement />
          </TabsContent>

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

          {/* Certificaciones */}
          <TabsContent value="certificaciones">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Catálogo de Certificaciones</CardTitle>
                  <CardDescription>Certificaciones de vehículos y líneas</CardDescription>
                </div>
                <Button onClick={handleNewCertificacion}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Certificación
                </Button>
              </CardHeader>
              <CardContent>
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium text-sm">Nombre</th>
                      <th className="text-left p-3 font-medium text-sm">Tipo</th>
                      <th className="text-left p-3 font-medium text-sm">Descripción</th>
                      <th className="text-left p-3 font-medium text-sm">Activa</th>
                      <th className="text-left p-3 font-medium text-sm">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certificacionesMock.map((cert) => (
                      <tr key={cert.id} className="border-b last:border-b-0">
                        <td className="p-3 text-sm font-medium">{cert.nombre}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="capitalize">{cert.tipo}</Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground max-w-[200px] truncate">
                          {cert.descripcion || '-'}
                        </td>
                        <td className="p-3">
                          <Switch checked={cert.activo} />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEditCertificacion(cert)}
                            >
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bases.map(base => {
                  const asignadas = baseCertificacionesMock
                    .filter(bc => bc.baseId === base)
                    .map(bc => {
                      const cert = certificacionesMock.find(c => c.id === bc.certificacionId);
                      return cert ? { ...cert, ...bc } : null;
                    })
                    .filter(Boolean);
                  
                  return (
                    <Card key={base}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{base}</CardTitle>
                            <CardDescription className="text-xs">
                              {asignadas.length} certificación(es) asignada(s)
                            </CardDescription>
                          </div>
                          <Button variant="outline" size="sm" onClick={() => setEditingBase(base)}>
                            <Pencil className="w-3 h-3 mr-2" />
                            Editar
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {asignadas.length > 0 ? (
                          <div className="space-y-2">
                            {asignadas.map(cert => cert && (
                              <div 
                                key={cert.id} 
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {cert.tipo}
                                  </Badge>
                                  <span className="text-sm">{cert.nombre}</span>
                                  {cert.obligatoria && (
                                    <Badge variant="secondary" className="text-[10px]">Obligatoria</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  {cert.vigilarVencimiento ? (
                                    <span className="flex items-center gap-1 text-xs text-primary">
                                      <Eye className="w-3 h-3" />
                                      {cert.periodoInactividadMeses}m / {cert.avisoDias}d
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
                          <p className="text-sm text-muted-foreground">Sin certificaciones asignadas</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </TabsContent>

        </Tabs>

        {/* Modal de edición de certificaciones por base */}
        <EditBaseCertificacionesModal
          base={editingBase}
          open={!!editingBase}
          onOpenChange={(open) => !open && setEditingBase(null)}
          onSave={handleSaveBaseCertificaciones}
        />

        {/* Modal de edición de certificación del catálogo */}
        <EditCertificacionModal
          certificacion={editingCertificacion}
          open={!!editingCertificacion || isNewCertificacion}
          onOpenChange={(open) => {
            if (!open) {
              setEditingCertificacion(null);
              setIsNewCertificacion(false);
            }
          }}
          onSave={handleSaveCertificacion}
        />
      </div>
    </AppLayout>
  );
}
