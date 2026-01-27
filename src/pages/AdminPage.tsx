import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { 
  Users, 
  Train, 
  Building2,
  Plus,
  Pencil,
  Trash2,
  Shield
} from 'lucide-react';
import { 
  maquinistasMock, 
  certificacionesMock, 
  actualizarCertificacion
} from '@/data/mockData';
import { Certificacion, Maquinista } from '@/types';
import { EditCertificacionModal } from '@/components/admin/EditCertificacionModal';
import { UserManagement } from '@/components/admin/UserManagement';
import { BasesManagement } from '@/components/admin/BasesManagement';
import { BaseAsignacionCertificaciones } from '@/components/admin/BaseAsignacionCertificaciones';
import { MaquinistaFormModal } from '@/components/admin/MaquinistaFormModal';

export default function AdminPage() {
  const [editingCertificacion, setEditingCertificacion] = useState<Certificacion | null>(null);
  const [isNewCertificacion, setIsNewCertificacion] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Estado para maquinistas
  const [maquinistas, setMaquinistas] = useState<Maquinista[]>(maquinistasMock);
  const [editingMaquinista, setEditingMaquinista] = useState<Maquinista | null>(null);
  const [isNewMaquinista, setIsNewMaquinista] = useState(false);

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

  const handleNewMaquinista = () => {
    setEditingMaquinista(null);
    setIsNewMaquinista(true);
  };

  const handleEditMaquinista = (maquinista: Maquinista) => {
    setEditingMaquinista(maquinista);
    setIsNewMaquinista(false);
  };

  const handleSaveMaquinista = (maquinista: Maquinista) => {
    setMaquinistas(prev => {
      const index = prev.findIndex(m => m.id === maquinista.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = maquinista;
        return updated;
      }
      return [...prev, maquinista];
    });
  };

  const handleToggleMaquinistaActivo = (maquinista: Maquinista) => {
    setMaquinistas(prev => 
      prev.map(m => m.id === maquinista.id ? { ...m, activo: !m.activo } : m)
    );
  };

  const handleDeleteMaquinista = (maquinista: Maquinista) => {
    if (confirm(`¿Eliminar a ${maquinista.nombreApellidos}?`)) {
      setMaquinistas(prev => prev.filter(m => m.id !== maquinista.id));
    }
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
        <Tabs defaultValue="usuarios" className="space-y-6">
          <TabsList>
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Mandos
            </TabsTrigger>
            <TabsTrigger value="maquinistas" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Maquinistas
            </TabsTrigger>
            <TabsTrigger value="certificaciones" className="flex items-center gap-2">
              <Train className="w-4 h-4" />
              Certificaciones
            </TabsTrigger>
            <TabsTrigger value="bases" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Bases
            </TabsTrigger>
            <TabsTrigger value="asignacion" className="flex items-center gap-2">
              <Train className="w-4 h-4" />
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
                <Button onClick={handleNewMaquinista}>
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
                    {maquinistas.map((maquinista) => (
                      <tr key={maquinista.id} className="border-b last:border-b-0">
                        <td className="p-3 font-mono text-sm">{maquinista.matricula}</td>
                        <td className="p-3 text-sm">{maquinista.nombreApellidos}</td>
                        <td className="p-3 text-sm text-muted-foreground">{maquinista.base}</td>
                        <td className="p-3">
                          <Switch 
                            checked={maquinista.activo} 
                            onCheckedChange={() => handleToggleMaquinistaActivo(maquinista)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => handleEditMaquinista(maquinista)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive"
                              onClick={() => handleDeleteMaquinista(maquinista)}
                            >
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

          {/* Bases de Conducción */}
          <TabsContent value="bases">
            <BasesManagement />
          </TabsContent>

          {/* Asignación por Base */}
          <TabsContent value="asignacion">
            <BaseAsignacionCertificaciones />
          </TabsContent>

        </Tabs>

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

        {/* Modal de maquinista */}
        <MaquinistaFormModal
          open={!!editingMaquinista || isNewMaquinista}
          onOpenChange={(open) => {
            if (!open) {
              setEditingMaquinista(null);
              setIsNewMaquinista(false);
            }
          }}
          maquinista={editingMaquinista}
          onSave={handleSaveMaquinista}
        />
      </div>
    </AppLayout>
  );
}
