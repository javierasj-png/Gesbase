import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload, FileText, Loader2, Eye, Trash2, CheckCircle2,
  AlertTriangle, XCircle, ThumbsUp, ArrowUpCircle, ShieldAlert,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface VisitasBaseTabProps {
  baseFilter: string;
  bases: { id: string; nombre: string }[];
}

export function VisitasBaseTab({ baseFilter, bases }: VisitasBaseTabProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  
  const [tipo, setTipo] = useState<string>('visita_seguridad');
  const [fechaVisita, setFechaVisita] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedBase, setSelectedBase] = useState<string>(baseFilter !== 'all' ? baseFilter : (bases[0]?.nombre || ''));
  const [selectedVisita, setSelectedVisita] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const effectiveBaseFilter = baseFilter !== 'all' ? baseFilter : undefined;

  const { data: visitas, isLoading } = useQuery({
    queryKey: ['visitas-base', effectiveBaseFilter],
    queryFn: async () => {
      let query = supabase
        .from('visitas_base')
        .select('*')
        .order('fecha_visita', { ascending: false });

      if (effectiveBaseFilter) {
        query = query.eq('base_nombre', effectiveBaseFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (visitaId: string) => {
      const { data, error } = await supabase.functions.invoke('analizar-visita', {
        body: { visitaId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Análisis completado correctamente');
      queryClient.invalidateQueries({ queryKey: ['visitas-base'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Error al analizar el documento');
      queryClient.invalidateQueries({ queryKey: ['visitas-base'] });
    },
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const fileInput = document.getElementById('visita-file') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    if (!file || !selectedBase) {
      toast.error('Completa todos los campos y selecciona un archivo');
      return;
    }

    const baseObj = bases.find(b => b.nombre === selectedBase);
    if (!baseObj) {
      toast.error('Base no válida');
      return;
    }

    setUploading(true);
    try {
      // Upload file
      const filePath = `${baseObj.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('visitas-base')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create record
      const { data: visita, error: insertError } = await supabase
        .from('visitas_base')
        .insert({
          base_id: baseObj.id,
          base_nombre: selectedBase,
          titulo: `${tipo === 'auditoria' ? 'Auditoría' : 'Visita Seguridad'} ${format(new Date(fechaVisita), 'dd/MM/yyyy')}`,
          tipo,
          fecha_visita: fechaVisita,
          archivo_url: filePath,
          archivo_nombre: file.name,
          estado_analisis: 'pendiente',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Documento subido. Iniciando análisis con IA...');
      
      fileInput.value = '';
      queryClient.invalidateQueries({ queryKey: ['visitas-base'] });

      // Trigger analysis
      if (visita) {
        analyzeMutation.mutate(visita.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al subir el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (visita: any) => {
    if (!confirm('¿Eliminar esta visita y su documento?')) return;
    try {
      if (visita.archivo_url) {
        await supabase.storage.from('visitas-base').remove([visita.archivo_url]);
      }
      await supabase.from('visitas_base').delete().eq('id', visita.id);
      toast.success('Visita eliminada');
      queryClient.invalidateQueries({ queryKey: ['visitas-base'] });
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const openDetail = (visita: any) => {
    setSelectedVisita(visita);
    setDetailOpen(true);
  };

  const estadoBadge = (estado: string) => {
    switch (estado) {
      case 'completado': return <Badge className="bg-emerald-600 text-white">Analizado</Badge>;
      case 'procesando': return <Badge className="bg-amber-500 text-white">Procesando…</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      default: return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Subir documento de visita / auditoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-4 items-end">
            <div className="space-y-2">
              <Label>Base</Label>
              <Select value={selectedBase} onValueChange={setSelectedBase}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {bases.map(b => (
                    <SelectItem key={b.id} value={b.nombre}>{b.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="visita_seguridad">Visita de Seguridad</SelectItem>
                  <SelectItem value="auditoria">Auditoría</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={fechaVisita} onChange={e => setFechaVisita(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Archivo PDF</Label>
              <Input id="visita-file" type="file" accept=".pdf,.jpg,.jpeg,.png" />
            </div>
            <div>
              <Button type="submit" disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? 'Subiendo…' : 'Subir y Analizar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Visitas y Auditorías registradas</CardTitle>
          <CardDescription>Documentos analizados por IA con acta de auditoría generada</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando…</div>
          ) : visitas && visitas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  
                  <TableHead>Base</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitas.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell>{format(new Date(v.fecha_visita), 'dd/MM/yyyy')}</TableCell>
                    
                    <TableCell>{v.base_nombre}</TableCell>
                    <TableCell>{v.tipo === 'auditoria' ? 'Auditoría' : 'Visita Seguridad'}</TableCell>
                    <TableCell className="text-center">{estadoBadge(v.estado_analisis)}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        {v.estado_analisis === 'completado' && (
                          <Button variant="ghost" size="icon" onClick={() => openDetail(v)} title="Ver acta">
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {(v.estado_analisis === 'error' || v.estado_analisis === 'pendiente') && (
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => analyzeMutation.mutate(v.id)}
                            disabled={analyzeMutation.isPending}
                            title="Reintentar análisis"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(v)} title="Eliminar">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No hay visitas registradas</p>
              <p className="text-sm mt-2">Sube un documento PDF de visita o auditoría para comenzar el análisis.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Acta de Auditoría — {selectedVisita?.titulo}
            </DialogTitle>
          </DialogHeader>
          {selectedVisita && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Resumen */}
                <section>
                  <h3 className="font-semibold text-lg mb-2">Resumen Ejecutivo</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedVisita.resumen || 'Sin resumen'}</p>
                </section>

                <Separator />

                {/* Puntos fuertes */}
                <section>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-emerald-600" /> Puntos Fuertes
                  </h3>
                  {(selectedVisita.puntos_fuertes as any[])?.length > 0 ? (
                    <div className="space-y-3">
                      {(selectedVisita.puntos_fuertes as any[]).map((p: any, i: number) => (
                        <Card key={i} className="border-emerald-200 bg-emerald-50/50">
                          <CardContent className="pt-4 pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{p.titulo}</p>
                                <p className="text-xs text-muted-foreground mt-1">{p.detalle}</p>
                              </div>
                              <Badge variant="outline" className="shrink-0 text-xs">{p.area}</Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No se identificaron puntos fuertes.</p>}
                </section>

                <Separator />

                {/* Puntos de mejora */}
                <section>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <ArrowUpCircle className="w-5 h-5 text-amber-600" /> Puntos de Mejora
                  </h3>
                  {(selectedVisita.puntos_mejora as any[])?.length > 0 ? (
                    <div className="space-y-3">
                      {(selectedVisita.puntos_mejora as any[]).map((p: any, i: number) => (
                        <Card key={i} className="border-amber-200 bg-amber-50/50">
                          <CardContent className="pt-4 pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{p.titulo}</p>
                                <p className="text-xs text-muted-foreground mt-1">{p.detalle}</p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Badge variant="outline" className="text-xs">{p.area}</Badge>
                                <Badge className={`text-xs ${p.prioridad === 'alta' ? 'bg-red-500' : p.prioridad === 'media' ? 'bg-amber-500' : 'bg-blue-500'} text-white`}>
                                  {p.prioridad}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No se identificaron puntos de mejora.</p>}
                </section>

                <Separator />

                {/* No conformidades */}
                <section>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600" /> No Conformidades
                  </h3>
                  {(selectedVisita.no_conformidades as any[])?.length > 0 ? (
                    <div className="space-y-3">
                      {(selectedVisita.no_conformidades as any[]).map((nc: any, i: number) => (
                        <Card key={i} className="border-red-200 bg-red-50/50">
                          <CardContent className="pt-4 pb-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm">{nc.titulo}</p>
                              <div className="flex gap-1 shrink-0">
                                <Badge variant="outline" className="text-xs">{nc.area}</Badge>
                                <Badge className={`text-xs ${nc.severidad === 'mayor' ? 'bg-red-700' : 'bg-orange-500'} text-white`}>
                                  {nc.severidad}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{nc.detalle}</p>
                            <div className="text-xs space-y-1 border-t pt-2">
                              <p><span className="font-medium">Norma:</span> {nc.norma_referencia}</p>
                              <p><span className="font-medium">Acción correctiva:</span> {nc.accion_correctiva}</p>
                              <p><span className="font-medium">Plazo:</span> {nc.plazo_dias} días</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <p className="text-sm">No se detectaron no conformidades.</p>
                    </div>
                  )}
                </section>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
