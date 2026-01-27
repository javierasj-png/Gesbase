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
import { Search, Train, Settings, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { obtenerTodasCertificaciones, maquinistasMock, certificacionesMock, baseCertificacionesMock } from '@/data/mockData';
import { Base, TipoCertificacion } from '@/types';
import { format } from 'date-fns';

const bases: Base[] = ['Madrid-Chamartín', 'Barcelona-Sants', 'Sevilla-Santa Justa', 'Valencia-Joaquín Sorolla'];

export default function CertificacionesPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [soloVigiladas, setSoloVigiladas] = useState(true);

  const todasCertificaciones = obtenerTodasCertificaciones();

  // Filtrar
  const filteredCerts = todasCertificaciones.filter(item => {
    const matchesSearch = 
      item.maquinista?.nombreApellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maquinista?.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.certificacion?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || item.baseId === baseFilter;
    const matchesTipo = tipoFilter === 'all' || item.certificacion?.tipo === tipoFilter;
    const matchesEstado = estadoFilter === 'all' || item.estado === estadoFilter;
    const matchesVigilada = !soloVigiladas || item.vigilarVencimiento;
    return matchesSearch && matchesBase && matchesTipo && matchesEstado && matchesVigilada;
  });

  // Ordenar por fecha de vencimiento (ascendente)
  const sortedCerts = [...filteredCerts].sort((a, b) => {
    if (!a.fechaEstimadaVencimiento && !b.fechaEstimadaVencimiento) return 0;
    if (!a.fechaEstimadaVencimiento) return 1;
    if (!b.fechaEstimadaVencimiento) return -1;
    return a.fechaEstimadaVencimiento.getTime() - b.fechaEstimadaVencimiento.getTime();
  });

  // Agrupar por certificación
  const certificacionesConEstados = certificacionesMock.filter(c => c.activo).map(certificacion => {
    const items = todasCertificaciones.filter(c => c.certificacionId === certificacion.id && (!soloVigiladas || c.vigilarVencimiento));
    const vencidos = items.filter(c => c.estado === 'Vencida').length;
    const proximos = items.filter(c => c.estado === 'Próxima a vencer').length;
    const vigentes = items.filter(c => c.estado === 'Vigente').length;
    const noAplica = items.filter(c => c.estado === 'No aplica').length;
    
    // Contar en cuántas bases está vigilada
    const basesVigiladas = baseCertificacionesMock.filter(
      bc => bc.certificacionId === certificacion.id && bc.vigilarVencimiento
    ).length;
    
    return { certificacion, vencidos, proximos, vigentes, noAplica, total: items.length, basesVigiladas };
  }).filter(c => c.total > 0);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Certificaciones</h1>
            <p className="text-muted-foreground">
              Control de certificaciones de vehículos y líneas (vencimiento por inactividad)
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <Settings className="w-4 h-4 mr-2" />
            Gestionar Catálogo
          </Button>
        </div>

        {/* Resumen por Certificación */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificacionesConEstados.map(({ certificacion, vencidos, proximos, vigentes, noAplica, basesVigiladas }) => (
            <Card key={certificacion.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Train className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{certificacion.nombre}</CardTitle>
                      <p className="text-xs text-muted-foreground capitalize">{certificacion.tipo}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline" className="capitalize">{certificacion.tipo}</Badge>
                    {basesVigiladas > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {basesVigiladas} base{basesVigiladas > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {vencidos > 0 && (
                    <span className="px-2 py-1 rounded-full bg-status-vencido-bg text-status-vencido font-medium">
                      {vencidos} vencida{vencidos > 1 ? 's' : ''}
                    </span>
                  )}
                  {proximos > 0 && (
                    <span className="px-2 py-1 rounded-full bg-status-proximo-bg text-status-proximo font-medium">
                      {proximos} próxima{proximos > 1 ? 's' : ''}
                    </span>
                  )}
                  {vigentes > 0 && (
                    <span className="px-2 py-1 rounded-full bg-status-ok-bg text-status-ok font-medium">
                      {vigentes} vigente{vigentes > 1 ? 's' : ''}
                    </span>
                  )}
                  {noAplica > 0 && (
                    <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                      {noAplica} no aplica
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
                  placeholder="Buscar por maquinista o certificación..."
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
                  <SelectItem value="vehiculo">Vehículo</SelectItem>
                  <SelectItem value="linea">Línea</SelectItem>
                </SelectContent>
              </Select>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Vencida">Vencida</SelectItem>
                  <SelectItem value="Próxima a vencer">Próxima a vencer</SelectItem>
                  <SelectItem value="Vigente">Vigente</SelectItem>
                  <SelectItem value="No aplica">No aplica</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant={soloVigiladas ? "default" : "outline"} 
                size="sm"
                onClick={() => setSoloVigiladas(!soloVigiladas)}
                className="flex items-center gap-2"
              >
                {soloVigiladas ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {soloVigiladas ? 'Solo vigiladas' : 'Todas'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Panel de Vencimientos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium text-sm">Maquinista</th>
                  <th className="text-left p-4 font-medium text-sm">Base</th>
                  <th className="text-left p-4 font-medium text-sm">Certificación</th>
                  <th className="text-left p-4 font-medium text-sm">Tipo</th>
                  <th className="text-center p-4 font-medium text-sm">Vigilar</th>
                  <th className="text-left p-4 font-medium text-sm">Último Servicio</th>
                  <th className="text-left p-4 font-medium text-sm">Vencimiento Est.</th>
                  <th className="text-left p-4 font-medium text-sm">Días</th>
                  <th className="text-left p-4 font-medium text-sm">Estado</th>
                </tr>
              </thead>
              <tbody>
                {sortedCerts.slice(0, 30).map((item) => (
                  <tr 
                    key={item.id} 
                    className="border-b last:border-b-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => navigate(`/maquinistas/${item.maquinistaId}`)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-medium text-sm">{item.maquinista?.nombreApellidos}</p>
                          <p className="text-xs text-muted-foreground font-mono">{item.maquinista?.matricula}</p>
                        </div>
                        {item.obligatoria && item.estado === 'Vencida' && (
                          <AlertTriangle className="w-4 h-4 text-status-vencido" />
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {item.baseId}
                    </td>
                    <td className="p-4">
                      <p className="text-sm">{item.certificacion?.nombre}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs capitalize">
                        {item.certificacion?.tipo}
                      </Badge>
                    </td>
                    <td className="p-4 text-center">
                      {item.vigilarVencimiento ? (
                        <Eye className="w-4 h-4 text-primary mx-auto" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="p-4 text-sm">
                      {item.fechaUltimoServicio 
                        ? format(item.fechaUltimoServicio, 'dd/MM/yyyy')
                        : <span className="text-muted-foreground">Sin registro</span>}
                    </td>
                    <td className="p-4 text-sm">
                      {item.fechaEstimadaVencimiento 
                        ? format(item.fechaEstimadaVencimiento, 'dd/MM/yyyy')
                        : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="p-4 text-sm font-medium">
                      {item.diasRestantes !== null 
                        ? (item.diasRestantes >= 0 ? item.diasRestantes : `${Math.abs(item.diasRestantes)} venc.`)
                        : '-'}
                    </td>
                    <td className="p-4">
                      <StatusBadge estado={item.estado} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
