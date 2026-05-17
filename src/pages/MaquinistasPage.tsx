import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Search, ChevronRight, Loader2, AlertTriangle } from 'lucide-react';
import { useMaquinistas } from '@/hooks/useMaquinistas';
import { useTableSort } from '@/hooks/useTableSort';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { useExpedientes1603 } from '@/hooks/useExpedientes1603';
import { useExpedientes1201 } from '@/hooks/useExpedientes1201';
import { useAuth } from '@/contexts/AuthContext';
import { addYears, addMonths, differenceInDays, isBefore } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGlobalBaseFilter } from '@/hooks/useGlobalBaseFilter';

function getLicenciaStatus(fechaObtencion: string | null) {
  if (!fechaObtencion) return { label: 'Sin dato', variant: 'default' as const, warn: false };
  const obtencion = new Date(fechaObtencion);
  const caducidad = addYears(obtencion, 10);
  const avisoDesde = addMonths(caducidad, -6);
  const hoy = new Date();
  const diasRestantes = differenceInDays(caducidad, hoy);

  if (isBefore(caducidad, hoy)) {
    return { label: 'Caducada', variant: 'destructive' as const, warn: true, dias: diasRestantes, caducidad };
  }
  if (isBefore(avisoDesde, hoy)) {
    return { label: `Caduca en ${diasRestantes}d`, variant: 'warning' as const, warn: true, dias: diasRestantes, caducidad };
  }
  return { label: 'Vigente', variant: 'success' as const, warn: false, dias: diasRestantes, caducidad };
}

export default function MaquinistasPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useGlobalBaseFilter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { maquinistas, loading } = useMaquinistas();
  const { expedientes } = useExpedientes1603();
  const { expedientes: expedientes1201 } = useExpedientes1201();
  const { isAdmin } = useAuth();

  // Obtener bases únicas de los maquinistas
  const getAccessibleBases = [...new Set(maquinistas.map(m => m.base))].sort();

  // Calcular resumen de estado por maquinista
  const getMaquinistaStatus = (maquinistaId: string) => {
    const has1603 = expedientes.some(e => 
      e.expediente.maquinista_id === maquinistaId && e.expediente.estado === 'abierto'
    );
    
    if (has1603) return { label: 'En seguimiento', variant: 'success' as const };
    return { label: 'OK', variant: 'default' as const };
  };

  const filteredMaquinistas = maquinistas.filter(m => {
    const matchesSearch = 
      m.nombre_apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.matricula.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || m.base === baseFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'activo' && m.activo) || 
      (statusFilter === 'inactivo' && !m.activo);
    return matchesSearch && matchesBase && matchesStatus;
  });

  const { sortedItems: sortedMaquinistas, sortConfig, requestSort } = useTableSort(filteredMaquinistas);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Maquinistas</h1>
          <p className="text-muted-foreground">
            Censo de maquinistas y acceso a fichas individuales
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o matrícula..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={baseFilter} onValueChange={setBaseFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todas las bases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las bases</SelectItem>
                  {getAccessibleBases.map(base => (
                    <SelectItem key={base} value={base}>{base}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="activo">Activos</SelectItem>
                  <SelectItem value="inactivo">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortKey="matricula" currentSortKey={sortConfig.key as string} direction={sortConfig.direction} onSort={requestSort} className="w-[120px]">Matrícula</SortableTableHead>
                  <SortableTableHead sortKey="nombre_apellidos" currentSortKey={sortConfig.key as string} direction={sortConfig.direction} onSort={requestSort}>Nombre</SortableTableHead>
                  <SortableTableHead sortKey="base" currentSortKey={sortConfig.key as string} direction={sortConfig.direction} onSort={requestSort}>Base</SortableTableHead>
                  <SortableTableHead sortKey="fecha_licencia_conduccion" currentSortKey={sortConfig.key as string} direction={sortConfig.direction} onSort={requestSort}>Licencia</SortableTableHead>
                  <TableHead className="text-center">PE 16.03</TableHead>
                  <TableHead className="text-center">PE 12.01</TableHead>
                  <TableHead>Estado General</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaquinistas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No se encontraron maquinistas
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedMaquinistas.map((maquinista) => {
                    const exp1603 = expedientes.filter(e => 
                      e.expediente.maquinista_id === maquinista.id && e.expediente.estado === 'abierto'
                    ).length;
                    const exp1201 = expedientes1201.filter(e => 
                      e.expediente.maquinista_id === maquinista.id && e.expediente.estado === 'abierto'
                    ).length;
                    const status = getMaquinistaStatus(maquinista.id);
                    const licencia = getLicenciaStatus(maquinista.fecha_licencia_conduccion ?? null);

                    return (
                      <TableRow 
                        key={maquinista.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/maquinistas/${maquinista.id}`)}
                      >
                        <TableCell className="font-mono font-medium">
                          {maquinista.matricula}
                        </TableCell>
                        <TableCell className="font-medium">
                          {maquinista.nombre_apellidos}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {maquinista.base}
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                                  licencia.variant === 'destructive' ? 'bg-destructive/10 text-destructive' :
                                  licencia.variant === 'warning' ? 'bg-status-proximo-bg text-status-proximo' :
                                  licencia.variant === 'success' ? 'bg-status-ok-bg text-status-ok' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {licencia.warn && <AlertTriangle className="w-3 h-3" />}
                                  {licencia.label}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {licencia.caducidad 
                                  ? `Caduca: ${format(licencia.caducidad, 'dd/MM/yyyy', { locale: es })}`
                                  : 'Sin fecha de licencia registrada'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-center">
                          {exp1603 > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-status-ok-bg text-status-ok text-xs font-medium">
                              {exp1603}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {exp1201 > 0 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-status-proximo-bg text-status-proximo text-xs font-medium">
                              {exp1201}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge 
                            estado={status.label} 
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
