import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { 
  Users, 
  Train, 
  Building2,
  Plus,
  Pencil,
  Trash2,
  Shield,
  FileText,
  Award
} from 'lucide-react';
import { EditCertificacionModal } from '@/components/admin/EditCertificacionModal';
import { UserManagement } from '@/components/admin/UserManagement';
import { BasesManagement } from '@/components/admin/BasesManagement';
import { BaseAsignacionCertificaciones } from '@/components/admin/BaseAsignacionCertificaciones';
import { MaquinistaFormModal } from '@/components/admin/MaquinistaFormModal';
import { MaquinistaCertificacionesModal } from '@/components/admin/MaquinistaCertificacionesModal';
import { PlantillasSGS } from '@/components/admin/PlantillasSGS';
import { useMaquinistas, MaquinistaConNombre, MaquinistaInput } from '@/hooks/useMaquinistas';
import { useCertificaciones, CertificacionDB, CertificacionInput } from '@/hooks/useCertificaciones';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminPage() {
  const { isAdmin, isGestor } = useAuth();
  // Hook para maquinistas con Supabase
  const { maquinistas, loading: loadingMaquinistas, createMaquinista, updateMaquinista, deleteMaquinista, toggleActivo } = useMaquinistas();
  const [editingMaquinista, setEditingMaquinista] = useState<MaquinistaConNombre | null>(null);
  const [isNewMaquinista, setIsNewMaquinista] = useState(false);

  // Hook para certificaciones con Supabase
  const { certificaciones, loading: loadingCertificaciones, createCertificacion, updateCertificacion, deleteCertificacion } = useCertificaciones();
  const [editingCertificacion, setEditingCertificacion] = useState<CertificacionDB | null>(null);
  const [isNewCertificacion, setIsNewCertificacion] = useState(false);

  // Estado para modal de certificaciones de maquinista
  const [maquinistaCertsModal, setMaquinistaCertsModal] = useState<MaquinistaConNombre | null>(null);

  const handleSaveCertificacion = async (input: CertificacionInput, id?: string): Promise<boolean> => {
    if (id) {
      return await updateCertificacion(id, input);
    } else {
      return await createCertificacion(input);
    }
  };

  const handleEditCertificacion = (cert: CertificacionDB) => {
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

  const handleEditMaquinista = (maquinista: MaquinistaConNombre) => {
    setEditingMaquinista(maquinista);
    setIsNewMaquinista(false);
  };

  const handleSaveMaquinista = async (input: MaquinistaInput) => {
    if (editingMaquinista) {
      await updateMaquinista(editingMaquinista.id, input);
    } else {
      await createMaquinista(input);
    }
  };

  const handleToggleMaquinistaActivo = async (maquinista: MaquinistaConNombre) => {
    await toggleActivo(maquinista.id, maquinista.activo);
  };

  const handleDeleteMaquinista = async (maquinista: MaquinistaConNombre) => {
    if (confirm(`¿Eliminar a ${maquinista.nombre_apellidos}?`)) {
      await deleteMaquinista(maquinista.id);
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

        {/* Tabs - gestor only sees maquinistas and asignacion tabs */}
        <Tabs defaultValue="usuarios" className="space-y-6">
          <TabsList>
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Usuarios
            </TabsTrigger>
            <TabsTrigger value="maquinistas" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Maquinistas
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="certificaciones" className="flex items-center gap-2">
                <Train className="w-4 h-4" />
                Certificaciones
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="bases" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Bases
              </TabsTrigger>
            )}
            <TabsTrigger value="asignacion" className="flex items-center gap-2">
              <Train className="w-4 h-4" />
              Asignación por Base
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="plantillas" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Plantillas SGS
              </TabsTrigger>
            )}
          </TabsList>

          {/* Usuarios - Admin and Gestor */}
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
                {loadingMaquinistas ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Cargando maquinistas...</span>
                  </div>
                ) : maquinistas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay maquinistas registrados
                  </div>
                ) : (
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
                          <td className="p-3 text-sm">{maquinista.nombre_apellidos}</td>
                          <td className="p-3 text-sm text-muted-foreground">{maquinista.base}</td>
                          <td className="p-3">
                            <Switch 
                              checked={maquinista.activo} 
                              onCheckedChange={() => handleToggleMaquinistaActivo(maquinista)}
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setMaquinistaCertsModal(maquinista)}
                                title="Gestionar certificaciones"
                              >
                                <Award className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleEditMaquinista(maquinista)}
                                title="Editar datos"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteMaquinista(maquinista)}
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificaciones - Admin only */}
          {isAdmin && (
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
                  {loadingCertificaciones ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Cargando certificaciones...</span>
                    </div>
                  ) : certificaciones.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No hay certificaciones registradas
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left p-3 font-medium text-sm">ID</th>
                          <th className="text-left p-3 font-medium text-sm">Nombre</th>
                          <th className="text-left p-3 font-medium text-sm">Tipo</th>
                          <th className="text-left p-3 font-medium text-sm">Descripción</th>
                          <th className="text-left p-3 font-medium text-sm">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {certificaciones.map((cert) => (
                          <tr key={cert.id} className="border-b last:border-b-0">
                            <td className="p-3 font-mono text-xs">{cert.id}</td>
                            <td className="p-3 text-sm font-medium">{cert.nombre}</td>
                            <td className="p-3">
                              <Badge variant="outline" className="capitalize">{cert.tipo}</Badge>
                            </td>
                            <td className="p-3 text-sm text-muted-foreground max-w-[200px] truncate">
                              {cert.descripcion || '-'}
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Bases de Conducción - Admin only */}
          {isAdmin && (
            <TabsContent value="bases">
              <BasesManagement />
            </TabsContent>
          )}

          {/* Asignación por Base - accessible to gestor for their bases */}
          <TabsContent value="asignacion">
            <BaseAsignacionCertificaciones />
          </TabsContent>

          {/* Plantillas SGS - Admin only */}
          {isAdmin && (
            <TabsContent value="plantillas">
              <PlantillasSGS />
            </TabsContent>
          )}

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
          isNew={isNewCertificacion}
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
          maquinista={editingMaquinista ? {
            id: editingMaquinista.id,
            matricula: editingMaquinista.matricula,
            nombre_apellidos: editingMaquinista.nombre_apellidos,
            base: editingMaquinista.base,
            activo: editingMaquinista.activo,
            observaciones: (editingMaquinista as any).observaciones ?? null,
            bajo_pe_1603: editingMaquinista.bajo_pe_1603 ?? false,
            fecha_primer_servicio: editingMaquinista.fecha_primer_servicio ?? null,
            fecha_licencia_conduccion: editingMaquinista.fecha_licencia_conduccion ?? null,
          } : null}
          onSave={handleSaveMaquinista}
        />

        {/* Modal de certificaciones de maquinista */}
        <MaquinistaCertificacionesModal
          maquinistaId={maquinistaCertsModal?.id || null}
          maquinistaNombre={maquinistaCertsModal?.nombre_apellidos || ''}
          baseName={maquinistaCertsModal?.base || null}
          open={!!maquinistaCertsModal}
          onOpenChange={(open) => {
            if (!open) setMaquinistaCertsModal(null);
          }}
        />
      </div>
    </AppLayout>
  );
}
