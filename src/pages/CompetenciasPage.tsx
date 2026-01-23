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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Train, Settings } from 'lucide-react';
import { calcularPlanUso, maquinistasMock, competenciasUsoMock } from '@/data/mockData';
import { Base, TipoCompetencia } from '@/types';

const bases: Base[] = ['Madrid-Chamartín', 'Barcelona-Sants', 'Sevilla-Santa Justa', 'Valencia-Joaquín Sorolla'];

export default function CompetenciasPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');

  const planUso = calcularPlanUso();

  // Filtrar
  const filteredPlanUso = planUso.filter(item => {
    const maquinista = maquinistasMock.find(m => m.id === item.maquinistaId);
    const matchesSearch = 
      maquinista?.nombreApellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      maquinista?.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.competencia?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || maquinista?.base === baseFilter;
    const matchesTipo = tipoFilter === 'all' || item.competencia?.tipo === tipoFilter;
    const matchesEstado = estadoFilter === 'all' || item.estado === estadoFilter;
    return matchesSearch && matchesBase && matchesTipo && matchesEstado;
  });

  // Agrupar por competencia
  const competenciasConEstados = competenciasUsoMock.filter(c => c.controlar && c.activo).map(competencia => {
    const items = planUso.filter(p => p.competenciaId === competencia.id);
    const vencidos = items.filter(p => p.estado === 'Vencido').length;
    const proximos = items.filter(p => p.estado === 'Próximo').length;
    const sinEvidencia = items.filter(p => p.estado === 'Sin evidencia').length;
    const ok = items.filter(p => p.estado === 'OK').length;
    return { competencia, vencidos, proximos, sinEvidencia, ok, total: items.length };
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Competencias de Uso</h1>
            <p className="text-muted-foreground">
              Control de competencias especiales Infra/Serie (caducidad 12 meses)
            </p>
          </div>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Gestionar Catálogo
          </Button>
        </div>

        {/* Resumen por Competencia */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competenciasConEstados.map(({ competencia, vencidos, proximos, sinEvidencia, ok, total }) => (
            <Card key={competencia.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Train className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{competencia.nombre}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{competencia.codigo}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{competencia.tipo}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs">
                  {vencidos > 0 && (
                    <span className="px-2 py-1 rounded-full bg-status-vencido-bg text-status-vencido font-medium">
                      {vencidos} vencido{vencidos > 1 ? 's' : ''}
                    </span>
                  )}
                  {proximos > 0 && (
                    <span className="px-2 py-1 rounded-full bg-status-proximo-bg text-status-proximo font-medium">
                      {proximos} próximo{proximos > 1 ? 's' : ''}
                    </span>
                  )}
                  {sinEvidencia > 0 && (
                    <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                      {sinEvidencia} sin evidencia
                    </span>
                  )}
                  {ok > 0 && (
                    <span className="px-2 py-1 rounded-full bg-status-ok-bg text-status-ok font-medium">
                      {ok} OK
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por maquinista o competencia..."
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
              <Select value={tipoFilter} onValueChange={setTipoFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Infra">Infra</SelectItem>
                  <SelectItem value="Serie">Serie</SelectItem>
                </SelectContent>
              </Select>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Vencido">Vencido</SelectItem>
                  <SelectItem value="Próximo">Próximo</SelectItem>
                  <SelectItem value="Sin evidencia">Sin evidencia</SelectItem>
                  <SelectItem value="OK">OK</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Detalle por Maquinista</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-sm">Maquinista</th>
                  <th className="text-left p-4 font-medium text-sm">Base</th>
                  <th className="text-left p-4 font-medium text-sm">Competencia</th>
                  <th className="text-left p-4 font-medium text-sm">Tipo</th>
                  <th className="text-left p-4 font-medium text-sm">Última Acción</th>
                  <th className="text-left p-4 font-medium text-sm">Vencimiento</th>
                  <th className="text-left p-4 font-medium text-sm">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlanUso.slice(0, 20).map((item) => {
                  const maquinista = maquinistasMock.find(m => m.id === item.maquinistaId);
                  return (
                    <tr 
                      key={item.id} 
                      className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/maquinistas/${item.maquinistaId}`)}
                    >
                      <td className="p-4">
                        <p className="font-medium text-sm">{maquinista?.nombreApellidos}</p>
                        <p className="text-xs text-muted-foreground font-mono">{maquinista?.matricula}</p>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {maquinista?.base}
                      </td>
                      <td className="p-4">
                        <p className="text-sm">{item.competencia?.nombre}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs">
                          {item.competencia?.tipo}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        {item.fechaUltima 
                          ? new Date(item.fechaUltima).toLocaleDateString('es-ES')
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="p-4 text-sm">
                        {item.fechaVencimiento 
                          ? new Date(item.fechaVencimiento).toLocaleDateString('es-ES')
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="p-4">
                        <StatusBadge estado={item.estado} size="sm" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
