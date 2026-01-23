import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Plus, 
  FileCheck,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { 
  expedientes1603Mock, 
  maquinistasMock, 
  generarPlan1603,
  actuaciones1603Mock
} from '@/data/mockData';
import { Base, TipoActuacion1603, EstadoBloque1603 } from '@/types';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

const bases: Base[] = ['Madrid-Chamartín', 'Barcelona-Sants', 'Sevilla-Santa Justa', 'Valencia-Joaquín Sorolla'];

export default function PE1603Page() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');

  // Calcular resumen
  const expedientesConPlan = expedientes1603Mock.map(exp => {
    const maquinista = maquinistasMock.find(m => m.id === exp.maquinistaId);
    const plan = generarPlan1603(exp);
    const actuaciones = actuaciones1603Mock.filter(a => a.expediente1603Id === exp.id);
    
    // Vincular actuaciones
    const planConActuaciones = plan.map(bloque => {
      const actuacion = actuaciones.find(a => 
        a.tipo === bloque.tipo && 
        a.fechaReal >= bloque.inicioVentana && 
        a.fechaReal <= bloque.finVentana
      );
      return {
        ...bloque,
        estado: actuacion ? 'Cumplida' as EstadoBloque1603 : bloque.estado,
      };
    });

    const vencidas = planConActuaciones.filter(b => b.estado === 'Vencida').length;
    const enVentana = planConActuaciones.filter(b => b.estado === 'En ventana').length;
    const cumplidas = planConActuaciones.filter(b => b.estado === 'Cumplida').length;
    const pendientes = planConActuaciones.filter(b => b.estado === 'Pendiente').length;
    const diasRestantes = differenceInDays(exp.fechaFinPrevista, new Date());

    return { 
      expediente: exp, 
      maquinista, 
      plan: planConActuaciones,
      resumen: { vencidas, enVentana, cumplidas, pendientes, diasRestantes }
    };
  });

  // Filtrar
  const filtered = expedientesConPlan.filter(item => {
    const matchesSearch = 
      item.maquinista?.nombreApellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maquinista?.matricula.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || item.maquinista?.base === baseFilter;
    const matchesEstado = estadoFilter === 'all' || item.expediente.estado === estadoFilter;
    return matchesSearch && matchesBase && matchesEstado;
  });

  // KPIs rápidos
  const totalActivos = expedientesConPlan.filter(e => e.expediente.estado === 'Activo').length;
  const conVencidas = expedientesConPlan.filter(e => e.resumen.vencidas > 0).length;
  const conEnVentana = expedientesConPlan.filter(e => e.resumen.enVentana > 0).length;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PE 16.03 - Nuevo Acceso</h1>
            <p className="text-muted-foreground">
              Vigilancia durante 3 años desde primer servicio en la dependencia
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Expediente
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-status-ok">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{totalActivos}</p>
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
                  <p className="text-2xl font-bold text-status-vencido">{conVencidas}</p>
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
                  <p className="text-2xl font-bold text-status-proximo">{conEnVentana}</p>
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
                  {bases.map(base => (
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
                  <SelectItem value="Activo">Activos</SelectItem>
                  <SelectItem value="Cerrado">Cerrados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Expedientes List */}
        <div className="space-y-4">
          {filtered.map(({ expediente, maquinista, resumen }) => (
            <Card 
              key={expediente.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/maquinistas/${expediente.maquinistaId}?tab=pe1603`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileCheck className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{maquinista?.nombreApellidos}</h3>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-mono">{maquinista?.matricula}</span> • {maquinista?.base}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Inicio: {format(expediente.fechaInicio, 'dd/MM/yyyy')}
                        </span>
                        <span>→</span>
                        <span>Fin: {format(expediente.fechaFinPrevista, 'dd/MM/yyyy')}</span>
                        <span className={resumen.diasRestantes < 90 ? 'text-status-proximo font-medium' : ''}>
                          ({resumen.diasRestantes} días restantes)
                        </span>
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
                    
                    <StatusBadge estado={expediente.estado} />
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No se encontraron expedientes</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
