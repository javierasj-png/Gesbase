import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  FileBarChart, 
  ClipboardCheck, 
  Download, 
  Calendar,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Filter,
  Printer
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

interface CumplimientoBase {
  base: string;
  maquinistas: number;
  pe1603Activos: number;
  pe1603Cumplimiento: number;
  pe1201Activos: number;
  pe1201Cumplimiento: number;
  certVigentes: number;
  certTotal: number;
}

interface ParteSummary {
  mes: string;
  totalPartes: number;
  procesados: number;
  pendientes: number;
  errores: number;
}

export default function AuditoriaPage() {
  const { isAdmin, assignedBases } = useAuth();
  const [selectedTab, setSelectedTab] = useState('cumplimiento');
  const [fechaDesde, setFechaDesde] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [fechaHasta, setFechaHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [baseFilter, setBaseFilter] = useState<string>('all');

  // Fetch bases for filter - filtered by user's assigned bases if not admin
  const { data: bases } = useQuery({
    queryKey: ['bases-auditoria', isAdmin, assignedBases],
    queryFn: async () => {
      let query = supabase
        .from('bases_conduccion')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      
      // If not admin, only show assigned bases
      if (!isAdmin && assignedBases.length > 0) {
        query = query.in('nombre', assignedBases);
      }
      
      const { data } = await query;
      return data || [];
    }
  });

  // Compute accessible bases for the report
  const accessibleBases = isAdmin 
    ? (bases?.map(b => b.nombre) || [])
    : assignedBases;

  // Fetch cumplimiento data
  const { data: cumplimientoData, isLoading: loadingCumplimiento } = useQuery({
    queryKey: ['auditoria-cumplimiento', baseFilter, accessibleBases],
    queryFn: async () => {
      const results: CumplimientoBase[] = [];
      
      // Get bases to report on - respect user's accessible bases
      const basesToReport = baseFilter === 'all' 
        ? accessibleBases
        : [baseFilter];

      for (const baseNombre of basesToReport) {
        // Get maquinistas count
        const { data: maqs } = await supabase
          .from('maquinistas')
          .select('id')
          .eq('base', baseNombre)
          .eq('activo', true);

        const maqIds = maqs?.map(m => m.id) || [];
        
        if (maqIds.length === 0) continue;

        // PE 16.03 stats
        const { data: exp1603 } = await supabase
          .from('expedientes_1603')
          .select('id')
          .in('maquinista_id', maqIds)
          .eq('estado', 'abierto');

        let pe1603Cumplimiento = 0;
        if (exp1603 && exp1603.length > 0) {
          const expIds = exp1603.map(e => e.id);
          const { data: plan1603 } = await supabase
            .from('plan_1603')
            .select('id, actuacion_id')
            .in('expediente_id', expIds);
          
          if (plan1603 && plan1603.length > 0) {
            const realizadas = plan1603.filter(p => p.actuacion_id).length;
            pe1603Cumplimiento = Math.round((realizadas / plan1603.length) * 100);
          }
        }

        // PE 12.01 stats
        const { data: exp1201 } = await supabase
          .from('expedientes_1201')
          .select('id')
          .in('maquinista_id', maqIds)
          .eq('estado', 'abierto');

        let pe1201Cumplimiento = 0;
        if (exp1201 && exp1201.length > 0) {
          const expIds = exp1201.map(e => e.id);
          const { data: plan1201 } = await supabase
            .from('plan_1201')
            .select('id, actuacion_id, estado, obligatorio')
            .in('expediente_id', expIds);
          
          if (plan1201) {
            // % cumplimiento = acciones registradas / bloques que proceden (excluye no_procede)
            const bloquesQueProceden = plan1201.filter(p => p.estado !== 'no_procede').length;
            const accionesRegistradas = plan1201.filter(p => p.actuacion_id && p.estado !== 'no_procede').length;
            if (bloquesQueProceden > 0) {
              pe1201Cumplimiento = Math.round((accionesRegistradas / bloquesQueProceden) * 100);
            }
          }
        }

        // Certificaciones stats
        const { data: maqCerts } = await supabase
          .from('maquinista_certificaciones')
          .select('id, obtenida')
          .in('maquinista_id', maqIds);

        const certTotal = maqCerts?.filter(c => c.obtenida).length || 0;
        const certVigentes = certTotal; // Simplified - would need full calculation

        results.push({
          base: baseNombre,
          maquinistas: maqIds.length,
          pe1603Activos: exp1603?.length || 0,
          pe1603Cumplimiento,
          pe1201Activos: exp1201?.length || 0,
          pe1201Cumplimiento,
          certVigentes,
          certTotal
        });
      }

      return results;
    },
    enabled: accessibleBases.length > 0
  });

  // Placeholder for partes summary - would need partes table
  const partesSummary: ParteSummary[] = [
    { mes: 'Enero 2026', totalPartes: 0, procesados: 0, pendientes: 0, errores: 0 },
  ];

  const getCumplimientoBadge = (porcentaje: number) => {
    if (porcentaje >= 80) return <Badge className="bg-status-ok text-white">{porcentaje}%</Badge>;
    if (porcentaje >= 50) return <Badge className="bg-status-proximo text-white">{porcentaje}%</Badge>;
    return <Badge className="bg-status-vencido text-white">{porcentaje}%</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Auditoría e Informes</h1>
            <p className="text-muted-foreground">
              Genera informes de cumplimiento SGS y controla el registro de partes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="default" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="cumplimiento" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Estado de Cumplimiento
            </TabsTrigger>
            <TabsTrigger value="partes" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Control de Partes
            </TabsTrigger>
          </TabsList>

          {/* Cumplimiento Tab */}
          <TabsContent value="cumplimiento" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-base">Filtros del Informe</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Base</Label>
                    <Select value={baseFilter} onValueChange={setBaseFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las bases" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las bases</SelectItem>
                        {bases?.map(base => (
                          <SelectItem key={base.id} value={base.nombre}>
                            {base.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha desde</Label>
                    <Input
                      type="date"
                      value={fechaDesde}
                      onChange={(e) => setFechaDesde(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha hasta</Label>
                    <Input
                      type="date"
                      value={fechaHasta}
                      onChange={(e) => setFechaHasta(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Bases Reportadas</p>
                      <p className="text-2xl font-bold">{cumplimientoData?.length || 0}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Expedientes PE 16.03</p>
                      <p className="text-2xl font-bold">
                        {cumplimientoData?.reduce((acc, c) => acc + c.pe1603Activos, 0) || 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-blue-500/10">
                      <FileBarChart className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Expedientes PE 12.01</p>
                      <p className="text-2xl font-bold">
                        {cumplimientoData?.reduce((acc, c) => acc + c.pe1201Activos, 0) || 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-amber-500/10">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Maquinistas Activos</p>
                      <p className="text-2xl font-bold">
                        {cumplimientoData?.reduce((acc, c) => acc + c.maquinistas, 0) || 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-green-500/10">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cumplimiento Table */}
            <Card>
              <CardHeader>
                <CardTitle>Informe de Cumplimiento por Base</CardTitle>
                <CardDescription>
                  Resumen del estado de cumplimiento de los procesos SGS
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingCumplimiento ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Cargando datos...
                  </div>
                ) : cumplimientoData && cumplimientoData.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Base</TableHead>
                        <TableHead className="text-center">Maquinistas</TableHead>
                        <TableHead className="text-center">PE 16.03 Activos</TableHead>
                        <TableHead className="text-center">% Cumplimiento</TableHead>
                        <TableHead className="text-center">PE 12.01 Activos</TableHead>
                        <TableHead className="text-center">% Cumplimiento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cumplimientoData.map((row) => (
                        <TableRow key={row.base}>
                          <TableCell className="font-medium">{row.base}</TableCell>
                          <TableCell className="text-center">{row.maquinistas}</TableCell>
                          <TableCell className="text-center">{row.pe1603Activos}</TableCell>
                          <TableCell className="text-center">
                            {getCumplimientoBadge(row.pe1603Cumplimiento)}
                          </TableCell>
                          <TableCell className="text-center">{row.pe1201Activos}</TableCell>
                          <TableCell className="text-center">
                            {getCumplimientoBadge(row.pe1201Cumplimiento)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay datos disponibles para el filtro seleccionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Partes Tab */}
          <TabsContent value="partes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Registro de Control de Partes</CardTitle>
                <CardDescription>
                  Resumen mensual de partes procesados por el sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Módulo en desarrollo</p>
                  <p className="text-sm mt-2">
                    El registro de control de partes estará disponible próximamente.
                    Incluirá estadísticas de procesamiento, tasas de error y trazabilidad.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}