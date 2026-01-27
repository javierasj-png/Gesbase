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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Plus, ChevronRight } from 'lucide-react';
import { maquinistasMock, obtenerCertificacionesMaquinista, expedientes1603Mock, expedientes1201Mock } from '@/data/mockData';
import { useBaseFilter } from '@/hooks/useBaseFilter';

export default function MaquinistasPage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const { filterMaquinistas, getAccessibleBases, isAdmin } = useBaseFilter();

  // Calcular resumen de estado por maquinista (solo certificaciones vigiladas)
  const getMaquinistaStatus = (maquinistaId: string) => {
    const certs = obtenerCertificacionesMaquinista(maquinistaId).filter(c => c.vigilarVencimiento);
    const vencidos = certs.filter(c => c.estado === 'Vencida').length;
    const proximos = certs.filter(c => c.estado === 'Próxima a vencer').length;
    
    const has1603 = expedientes1603Mock.some(e => e.maquinistaId === maquinistaId && e.estado === 'Activo');
    const has1201 = expedientes1201Mock.some(e => e.maquinistaId === maquinistaId && e.estado === 'Abierta');
    
    if (vencidos > 0) return { label: 'Atención', variant: 'danger' as const };
    if (proximos > 0 || has1201) return { label: 'Vigilancia', variant: 'warning' as const };
    if (has1603) return { label: 'En seguimiento', variant: 'success' as const };
    return { label: 'OK', variant: 'default' as const };
  };

  // Primero filtramos por bases asignadas, luego aplicamos filtros del usuario
  const baseMaquinistas = filterMaquinistas(maquinistasMock);
  
  const filteredMaquinistas = baseMaquinistas.filter(m => {
    const matchesSearch = 
      m.nombreApellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.matricula.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || m.base === baseFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'activo' && m.activo) || 
      (statusFilter === 'inactivo' && !m.activo);
    return matchesSearch && matchesBase && matchesStatus;
  });

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Maquinistas</h1>
            <p className="text-muted-foreground">
              Censo de maquinistas y acceso a fichas individuales
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Maquinista
          </Button>
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
                  <TableHead className="w-[120px]">Matrícula</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead className="text-center">Certificaciones</TableHead>
                  <TableHead className="text-center">PE 16.03</TableHead>
                  <TableHead className="text-center">PE 12.01</TableHead>
                  <TableHead>Estado General</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMaquinistas.map((maquinista) => {
                  const certs = obtenerCertificacionesMaquinista(maquinista.id).filter(c => c.vigilarVencimiento);
                  const vencidos = certs.filter(c => c.estado === 'Vencida').length;
                  const proximos = certs.filter(c => c.estado === 'Próxima a vencer').length;
                  
                  const exp1603 = expedientes1603Mock.filter(e => e.maquinistaId === maquinista.id && e.estado === 'Activo').length;
                  const exp1201 = expedientes1201Mock.filter(e => e.maquinistaId === maquinista.id && e.estado === 'Abierta').length;
                  
                  const status = getMaquinistaStatus(maquinista.id);

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
                        {maquinista.nombreApellidos}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {maquinista.base}
                      </TableCell>
                      <TableCell className="text-center">
                        {vencidos > 0 && (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-status-vencido-bg text-status-vencido text-xs font-medium mr-1">
                            {vencidos}
                          </span>
                        )}
                        {proximos > 0 && (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-status-proximo-bg text-status-proximo text-xs font-medium">
                            {proximos}
                          </span>
                        )}
                        {vencidos === 0 && proximos === 0 && (
                          <span className="text-status-ok">✓</span>
                        )}
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
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
