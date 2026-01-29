import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  User, 
  Train, 
  FileCheck, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useMaquinistaDetail } from '@/hooks/useMaquinistaDetail';
import { MaquinistaCertificacionesTab } from '@/components/maquinista/MaquinistaCertificacionesTab';
import { MaquinistaPE1603Tab } from '@/components/maquinista/MaquinistaPE1603Tab';
import { MaquinistaPE1201Tab } from '@/components/maquinista/MaquinistaPE1201Tab';

export default function MaquinistaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'certificaciones';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const { maquinista, expediente1603, plan1603, loading, error, refetch } = useMaquinistaDetail(id);

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
                <h1 className="text-xl font-bold text-foreground">{maquinista.nombre} {maquinista.apellidos}</h1>
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
          <TabsContent value="certificaciones">
            <MaquinistaCertificacionesTab 
              maquinistaId={maquinista.id} 
              baseName={maquinista.base} 
            />
          </TabsContent>

          {/* Tab: PE 16.03 */}
          <TabsContent value="pe1603">
            <MaquinistaPE1603Tab
              maquinista={{
                id: maquinista.id,
                nombre_apellidos: `${maquinista.nombre} ${maquinista.apellidos}`,
                matricula: maquinista.matricula,
                base: maquinista.base,
                bajo_pe_1603: !!expediente1603,
              }}
              expediente1603={expediente1603}
              plan1603={plan1603}
              onRefetch={refetch}
            />
          </TabsContent>

          {/* Tab: PE 12.01 */}
          <TabsContent value="pe1201">
            <MaquinistaPE1201Tab
              maquinistaId={maquinista.id}
              maquinistaNombre={`${maquinista.nombre} ${maquinista.apellidos}`}
              onRefetch={refetch}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
