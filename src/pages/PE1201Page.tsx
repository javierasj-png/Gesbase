import { useState, useEffect } from 'react';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Search, 
  Plus, 
  AlertTriangle,
  Calendar,
  ChevronRight,
  Clock,
  CheckCircle2,
  FileWarning,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useExpedientes1201 } from '@/hooks/useExpedientes1201';
import { format, addDays, parseISO } from 'date-fns';
import { useGlobalBaseFilter } from '@/hooks/useGlobalBaseFilter';

export default function PE1201Page() {
  const navigate = useNavigate();
  usePageMeta({ title: 'PE 12.01 — Gestión de Base', description: 'Vigilancia PE 12.01 a 40 días tras suceso: acompañamientos y registros.', path: '/pe-1201' });
  const { toast } = useToast();
  const { user, isAdmin, assignedBases } = useAuth();
  
  const { expedientes, loading, refetch } = useExpedientes1201();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [baseFilter, setBaseFilter] = useGlobalBaseFilter();
  const [estadoFilter, setEstadoFilter] = useState<string>('all');
  const [bases, setBases] = useState<{id: string; nombre: string}[]>([]);
  
  // Modal state
  const [nuevoOpen, setNuevoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [selectedMaquinistaId, setSelectedMaquinistaId] = useState('');
  const [idSuceso, setIdSuceso] = useState('');
  const [fechaSuceso, setFechaSuceso] = useState('');
  const [fechaPrimerServicio, setFechaPrimerServicio] = useState('');
  const [descripcionSuceso, setDescripcionSuceso] = useState('');
  const [observaciones, setObservaciones] = useState('');
  
  // Maquinistas for selector
  const [maquinistas, setMaquinistas] = useState<{id: string; matricula: string; nombre: string; apellidos: string; base: string}[]>([]);

  // Load bases
  useEffect(() => {
    const fetchBases = async () => {
      const { data } = await supabase
        .from('bases_conduccion')
        .select('id, nombre')
        .eq('activa', true)
        .order('nombre');
      
      if (data) {
        const filteredBases = isAdmin 
          ? data 
          : data.filter(b => assignedBases.includes(b.nombre as typeof assignedBases[number]));
        setBases(filteredBases);
      }
    };
    fetchBases();
  }, [isAdmin, assignedBases]);

  // Load maquinistas for form
  useEffect(() => {
    const fetchMaquinistas = async () => {
      const { data } = await supabase
        .from('maquinistas')
        .select('id, matricula, nombre, apellidos, base')
        .eq('activo', true)
        .order('apellidos');
      
      if (data) {
        const filtered = isAdmin 
          ? data 
          : data.filter(m => assignedBases.includes(m.base as typeof assignedBases[number]));
        setMaquinistas(filtered);
      }
    };
    fetchMaquinistas();
  }, [isAdmin, assignedBases]);

  const resetForm = () => {
    setSelectedMaquinistaId('');
    setIdSuceso('');
    setFechaSuceso('');
    setFechaPrimerServicio('');
    setDescripcionSuceso('');
    setObservaciones('');
  };

  const handleCrearExpediente = async () => {
    if (!selectedMaquinistaId || !idSuceso.trim() || !fechaPrimerServicio) {
      toast({
        title: 'Datos incompletos',
        description: 'Selecciona maquinista, ID suceso y fecha de primer servicio.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('expedientes_1201')
        .insert({
          maquinista_id: selectedMaquinistaId,
          id_suceso: idSuceso.trim(),
          fecha_suceso: fechaSuceso || null,
          fecha_primer_servicio: fechaPrimerServicio,
          descripcion_suceso: descripcionSuceso.trim() || null,
          observaciones: observaciones.trim() || null,
          created_by: user?.id,
          updated_by: user?.id,
        });

      if (error) throw error;

      toast({
        title: 'Expediente creado',
        description: 'Se ha generado el expediente PE 12.01 con los hitos obligatorios.',
      });

      resetForm();
      setNuevoOpen(false);
      refetch();
    } catch (err) {
      console.error('Error creating expediente:', err);
      toast({
        title: 'Error',
        description: (err as any)?.message || 'No se pudo crear el expediente',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter expedientes
  const filtered = expedientes.filter(item => {
    const matchesSearch = 
      item.maquinista?.nombre_apellidos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maquinista?.matricula.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.expediente.id_suceso.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBase = baseFilter === 'all' || item.maquinista?.base === baseFilter;
    const matchesEstado = estadoFilter === 'all' || item.expediente.estado === estadoFilter;
    return matchesSearch && matchesBase && matchesEstado;
  });

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
          <Button onClick={() => setNuevoOpen(true)}>
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
                  <p className="text-2xl font-bold">{kpis.totalAbiertas}</p>
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
                  <p className="text-2xl font-bold text-status-pendiente">{kpis.conPendientes}</p>
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
                  <p className="text-2xl font-bold text-status-vencido">{kpis.proximasCierre}</p>
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
                  <SelectItem value="abierto">Abiertas</SelectItem>
                  <SelectItem value="cerrado">Cerradas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Expedientes List */}
        {!loading && (
          <div className="space-y-4">
            {filtered.map(({ expediente, maquinista, resumen }) => (
              <Card 
                key={expediente.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/maquinistas/${expediente.maquinista_id}?tab=pe1201`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        expediente.estado === 'abierto' 
                          ? 'bg-status-proximo-bg' 
                          : 'bg-muted'
                      }`}>
                        <AlertTriangle className={`w-6 h-6 ${
                          expediente.estado === 'abierto' 
                            ? 'text-status-proximo' 
                            : 'text-muted-foreground'
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{maquinista?.nombre_apellidos || 'Sin asignar'}</h3>
                          <Badge variant="outline" className="font-mono text-xs">
                            {expediente.id_suceso}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          <span className="font-mono">{maquinista?.matricula}</span> • {maquinista?.base}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Suceso: {expediente.fecha_suceso ? format(parseISO(expediente.fecha_suceso), 'dd/MM/yyyy') : '-'}
                          </span>
                          <span>
                            1er servicio: {format(parseISO(expediente.fecha_primer_servicio), 'dd/MM/yyyy')}
                          </span>
                          {expediente.estado === 'abierto' && resumen.fechaCierreRecomendada && (
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
                        {resumen.realizados > 0 && (
                          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-status-cumplida-bg">
                            <CheckCircle2 className="w-3 h-3 text-status-cumplida" />
                            <span className="text-xs font-medium text-status-cumplida">{resumen.realizados}</span>
                          </div>
                        )}
                      </div>
                      
                      <StatusBadge estado={expediente.estado === 'abierto' ? 'Abierta' : 'Cerrada'} />
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Descripción del suceso */}
                  {expediente.descripcion_suceso && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">{expediente.descripcion_suceso}</p>
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
        )}

        {/* Modal Nuevo Expediente */}
        <Dialog open={nuevoOpen} onOpenChange={setNuevoOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-status-proximo" />
                Nuevo Expediente PE 12.01
              </DialogTitle>
              <DialogDescription>
                Se generarán automáticamente los hitos obligatorios (días 1, 7, 23, 30 desde el primer servicio).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Maquinista */}
              <div className="space-y-2">
                <Label>Maquinista *</Label>
                <Select value={selectedMaquinistaId} onValueChange={setSelectedMaquinistaId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar maquinista" />
                  </SelectTrigger>
                  <SelectContent>
                    {maquinistas.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.apellidos}, {m.nombre} ({m.matricula}) - {m.base}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* ID Suceso */}
              <div className="space-y-2">
                <Label>ID Suceso *</Label>
                <Input
                  placeholder="Ej: SUC-2025-0001"
                  value={idSuceso}
                  onChange={(e) => setIdSuceso(e.target.value)}
                />
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha del suceso</Label>
                  <Input
                    type="date"
                    value={fechaSuceso}
                    onChange={(e) => setFechaSuceso(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Primer servicio tras suceso *</Label>
                  <Input
                    type="date"
                    value={fechaPrimerServicio}
                    onChange={(e) => setFechaPrimerServicio(e.target.value)}
                  />
                </div>
              </div>

              {/* Descripción */}
              <div className="space-y-2">
                <Label>Descripción del suceso</Label>
                <Textarea
                  placeholder="Descripción breve del suceso..."
                  value={descripcionSuceso}
                  onChange={(e) => setDescripcionSuceso(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Observaciones */}
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Textarea
                  placeholder="Notas adicionales..."
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setNuevoOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleCrearExpediente} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear Expediente
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
