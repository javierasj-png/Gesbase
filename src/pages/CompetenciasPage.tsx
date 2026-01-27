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
import { Search, Train, Settings, Eye, EyeOff } from 'lucide-react';
import { calcularPlanCertificacion, maquinistasMock, certificacionesMock, certificacionesPorBaseMock } from '@/data/mockData';
import { Base, TipoCertificacion } from '@/types';

const bases: Base[] = ['Madrid-Chamartín', 'Barcelona-Sants', 'Sevilla-Santa Justa', 'Valencia-Joaquín Sorolla'];

export default function CertificacionesPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [soloVigiladas, setSoloVigiladas] = useState(true);

  const planCertificacion = calcularPlanCertificacion();

  // Filtrar
  const filteredPlan = planCertificacion.filter(item => {
    const maquinista = maquinistasMock.find(m => m.id === item.maquinistaId);
    const matchesSearch = 
      maquinista?.nombreApellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      maquinista?.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.certificacion?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || maquinista?.base === baseFilter;
    const matchesTipo = tipoFilter === 'all' || item.certificacion?.tipo === tipoFilter;
    const matchesEstado = estadoFilter === 'all' || item.estado === estadoFilter;
    const matchesVigilada = !soloVigiladas || item.vigilar;
    return matchesSearch && matchesBase && matchesTipo && matchesEstado && matchesVigilada;
  });

  // Agrupar por certificación (solo las activas y vigiladas si aplica)
  const certificacionesConEstados = certificacionesMock.filter(c => c.activo).map(certificacion => {
    const items = planCertificacion.filter(p => p.certificacionId === certificacion.id && (!soloVigiladas || p.vigilar));
    const vencidos = items.filter(p => p.estado === 'Vencido').length;
    const proximos = items.filter(p => p.estado === 'Próximo').length;
    const sinEvidencia = items.filter(p => p.estado === 'Sin evidencia').length;
    const ok = items.filter(p => p.estado === 'OK').length;
    
    // Contar en cuántas bases está vigilada
    const basesVigiladas = certificacionesPorBaseMock.filter(
      cb => cb.certificacionId === certificacion.id && cb.activa && cb.vigilar
    ).length;
    
    return { certificacion, vencidos, proximos, sinEvidencia, ok, total: items.length, basesVigiladas };
  }).filter(c => c.total > 0);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Certificaciones</h1>
            <p className="text-muted-foreground">
              Control de certificaciones de vehículos y líneas (caducidad 12 meses)
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            <Settings className="w-4 h-4 mr-2" />
            Gestionar Catálogo
          </Button>
        </div>

        {/* Resumen por Certificación */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {certificacionesConEstados.map(({ certificacion, vencidos, proximos, sinEvidencia, ok, basesVigiladas }) => (
            <Card key={certificacion.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Train className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{certificacion.nombre}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">{certificacion.codigo}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline">{certificacion.tipo}</Badge>
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
            <CardTitle className="text-base">Detalle por Maquinista</CardTitle>
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
                  <th className="text-left p-4 font-medium text-sm">Última Acción</th>
                  <th className="text-left p-4 font-medium text-sm">Vencimiento</th>
                  <th className="text-left p-4 font-medium text-sm">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlan.slice(0, 20).map((item) => {
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
                        <p className="text-sm">{item.certificacion?.nombre}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs">
                          {item.certificacion?.tipo}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">
                        {item.vigilar ? (
                          <Eye className="w-4 h-4 text-primary mx-auto" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-muted-foreground mx-auto" />
                        )}
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