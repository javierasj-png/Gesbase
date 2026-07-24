import { callGesbaseLLM } from "@/lib/callGesbaseLLM";
import { usePageMeta } from '@/hooks/usePageMeta';
import { getUmbralInfo } from '@/lib/cumplimientoUmbral';
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
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Filter,
  Loader2,
  Building2,
  Eye,
  Search,
} from 'lucide-react';
import { generatePartesPDF } from '@/utils/generatePartesPDF';
import { cn } from '@/lib/utils';
import type { Parte } from '@/types/partes';
import { VisitasBaseTab } from '@/components/auditoria/VisitasBaseTab';
import { generateAuditoriaPDF } from '@/utils/generateAuditoriaPDF';
import { format, subMonths, subYears } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useGlobalBaseFilter } from '@/hooks/useGlobalBaseFilter';

interface CumplimientoBase {
  base: string;
  maquinistas: number;
  pe1603Activos: number;
  pe1603Cumplimiento: number; // total
  pe1603CumplimientoHoy: number; // a fecha
  pe1603ExigiblesHoy: number;
  pe1603RealizadosHoy: number;
  pe1201Activos: number;
  pe1201Cumplimiento: number; // total
  pe1201CumplimientoHoy: number;
  pe1201ExigiblesHoy: number;
  pe1201RealizadosHoy: number;
  certVigentes: number;
  certTotal: number;
  planAnualCumplen: number;
  planAnualPorcentaje: number;
  coberturaDrogas: number;
}
const probarIA = async () => {
  try {
    const respuesta = await callGesbaseLLM({
      prompt: "Responde solo: conexión correcta con Gesbase",
    });

    console.log("Respuesta IA:", respuesta);
    alert(respuesta);
  } catch (error) {
    console.error(error);
    alert("Error conectando con la IA de Gesbase");
  }
};
const tipoColors: Record<string, string> = {
  'Incidencia': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'Retraso': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  'Avería': 'bg-red-500/10 text-red-600 border-red-500/20',
  'Seguridad': 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  'Otro': 'bg-muted text-muted-foreground border-border',
};

const informeColors: Record<string, string> = {
  'PAI': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  'Informe Conducción': 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
};

const estadoColors: Record<string, string> = {
  'Nuevo': 'bg-green-500/10 text-green-600 border-green-500/20',
  'En revisión': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  'Cerrado': 'bg-muted text-muted-foreground border-border',
};

export default function AuditoriaPage() {
  const { isAdmin, isGestor, assignedBases } = useAuth();
  usePageMeta({ title: 'Auditoría — Gestión de Base', description: 'Auditorías de base: visitas, control de partes y propuestas de mejora.', path: '/auditoria' });
  const [selectedTab, setSelectedTab] = useState('cumplimiento');
  const [fechaDesde, setFechaDesde] = useState(format(subMonths(new Date(), 3), 'yyyy-MM-dd'));
  const [fechaHasta, setFechaHasta] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [baseFilter, setBaseFilter] = useGlobalBaseFilter();
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Partes search & detail state
  const [partesSearch, setPartesSearch] = useState('');
  const [partesEstado, setPartesEstado] = useState('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedParte, setSelectedParte] = useState<Parte | null>(null);

  // Fetch bases for filter
  const { data: bases } = useQuery({
    queryKey: ['bases-auditoria', isAdmin, assignedBases],
    queryFn: async () => {
      let query = supabase
        .from('bases_conduccion')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      if (!isAdmin && assignedBases.length > 0) {
        query = query.in('nombre', assignedBases);
      }
      const { data } = await query;
      return data || [];
    }
  });

  const accessibleBases = bases?.map(b => b.nombre) || [];

  // Cumplimiento data
  const { data: cumplimientoData, isLoading: loadingCumplimiento } = useQuery({
    queryKey: ['auditoria-cumplimiento', baseFilter, accessibleBases],
    queryFn: async () => {
      const results: CumplimientoBase[] = [];
      const basesToReport = baseFilter === 'all' ? accessibleBases : [baseFilter];

      for (const baseNombre of basesToReport) {
        const { data: maqs } = await supabase
          .from('maquinistas')
          .select('id')
          .eq('base', baseNombre)
          .eq('activo', true);

        const maqIds = maqs?.map(m => m.id) || [];
        if (maqIds.length === 0) continue;

        const { data: exp1603 } = await supabase
          .from('expedientes_1603')
          .select('id')
          .in('maquinista_id', maqIds)
          .eq('estado', 'abierto');

        let pe1603Cumplimiento = 0;
        let pe1603CumplimientoHoy = 0;
        let pe1603ExigiblesHoy = 0;
        let pe1603RealizadosHoy = 0;
        if (exp1603 && exp1603.length > 0) {
          const expIds = exp1603.map(e => e.id);
          const { data: plan1603 } = await supabase
            .from('plan_1603')
            .select('id, actuacion_id, justificado_traslado, fin_ventana')
            .in('expediente_id', expIds);
          if (plan1603 && plan1603.length > 0) {
            // Excluir bloques justificados por traslado del cálculo de cumplimiento
            const bloquesComputables = plan1603.filter(p => !p.justificado_traslado);
            const realizadas = bloquesComputables.filter(p => p.actuacion_id).length;
            if (bloquesComputables.length > 0) {
              pe1603Cumplimiento = Math.round((realizadas / bloquesComputables.length) * 100);
            }
            // Cumplimiento a día de hoy
            const hoy = new Date();
            hoy.setHours(23, 59, 59, 999);
            const exigibles = bloquesComputables.filter(p => {
              if (p.actuacion_id) return true;
              if (!p.fin_ventana) return false;
              return new Date(p.fin_ventana) <= hoy;
            });
            pe1603ExigiblesHoy = exigibles.length;
            pe1603RealizadosHoy = exigibles.filter(p => p.actuacion_id).length;
            if (exigibles.length > 0) {
              pe1603CumplimientoHoy = Math.round((pe1603RealizadosHoy / exigibles.length) * 100);
            }
          }
        }

        const { data: exp1201 } = await supabase
          .from('expedientes_1201')
          .select('id')
          .in('maquinista_id', maqIds)
          .eq('estado', 'abierto');

        let pe1201Cumplimiento = 0;
        let pe1201CumplimientoHoy = 0;
        let pe1201ExigiblesHoy = 0;
        let pe1201RealizadosHoy = 0;
        if (exp1201 && exp1201.length > 0) {
          const expIds = exp1201.map(e => e.id);
          const { data: plan1201 } = await supabase
            .from('plan_1201')
            .select('id, actuacion_id, estado, obligatorio, fecha_objetivo')
            .in('expediente_id', expIds);
          if (plan1201) {
            const bloquesProceden = plan1201.filter(p => p.estado !== 'no_procede');
            const accionesRegistradas = bloquesProceden.filter(p => p.actuacion_id).length;
            if (bloquesProceden.length > 0) {
              pe1201Cumplimiento = Math.round((accionesRegistradas / bloquesProceden.length) * 100);
            }
            const hoy = new Date();
            hoy.setHours(23, 59, 59, 999);
            const exigibles = bloquesProceden.filter(p => {
              if (p.actuacion_id) return true;
              if (!p.fecha_objetivo) return false;
              return new Date(p.fecha_objetivo) <= hoy;
            });
            pe1201ExigiblesHoy = exigibles.length;
            pe1201RealizadosHoy = exigibles.filter(p => p.actuacion_id).length;
            if (exigibles.length > 0) {
              pe1201CumplimientoHoy = Math.round((pe1201RealizadosHoy / exigibles.length) * 100);
            }
          }
        }

        const { data: maqCerts } = await supabase
          .from('maquinista_certificaciones')
          .select('id, obtenida')
          .in('maquinista_id', maqIds);

        const certTotal = maqCerts?.filter(c => c.obtenida).length || 0;

        // Plan de Acción Anual
        const currentYear = new Date().getFullYear();
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;

        // Get base redes
        const { data: baseInfo } = await supabase
          .from('bases_conduccion')
          .select('redes')
          .eq('nombre', baseNombre)
          .maybeSingle();
        const baseRedes = baseInfo?.redes === 'ambas' ? ['convencional', 'av'] : baseInfo?.redes === 'av' ? ['av'] : ['convencional'];

        // Plan anual actuaciones
        const { data: planAnualActs } = await supabase
          .from('actuaciones_plan_anual')
          .select('maquinista_id, tipo, red, km_recorridos')
          .in('maquinista_id', maqIds)
          .eq('anio', currentYear);

        // PE 16.03 actuaciones for plan anual
        const { data: exps1603All } = await supabase
          .from('expedientes_1603')
          .select('id, maquinista_id')
          .in('maquinista_id', maqIds);

        let acts1603ForPlan: { expediente_id: string; tipo: string; km_recorridos: number | null }[] = [];
        const expMaqMap = new Map<string, string>();
        if (exps1603All && exps1603All.length > 0) {
          exps1603All.forEach(e => expMaqMap.set(e.id, e.maquinista_id));
          const { data: a1603 } = await supabase
            .from('actuaciones_1603')
            .select('expediente_id, tipo, km_recorridos')
            .in('expediente_id', exps1603All.map(e => e.id))
            .gte('fecha_real', yearStart)
            .lte('fecha_real', yearEnd);
          acts1603ForPlan = a1603 || [];
        }

        // PE 12.01 reciente (3 años)
        const threeYearsAgo = `${currentYear - 3}-01-01`;
        const { data: recientes1201 } = await supabase
          .from('expedientes_1201')
          .select('maquinista_id')
          .in('maquinista_id', maqIds)
          .gte('fecha_primer_servicio', threeYearsAgo);
        const maqsCon1201 = new Set((recientes1201 || []).map(e => e.maquinista_id));

        // Drug coverage
        const maqsConDrogas = new Set<string>();
        (planAnualActs || []).filter(a => a.tipo === 'drogas').forEach(a => maqsConDrogas.add(a.maquinista_id));
        acts1603ForPlan.filter(a => a.tipo === 'drogas').forEach(a => {
          const mid = expMaqMap.get(a.expediente_id);
          if (mid) maqsConDrogas.add(mid);
        });
        const coberturaDrogas = maqIds.length > 0 ? Math.round((maqsConDrogas.size / maqIds.length) * 100) : 0;

        // Per-maquinista evaluation
        let planAnualCumplen = 0;
        for (const maqId of maqIds) {
          const acompReq = maqsCon1201.has(maqId) ? 2 : 1;
          const maqPlan = (planAnualActs || []).filter(a => a.maquinista_id === maqId);
          const maq1603 = acts1603ForPlan.filter(a => expMaqMap.get(a.expediente_id) === maqId);
          const allActs = [
            ...maqPlan.map(a => ({ tipo: a.tipo, red: a.red, km: a.km_recorridos ? Number(a.km_recorridos) : 0, src: 'plan' })),
            ...maq1603.map(a => ({ tipo: a.tipo, red: null as string | null, km: a.km_recorridos ? Number(a.km_recorridos) : 0, src: 'pe1603' })),
          ];

          let cumple = true;
          for (const red of baseRedes) {
            const regs = allActs.filter(a => a.tipo === 'registro' && (a.red === red || (a.src === 'pe1603' && a.red === null)));
            if (regs.reduce((s, a) => s + a.km, 0) < 100) cumple = false;
            const acomps = allActs.filter(a => a.tipo === 'acompanamiento' && (a.red === red || (a.src === 'pe1603' && a.red === null)));
            if (acomps.length < acompReq) cumple = false;
          }
          if (allActs.filter(a => a.tipo === 'alcohol').length < 1) cumple = false;
          if (cumple) planAnualCumplen++;
        }

        const planAnualPorcentaje = maqIds.length > 0 ? Math.round((planAnualCumplen / maqIds.length) * 100) : 0;

        results.push({
          base: baseNombre,
          maquinistas: maqIds.length,
          pe1603Activos: exp1603?.length || 0,
          pe1603Cumplimiento,
          pe1603CumplimientoHoy,
          pe1603ExigiblesHoy,
          pe1603RealizadosHoy,
          pe1201Activos: exp1201?.length || 0,
          pe1201Cumplimiento,
          pe1201CumplimientoHoy,
          pe1201ExigiblesHoy,
          pe1201RealizadosHoy,
          certVigentes: certTotal,
          certTotal,
          planAnualCumplen,
          planAnualPorcentaje,
          coberturaDrogas,
        });
      }

      return results;
    },
    enabled: accessibleBases.length > 0
  });

  // Partes data filtered by period & base
  const { data: partes = [], isLoading: loadingPartes } = useQuery({
    queryKey: ['auditoria-partes', fechaDesde, fechaHasta, baseFilter],
    queryFn: async () => {
      let query = supabase
        .from('partes')
        .select('*')
        .gte('fecha_parte', fechaDesde)
        .lte('fecha_parte', fechaHasta)
        .order('fecha_parte', { ascending: false });

      if (baseFilter !== 'all') {
        query = query.eq('base', baseFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Parte[];
    }
  });

  // Filter partes by search & estado
  const filteredPartes = partes.filter(p => {
    const matchesSearch = !partesSearch ||
      (p.numero_parte?.toLowerCase().includes(partesSearch.toLowerCase())) ||
      (p.maquinista_texto?.toLowerCase().includes(partesSearch.toLowerCase())) ||
      (p.base?.toLowerCase().includes(partesSearch.toLowerCase()));
    const matchesEstado = partesEstado === 'all' || p.estado === partesEstado;
    return matchesSearch && matchesEstado;
  });

  // Partes KPIs
  const totalPartes = partes.length;
  const partesCerrados = partes.filter(p => p.estado === 'Cerrado').length;
  const partesNuevos = partes.filter(p => p.estado === 'Nuevo').length;

  const getCumplimientoBadge = (porcentaje: number) => {
    const info = getUmbralInfo(porcentaje);
    return <Badge className={info.badgeClass} title={info.label}>{porcentaje}%</Badge>;
  };

  // Drogas: criterio único ≥25% de cobertura de la base (no aplica escala SGS general)
  const getDrogasBadge = (porcentaje: number) => {
    const cumple = porcentaje >= 25;
    const cls = cumple ? 'bg-status-ok text-primary-foreground' : 'bg-status-vencido text-primary-foreground';
    const label = cumple ? 'Cumple (≥25%)' : 'No cumple (<25%)';
    return <Badge className={cls} title={label}>{porcentaje}%</Badge>;
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
          {selectedTab === 'cumplimiento' && (
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={generatingPDF || accessibleBases.length === 0}
                onClick={async () => {
                  setGeneratingPDF(true);
                  try {
                    await generateAuditoriaPDF({ bases: accessibleBases, baseFilter });
                  } catch (e) {
                    console.error('Error generating audit PDF:', e);
                  } finally {
                    setGeneratingPDF(false);
                  }
                }}
              >
                {generatingPDF ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                {generatingPDF ? 'Generando...' : 'Exportar PDF'}
              </Button>
            </div>
          )}

        </div>

        {/* Shared Filters */}
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

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-3">
            <TabsTrigger value="cumplimiento" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Estado de Cumplimiento
            </TabsTrigger>
            <TabsTrigger value="partes" className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" />
              Control de Partes
            </TabsTrigger>
            <TabsTrigger value="visitas" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Visitas a la Base
            </TabsTrigger>
          </TabsList>

          {/* Cumplimiento Tab */}
          <TabsContent value="cumplimiento" className="space-y-6">
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
                      <p className="text-sm text-muted-foreground">Maquinistas Activos</p>
                      <p className="text-2xl font-bold">
                        {cumplimientoData?.reduce((acc, c) => acc + c.maquinistas, 0) || 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
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
                    <div className="p-3 rounded-full bg-primary/10">
                      <FileBarChart className="w-5 h-5 text-primary" />
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
                    <div className="p-3 rounded-full bg-destructive/10">
                      <AlertTriangle className="w-5 h-5 text-destructive" />
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
                        <TableHead className="text-center">Plan Anual</TableHead>
                        <TableHead className="text-center">Drogas</TableHead>
                        <TableHead className="text-center">PE 16.03</TableHead>
                        <TableHead className="text-center" title="Realizadas / total bloques planificados">% 16.03 Total</TableHead>
                        <TableHead className="text-center" title="Realizadas / bloques exigibles a día de hoy">% 16.03 Hoy</TableHead>
                        <TableHead className="text-center">PE 12.01</TableHead>
                        <TableHead className="text-center" title="Realizadas / total bloques planificados">% 12.01 Total</TableHead>
                        <TableHead className="text-center" title="Realizadas / bloques exigibles a día de hoy">% 12.01 Hoy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cumplimientoData.map((row) => (
                        <TableRow key={row.base}>
                          <TableCell className="font-medium">{row.base}</TableCell>
                          <TableCell className="text-center">{row.maquinistas}</TableCell>
                          <TableCell className="text-center">
                            {getCumplimientoBadge(row.planAnualPorcentaje)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getDrogasBadge(row.coberturaDrogas)}
                          </TableCell>
                          <TableCell className="text-center">{row.pe1603Activos}</TableCell>
                          <TableCell className="text-center">
                            {getCumplimientoBadge(row.pe1603Cumplimiento)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              {getCumplimientoBadge(row.pe1603CumplimientoHoy)}
                              <span className="text-[10px] text-muted-foreground">
                                {row.pe1603RealizadosHoy}/{row.pe1603ExigiblesHoy}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{row.pe1201Activos}</TableCell>
                          <TableCell className="text-center">
                            {getCumplimientoBadge(row.pe1201Cumplimiento)}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              {getCumplimientoBadge(row.pe1201CumplimientoHoy)}
                              <span className="text-[10px] text-muted-foreground">
                                {row.pe1201RealizadosHoy}/{row.pe1201ExigiblesHoy}
                              </span>
                            </div>
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

          {/* Control de Partes Tab */}
          <TabsContent value="partes" className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Partes</p>
                      <p className="text-2xl font-bold">{totalPartes}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Nuevos</p>
                      <p className="text-2xl font-bold">{partesNuevos}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <ClipboardCheck className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Cerrados</p>
                      <p className="text-2xl font-bold">{partesCerrados}</p>
                    </div>
                    <div className="p-3 rounded-full bg-primary/10">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Partes Table */}
            <Card>
              <CardHeader>
                <CardTitle>Historial de Partes</CardTitle>
                <CardDescription>
                  Partes registrados en el período {format(new Date(fechaDesde), 'dd/MM/yyyy', { locale: es })} – {format(new Date(fechaHasta), 'dd/MM/yyyy', { locale: es })}
                  {baseFilter !== 'all' ? ` · ${baseFilter}` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nº parte, maquinista o base..."
                      value={partesSearch}
                      onChange={(e) => setPartesSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={partesEstado} onValueChange={setPartesEstado}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="Nuevo">Nuevo</SelectItem>
                      <SelectItem value="En revisión">En revisión</SelectItem>
                      <SelectItem value="Cerrado">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="default"
                    onClick={() => generatePartesPDF(
                      filteredPartes,
                      fechaDesde ? new Date(fechaDesde) : undefined,
                      fechaHasta ? new Date(fechaHasta) : undefined,
                    )}
                    disabled={filteredPartes.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar PDF
                  </Button>
                </div>

                {loadingPartes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : filteredPartes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">No hay partes en el período seleccionado</p>
                    <p className="text-xs">Ajusta los filtros de fecha o base</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[160px]">Tipo Informe</TableHead>
                          <TableHead className="w-[100px]">Fecha</TableHead>
                          <TableHead>Base</TableHead>
                          <TableHead>Maquinista</TableHead>
                          <TableHead>Línea/Tramo</TableHead>
                          <TableHead className="w-[100px]">Tipo Suceso</TableHead>
                          <TableHead className="w-[110px]">Estado</TableHead>
                          <TableHead className="w-[60px] text-right">Ver</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPartes.map((parte) => (
                          <TableRow key={parte.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                              {parte.tipo_informe ? (
                                <Badge variant="outline" className={cn("text-xs", informeColors[parte.tipo_informe] || '')}>
                                  {parte.tipo_informe}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {parte.fecha_parte
                                ? format(new Date(parte.fecha_parte), 'dd/MM/yyyy', { locale: es })
                                : '-'}
                            </TableCell>
                            <TableCell>{parte.base || '-'}</TableCell>
                            <TableCell>{parte.maquinista_texto || '-'}</TableCell>
                            <TableCell>{parte.linea_tramo || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-xs", tipoColors[parte.tipo_parte] || tipoColors['Otro'])}>
                                {parte.tipo_parte}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-xs", estadoColors[parte.estado] || estadoColors['Cerrado'])}>
                                {parte.estado}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => { setSelectedParte(parte); setDetailOpen(true); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visitas Tab */}
          <TabsContent value="visitas" className="space-y-6">
            <VisitasBaseTab baseFilter={baseFilter} bases={bases || []} fechaDesde={fechaDesde} fechaHasta={fechaHasta} canGenerateReport={isAdmin} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Parte {selectedParte?.numero_parte || 'sin número'}
            </DialogTitle>
          </DialogHeader>
          {selectedParte && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Fecha: </span><span className="font-medium">{selectedParte.fecha_parte ? format(new Date(selectedParte.fecha_parte), 'dd/MM/yyyy', { locale: es }) : '-'}</span></div>
                  <div><span className="text-muted-foreground">Hora: </span><span className="font-medium">{selectedParte.hora_parte || '-'}</span></div>
                  <div><span className="text-muted-foreground">Base: </span><span className="font-medium">{selectedParte.base || '-'}</span></div>
                  <div><span className="text-muted-foreground">Maquinista: </span><span className="font-medium">{selectedParte.maquinista_texto || '-'}</span></div>
                  <div><span className="text-muted-foreground">Tren/Servicio: </span><span className="font-medium">{selectedParte.tren_servicio || '-'}</span></div>
                  <div><span className="text-muted-foreground">Línea/Tramo: </span><span className="font-medium">{selectedParte.linea_tramo || '-'}</span></div>
                  <div><span className="text-muted-foreground">Tipo: </span><span className="font-medium">{selectedParte.tipo_parte}</span></div>
                  <div><span className="text-muted-foreground">Min. retraso: </span><span className="font-medium">{selectedParte.minutos_retraso}</span></div>
                </div>
                <Separator />
                {selectedParte.descripcion_hechos && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm whitespace-pre-line">{selectedParte.descripcion_hechos}</p>
                  </div>
                )}
                {selectedParte.causa && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Causa</p>
                    <p className="text-sm">{selectedParte.causa}</p>
                  </div>
                )}
                {selectedParte.acciones_tomadas && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Acciones tomadas</p>
                    <p className="text-sm">{selectedParte.acciones_tomadas}</p>
                  </div>
                )}
                {selectedParte.observaciones && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Observaciones</p>
                    <p className="text-sm">{selectedParte.observaciones}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
