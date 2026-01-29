import { useState, useEffect } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Plus, 
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileWarning
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, differenceInDays } from 'date-fns';
import { format, addDays, differenceInDays } from 'date-fns';

// TODO: Cuando se implemente PE 12.01 con base de datos, reemplazar estos mock data
import { 
  expedientes1201Mock, 
  maquinistasMock, 
  programacion1201Mock,
  actuaciones1201Mock
} from '@/data/mockData';

export default function PE1201Page() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [bases, setBases] = useState<{id: string; nombre: string}[]>([]);
  
  const { isAdmin, assignedBases } = useAuth();

  const handleNuevoExpediente = () => {
    toast({
      title: 'Funcionalidad en desarrollo',
      description: 'La creación de expedientes PE 12.01 estará disponible próximamente. Por ahora, los expedientes de ejemplo son datos de demostración.',
    });
  };
  
  // Cargar bases de la BD y filtrar según permisos del usuario
  useEffect(() => {
    const fetchBases = async () => {
      const { data } = await supabase
        .from('bases_conduccion')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      
      if (data) {
        // Si es admin, mostrar todas las bases; si no, solo las asignadas
        const filteredBases = isAdmin 
          ? data 
          : data.filter(b => assignedBases.includes(b.nombre as typeof assignedBases[number]));
        setBases(filteredBases);
      }
    };
    fetchBases();
  }, [isAdmin, assignedBases]);

  // Calcular resumen (usando mock data por ahora)
  const expedientesConResumen = expedientes1201Mock
    .filter(exp => {
      // Filtrar por bases asignadas
      const maquinista = maquinistasMock.find(m => m.id === exp.maquinistaId);
      if (!maquinista) return false;
      if (!isAdmin && !assignedBases.includes(maquinista.base as typeof assignedBases[number])) {
        return false;
      }
      return true;
    })
    .map(exp => {
      const maquinista = maquinistasMock.find(m => m.id === exp.maquinistaId);
      const origen = exp.fechaPrimerServicioTrasSuceso;
      const fechaCierreRecomendada = addDays(origen, 30);
      
      const programadas = programacion1201Mock.filter(p => p.expediente1201Id === exp.id);
      const realizadas = actuaciones1201Mock.filter(a => a.expediente1201Id === exp.id);
      
      const pendientes = programadas.filter(prog => 
        !realizadas.some(act => act.bloque === prog.bloque && act.etiqueta === prog.etiqueta)
      ).length;

      const diasHastaCierre = differenceInDays(fechaCierreRecomendada, new Date());

      return { 
        expediente: exp, 
        maquinista, 
        resumen: { 
          programadas: programadas.length, 
          realizadas: realizadas.length,
          pendientes,
          fechaCierreRecomendada,
          diasHastaCierre
        }
      };
    });

  // Filtrar
  const filtered = expedientesConResumen.filter(item => {
    const matchesSearch = 
      item.maquinista?.nombreApellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maquinista?.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.expediente.idSuceso.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || item.maquinista?.base === baseFilter;
    const matchesEstado = estadoFilter === 'all' || item.expediente.estado === estadoFilter;
    return matchesSearch && matchesBase && matchesEstado;
  });

  // KPIs rápidos
  const totalAbiertas = expedientesConResumen.filter(e => e.expediente.estado === 'Abierta').length;
  const conPendientes = expedientesConResumen.filter(e => e.resumen.pendientes > 0).length;
  const proximasCierre = expedientesConResumen.filter(e => 
    e.expediente.estado === 'Abierta' && e.resumen.diasHastaCierre <= 7
  ).length;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">PE 12.01 - Factor Humano</h1>
            <p className="text-muted-foreground">
              Gestión de expedientes tras suceso con programación ad-hoc
            </p>
          </div>
          <Button onClick={handleNuevoExpediente}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Expediente
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-status-proximo">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{totalAbiertas}</p>
                  <p className="text-sm text-muted-foreground">Fichas abiertas</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-status-proximo" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-status-pendiente">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-status-pendiente">{conPendientes}</p>
                  <p className="text-sm text-muted-foreground">Con actuaciones pendientes</p>
                </div>
                <Clock className="w-8 h-8 text-status-pendiente" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-status-vencido">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-status-vencido">{proximasCierre}</p>
                  <p className="text-sm text-muted-foreground">Próximas a fecha cierre</p>
                </div>
                <FileWarning className="w-8 h-8 text-status-vencido" />
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
                  placeholder="Buscar por maquinista o ID suceso..."
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
                    <SelectItem key={base.id} value={base.nombre}>{base.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Abierta">Abiertas</SelectItem>
                  <SelectItem value="Cerrada">Cerradas</SelectItem>
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
              onClick={() => navigate(`/maquinistas/${expediente.maquinistaId}?tab=pe1201`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      expediente.estado === 'Abierta' 
                        ? 'bg-status-proximo-bg' 
                        : 'bg-muted'
                    }`}>
                      <AlertTriangle className={`w-6 h-6 ${
                        expediente.estado === 'Abierta' 
                          ? 'text-status-proximo' 
                          : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{maquinista?.nombreApellidos}</h3>
                        <Badge variant="outline" className="font-mono text-xs">
                          {expediente.idSuceso}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-mono">{maquinista?.matricula}</span> • {maquinista?.base}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Suceso: {expediente.fechaSuceso ? format(expediente.fechaSuceso, 'dd/MM/yyyy') : '-'}
                        </span>
                        <span>
                          1er servicio: {format(expediente.fechaPrimerServicioTrasSuceso, 'dd/MM/yyyy')}
                        </span>
                        {expediente.estado === 'Abierta' && (
                          <span className={resumen.diasHastaCierre <= 7 ? 'text-status-vencido font-medium' : ''}>
                            Cierre rec.: {format(resumen.fechaCierreRecomendada, 'dd/MM/yyyy')}
                            {resumen.diasHastaCierre <= 7 && ` (¡${resumen.diasHastaCierre} días!)`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Resumen */}
                    <div className="flex items-center gap-2">
                      {resumen.pendientes > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-status-pendiente-bg">
                          <Clock className="w-3 h-3 text-status-pendiente" />
                          <span className="text-xs font-medium text-status-pendiente">
                            {resumen.pendientes} pendiente{resumen.pendientes > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                      {resumen.realizadas > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-status-cumplida-bg">
                          <CheckCircle2 className="w-3 h-3 text-status-cumplida" />
                          <span className="text-xs font-medium text-status-cumplida">{resumen.realizadas}</span>
                        </div>
                      )}
                    </div>
                    
                    <StatusBadge estado={expediente.estado} />
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>

                {/* Observaciones */}
                {expediente.observaciones && (
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">{expediente.observaciones}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {filtered.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No se encontraron expedientes</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
