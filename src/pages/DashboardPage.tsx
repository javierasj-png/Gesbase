import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { KPICard } from '@/components/KPICard';
import { StatusBadge } from '@/components/StatusBadge';
import { AlertasPanel } from '@/components/dashboard/AlertasPanel';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  AlertTriangle, 
  Clock, 
  HelpCircle, 
  FileCheck, 
  AlertCircle,
  TrendingUp
} from 'lucide-react';
import { calcularKPIs, maquinistasMock, expedientes1603Mock, expedientes1201Mock } from '@/data/mockData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useBaseFilter } from '@/hooks/useBaseFilter';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [baseFilter, setBaseFilter] = useState<string>('all');
  
  const { getAccessibleBases, filterMaquinistas, filterByBase, isAdmin } = useBaseFilter();
  
  // Si el usuario tiene una sola base asignada, usarla como filtro por defecto
  const effectiveBaseFilter = baseFilter === 'all' && !isAdmin && getAccessibleBases.length === 1 
    ? getAccessibleBases[0] 
    : baseFilter;
  
  const kpis = calcularKPIs(effectiveBaseFilter === 'all' ? undefined : effectiveBaseFilter);

  // Filtrar expedientes por bases accesibles
  const maquinistasAccesibles = filterMaquinistas(maquinistasMock);
  const maquinistaIds = new Set(maquinistasAccesibles.map(m => m.id));
  
  const expedientes1603Filtrados = expedientes1603Mock.filter(e => maquinistaIds.has(e.maquinistaId));
  const expedientes1201Filtrados = expedientes1201Mock.filter(e => maquinistaIds.has(e.maquinistaId));

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
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

        {/* KPI Cards - Row 1: General */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Maquinistas Activos"
            value={kpis.maquinistasActivos}
            subtitle={`de ${kpis.totalMaquinistas} en censo`}
            icon={Users}
            variant="default"
            onClick={() => navigate('/maquinistas')}
          />
          <KPICard
            title="Cert. Vencidas"
            value={kpis.certVencido}
            subtitle="por inactividad"
            icon={AlertTriangle}
            variant="danger"
            onClick={() => navigate('/certificaciones')}
          />
          <KPICard
            title="Cert. Próximas"
            value={kpis.certProximo}
            subtitle="próximas a vencer"
            icon={Clock}
            variant="warning"
            onClick={() => navigate('/certificaciones')}
          />
          <KPICard
            title="Sin Evidencia"
            value={kpis.certSinEvidencia}
            subtitle="sin registro de servicio"
            icon={HelpCircle}
            variant="default"
          />
        </div>

        {/* KPI Cards - Row 2: SGS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="PE 16.03 Activos"
            value={kpis.exp1603Activos}
            subtitle="expedientes de nuevo acceso"
            icon={FileCheck}
            variant="success"
            onClick={() => navigate('/pe-1603')}
          />
          <KPICard
            title="Actuaciones 16.03 Vencidas"
            value={kpis.exp1603Vencidas}
            subtitle="fuera de ventana"
            icon={AlertCircle}
            variant="danger"
            onClick={() => navigate('/pe-1603')}
          />
          <KPICard
            title="PE 12.01 Abiertas"
            value={kpis.exp1201Abiertas}
            subtitle="fichas factor humano"
            icon={AlertTriangle}
            variant="warning"
            onClick={() => navigate('/pe-1201')}
          />
          <KPICard
            title="Actuaciones 12.01 Pendientes"
            value={kpis.exp1201Pendientes}
            subtitle="programadas sin realizar"
            icon={Clock}
            variant="warning"
            onClick={() => navigate('/pe-1201')}
          />
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de Alertas */}
          <AlertasPanel baseFilter={effectiveBaseFilter} maxItems={8} />

          {/* Expedientes Activos */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Expedientes SGS Activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* PE 16.03 */}
                {expedientes1603Filtrados.filter(e => e.estado === 'Activo').map(exp => {
                  const maquinista = maquinistasMock.find(m => m.id === exp.maquinistaId);
                  return (
                    <div 
                      key={exp.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/maquinistas/${exp.maquinistaId}?tab=pe1603`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-status-ok-bg flex items-center justify-center">
                          <FileCheck className="w-4 h-4 text-status-ok" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{maquinista?.nombreApellidos}</p>
                          <p className="text-xs text-muted-foreground">
                            PE 16.03 • Inicio: {format(exp.fechaInicio, 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>
                      <StatusBadge estado="Activo" size="sm" />
                    </div>
                  );
                })}

                {/* PE 12.01 */}
                {expedientes1201Filtrados.filter(e => e.estado === 'Abierta').map(exp => {
                  const maquinista = maquinistasMock.find(m => m.id === exp.maquinistaId);
                  return (
                    <div 
                      key={exp.id} 
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                      onClick={() => navigate(`/maquinistas/${exp.maquinistaId}?tab=pe1201`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-status-proximo-bg flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-status-proximo" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{maquinista?.nombreApellidos}</p>
                          <p className="text-xs text-muted-foreground">
                            PE 12.01 • Suceso: {exp.idSuceso}
                          </p>
                        </div>
                      </div>
                      <StatusBadge estado="Abierta" size="sm" />
                    </div>
                  );
                })}

                {expedientes1603Filtrados.filter(e => e.estado === 'Activo').length === 0 &&
                 expedientes1201Filtrados.filter(e => e.estado === 'Abierta').length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay expedientes activos
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
