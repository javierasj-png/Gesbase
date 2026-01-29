import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  FileCheck,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { useExpedientes1603 } from '@/hooks/useExpedientes1603';
import { useAuth } from '@/contexts/AuthContext';
import { format, addYears } from 'date-fns';

export default function PE1603Page() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  
  const { expedientes, loading, kpis } = useExpedientes1603();
  const { isAdmin, assignedBases } = useAuth();
  
  // Obtener bases disponibles para el filtro (solo las asignadas o todas si es admin)
  const availableBases = isAdmin 
    ? [...new Set(expedientes.map(e => e.maquinista?.base).filter(Boolean))] as string[]
    : assignedBases;

  // Filtrar
  const filtered = expedientes.filter(item => {
    const matchesSearch = 
      item.maquinista?.nombre_apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maquinista?.matricula.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || item.maquinista?.base === baseFilter;
    const matchesEstado = estadoFilter === 'all' || item.expediente.estado === estadoFilter;
    return matchesSearch && matchesBase && matchesEstado;
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">PE 16.03 - Nuevo Acceso</h1>
          <p className="text-muted-foreground">
            Vigilancia durante 3 años desde primer servicio en la dependencia. 
            Los expedientes se generan automáticamente al dar de alta maquinistas de nuevo acceso.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-status-ok">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{kpis.totalActivos}</p>
                  <p className="text-sm text-muted-foreground">Expedientes activos</p>
                </div>
                <FileCheck className="w-8 h-8 text-status-ok" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-status-vencido">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-status-vencido">{kpis.conVencidas}</p>
                  <p className="text-sm text-muted-foreground">Con actuaciones vencidas</p>
                </div>
                <XCircle className="w-8 h-8 text-status-vencido" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-status-proximo">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-status-proximo">{kpis.conEnVentana}</p>
                  <p className="text-sm text-muted-foreground">Con actuaciones en ventana</p>
                </div>
                <Clock className="w-8 h-8 text-status-proximo" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por maquinista..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={baseFilter} onValueChange={setBaseFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Todas las bases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las bases</SelectItem>
                  {availableBases.map(base => (
                    <SelectItem key={base} value={base}>{base}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="abierto">Activos</SelectItem>
                  <SelectItem value="cerrado">Cerrados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Expedientes List */}
        {!loading && (
          <div className="space-y-4">
            {filtered.map(({ expediente, maquinista, resumen }) => {
              // Calculate fecha_fin_prevista from fecha_primer_servicio
              const fechaFinPrevista = expediente.fecha_primer_servicio 
                ? addYears(new Date(expediente.fecha_primer_servicio), 3)
                : null;

              return (
                <Card 
                  key={expediente.id} 
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/maquinistas/${expediente.maquinista_id}?tab=pe1603`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <FileCheck className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{maquinista?.nombre_apellidos || 'Maquinista desconocido'}</h3>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-mono">{maquinista?.matricula}</span> • {maquinista?.base}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Inicio: {format(new Date(expediente.fecha_inicio), 'dd/MM/yyyy')}
                            </span>
                            {fechaFinPrevista && (
                              <>
                                <span>→</span>
                                <span>Fin: {format(fechaFinPrevista, 'dd/MM/yyyy')}</span>
                                <span className={resumen.diasRestantes < 90 ? 'text-status-proximo font-medium' : ''}>
                                  ({resumen.diasRestantes} días restantes)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* Resumen de bloques */}
                        <div className="flex items-center gap-2">
                          {resumen.vencidas > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-status-vencido-bg">
                              <XCircle className="w-3 h-3 text-status-vencido" />
                              <span className="text-xs font-medium text-status-vencido">{resumen.vencidas}</span>
                            </div>
                          )}
                          {resumen.enVentana > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-status-proximo-bg">
                              <Clock className="w-3 h-3 text-status-proximo" />
                              <span className="text-xs font-medium text-status-proximo">{resumen.enVentana}</span>
                            </div>
                          )}
                          {resumen.cumplidas > 0 && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-status-cumplida-bg">
                              <CheckCircle2 className="w-3 h-3 text-status-cumplida" />
                              <span className="text-xs font-medium text-status-cumplida">{resumen.cumplidas}</span>
                            </div>
                          )}
                        </div>
                        
                        <StatusBadge estado={expediente.estado === 'abierto' ? 'Activo' : 'Cerrado'} />
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {expedientes.length === 0 
                      ? 'No hay expedientes PE 16.03. Se crearán automáticamente al añadir maquinistas de nuevo acceso.'
                      : 'No se encontraron expedientes con los filtros seleccionados'}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
