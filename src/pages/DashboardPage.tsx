import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { KPICard } from '@/components/KPICard';
import { AlertasPanel } from '@/components/dashboard/AlertasPanel';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  AlertTriangle, 
  Clock, 
  CheckCircle,
  FileCheck, 
  AlertCircle,
  TrendingUp,
  Percent,
  CalendarCheck,
  Droplets,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useBaseFilter } from '@/hooks/useBaseFilter';
import { useDashboardStats } from '@/hooks/useDashboardStats';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [baseFilter, setBaseFilter] = useState<string>('all');
  
  const { getAccessibleBases, isAdmin } = useBaseFilter();
  
  const effectiveBaseFilter = baseFilter === 'all' && !isAdmin && getAccessibleBases.length === 1 
    ? getAccessibleBases[0] 
    : baseFilter;
  
  const { stats, loading } = useDashboardStats(effectiveBaseFilter === 'all' ? undefined : effectiveBaseFilter);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Cuadro de Mando</h1>
            <p className="text-muted-foreground">
              Visión general del estado de vigilancia • {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          <Select value={effectiveBaseFilter} onValueChange={setBaseFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Todas las bases" />
            </SelectTrigger>
            <SelectContent>
              {isAdmin && <SelectItem value="all">Todas las bases</SelectItem>}
              {getAccessibleBases.map(base => (
                <SelectItem key={base} value={base}>{base}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Row 1: Maquinistas y Certificaciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Maquinistas Activos"
            value={stats.maquinistasActivos}
            subtitle={`de ${stats.totalMaquinistas} en censo`}
            icon={Users}
            variant="default"
            onClick={() => navigate('/maquinistas')}
          />
          <KPICard
            title="Cert. Vencidas"
            value={stats.certificacionesVencidas}
            subtitle="por inactividad"
            icon={AlertTriangle}
            variant="danger"
            onClick={() => navigate('/certificaciones')}
          />
          <KPICard
            title="Cert. Próximas (3m)"
            value={stats.certificacionesProximas}
            subtitle="próximas a vencer"
            icon={Clock}
            variant="warning"
            onClick={() => navigate('/certificaciones')}
          />
          <KPICard
            title="Cert. en Vigor"
            value={`${stats.porcentajeVigentes}%`}
            subtitle={`${stats.certificacionesVigentes} de ${stats.totalCertificacionesVigiladas}`}
            icon={CheckCircle}
            variant="success"
            onClick={() => navigate('/certificaciones')}
          />
        </div>

        {/* Row 2: Plan de Acción Anual */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" />
              Plan de Acción Anual {new Date().getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-status-ok" />
                  <span className="text-sm text-muted-foreground">Maquinistas Cumplen</span>
                </div>
                <p className="text-2xl font-bold">{stats.planAnualMaquinistasCumplen}</p>
                <p className="text-xs text-muted-foreground mt-1">de {stats.planAnualTotalEvaluados} evaluados</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-status-proximo" />
                  <span className="text-sm text-muted-foreground">Pendientes</span>
                </div>
                <p className={`text-2xl font-bold ${(stats.planAnualTotalEvaluados - stats.planAnualMaquinistasCumplen) > 0 ? 'text-status-proximo' : ''}`}>
                  {stats.planAnualTotalEvaluados - stats.planAnualMaquinistasCumplen}
                </p>
                <p className="text-xs text-muted-foreground mt-1">con criterios sin cumplir</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Cumplimiento</span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">{stats.planAnualPorcentaje}%</p>
                  <Progress value={stats.planAnualPorcentaje} className="flex-1 h-2" />
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Cobertura Drogas</span>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`text-2xl font-bold ${stats.planAnualCoberturaDrogas < 25 ? 'text-status-vencido' : 'text-status-ok'}`}>
                    {stats.planAnualCoberturaDrogas}%
                  </p>
                  <Progress value={stats.planAnualCoberturaDrogas} className="flex-1 h-2" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">objetivo ≥25%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 3: PE 16.03 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-primary" />
              PE 16.03 - Personal de Nuevo Acceso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div 
                className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/pe-1603')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileCheck className="w-4 h-4 text-status-ok" />
                  <span className="text-sm text-muted-foreground">Expedientes Activos</span>
                </div>
                <p className="text-2xl font-bold">{stats.pe1603ExpedientesActivos}</p>
              </div>
              <div 
                className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/pe-1603')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-status-vencido" />
                  <span className="text-sm text-muted-foreground">Acciones Vencidas</span>
                </div>
                <p className={`text-2xl font-bold ${stats.pe1603AccionesVencidas > 0 ? 'text-status-vencido' : ''}`}>
                  {stats.pe1603AccionesVencidas}
                </p>
              </div>
              <div 
                className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/pe-1603')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-status-proximo" />
                  <span className="text-sm text-muted-foreground">Acciones Pendientes</span>
                </div>
                <p className={`text-2xl font-bold ${stats.pe1603AccionesPendientes > 0 ? 'text-status-proximo' : ''}`}>
                  {stats.pe1603AccionesPendientes}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50" title="Realizadas / total de bloques planificados">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Cumplim. Total</span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">{stats.pe1603PorcentajeCumplimiento}%</p>
                  <Progress value={stats.pe1603PorcentajeCumplimiento} className="flex-1 h-2" />
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50" title="Realizadas hasta hoy / bloques que debían haberse realizado a fecha de hoy">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Cumplim. a Hoy</span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">{stats.pe1603PorcentajeCumplimientoHoy}%</p>
                  <Progress value={stats.pe1603PorcentajeCumplimientoHoy} className="flex-1 h-2" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {stats.pe1603BloquesRealizadosHoy} / {stats.pe1603BloquesExigiblesHoy} exigibles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 4: PE 12.01 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-proximo" />
              PE 12.01 - Factor Humano tras Suceso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div 
                className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/pe-1201')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileCheck className="w-4 h-4 text-status-proximo" />
                  <span className="text-sm text-muted-foreground">Fichas Abiertas</span>
                </div>
                <p className="text-2xl font-bold">{stats.pe1201ExpedientesActivos}</p>
              </div>
              <div 
                className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/pe-1201')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-status-vencido" />
                  <span className="text-sm text-muted-foreground">Acciones Vencidas</span>
                </div>
                <p className={`text-2xl font-bold ${stats.pe1201AccionesVencidas > 0 ? 'text-status-vencido' : ''}`}>
                  {stats.pe1201AccionesVencidas}
                </p>
              </div>
              <div 
                className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                onClick={() => navigate('/pe-1201')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-status-proximo" />
                  <span className="text-sm text-muted-foreground">Acciones Pendientes</span>
                </div>
                <p className={`text-2xl font-bold ${stats.pe1201AccionesPendientes > 0 ? 'text-status-proximo' : ''}`}>
                  {stats.pe1201AccionesPendientes}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50" title="Realizadas / total bloques planificados">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Cumplim. Total</span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">{stats.pe1201PorcentajeCumplimiento}%</p>
                  <Progress value={stats.pe1201PorcentajeCumplimiento} className="flex-1 h-2" />
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/50" title="Realizadas hasta hoy / bloques cuya fecha objetivo ya ha pasado">
                <div className="flex items-center gap-2 mb-1">
                  <Percent className="w-4 h-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Cumplim. a Hoy</span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-2xl font-bold">{stats.pe1201PorcentajeCumplimientoHoy}%</p>
                  <Progress value={stats.pe1201PorcentajeCumplimientoHoy} className="flex-1 h-2" />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {stats.pe1201BloquesRealizadosHoy} / {stats.pe1201BloquesExigiblesHoy} exigibles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Panel de Alertas */}
        <AlertasPanel baseFilter={effectiveBaseFilter} maxItems={15} />
      </div>
    </AppLayout>
  );
}