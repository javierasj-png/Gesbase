import { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { exportMarkdownToDoc } from '@/utils/exportMarkdownToDoc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Upload, FileText, Loader2, Eye, Trash2, CheckCircle2,
  AlertTriangle, XCircle, ThumbsUp, ArrowUpCircle, ShieldAlert,
  RefreshCw, Sparkles, Calendar, ClipboardList, FileBarChart, Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

interface VisitasBaseTabProps {
  baseFilter: string;
  bases: { id: string; nombre: string }[];
  fechaDesde?: string;
  fechaHasta?: string;
  canGenerateReport?: boolean;
}

export function VisitasBaseTab({ baseFilter, bases, fechaDesde, fechaHasta, canGenerateReport = false }: VisitasBaseTabProps) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [selectedBase, setSelectedBase] = useState<string>('');
  const [selectedVisita, setSelectedVisita] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [generatingReportBase, setGeneratingReportBase] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportBaseName, setReportBaseName] = useState<string | null>(null);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);

  // Sync selectedBase when bases load or baseFilter changes
  useEffect(() => {
    if (baseFilter !== 'all') {
      setSelectedBase(baseFilter);
    } else if (bases.length > 0 && !selectedBase) {
      setSelectedBase(bases[0].nombre);
    }
  }, [baseFilter, bases, selectedBase]);

  const effectiveBaseFilter = baseFilter !== 'all' ? baseFilter : undefined;

  const handleGenerarInforme = async (base: string) => {
    setGeneratingReportBase(base);
    try {
      const { data, error } = await supabase.functions.invoke('generar-propuesta-auditoria', {
        body: { baseFilter: base },
      });
      if (error) {
        let realMsg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            realMsg = ctx.json.error || ctx.json.warning || realMsg;
          } else if (ctx?.body) {
            const text = typeof ctx.body === 'string' ? ctx.body : await new Response(ctx.body).text();
            try {
              const parsed = JSON.parse(text);
              realMsg = parsed.error || parsed.warning || text;
            } catch {
              realMsg = text || realMsg;
            }
          }
        } catch { /* noop */ }
        throw new Error(realMsg);
      }
      if (data?.informe) {
        setReportContent(data.informe);
        setReportBaseName(base);
        setReportDialogOpen(true);
        if (data.warning) toast.warning(data.warning);
      } else {
        throw new Error(data?.error || 'No se recibió el informe');
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      toast.error(err.message || 'Error al generar el informe');
    } finally {
      setGeneratingReportBase(null);
    }
  };


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

  // Propuesta de auditoría
  const propuesta = useMemo(() => {
    if (!visitas || !bases.length) return null;

    const basesToCheck = effectiveBaseFilter
      ? bases.filter(b => b.nombre === effectiveBaseFilter)
      : bases;

    const hoy = new Date();
    const recomendaciones: {
      base: string;
      ultimaVisita?: string;
      ultimaAuditoria?: string;
      diasSinVisita: number;
      diasSinAuditoria: number;
      ncPendientes: number;
      accion: string;
      prioridad: 'alta' | 'media' | 'baja';
    }[] = [];

    for (const base of basesToCheck) {
      const visitasBase = visitas.filter(v => v.base_nombre === base.nombre);
      
      const visitasSeguridad = visitasBase
        .filter(v => v.tipo === 'visita_seguridad')
        .sort((a, b) => new Date(b.fecha_visita).getTime() - new Date(a.fecha_visita).getTime());
      
      const auditorias = visitasBase
        .filter(v => v.tipo === 'auditoria')
        .sort((a, b) => new Date(b.fecha_visita).getTime() - new Date(a.fecha_visita).getTime());

      const ultimaVisita = visitasSeguridad[0]?.fecha_visita;
      const ultimaAuditoria = auditorias[0]?.fecha_visita;
      
      const diasSinVisita = ultimaVisita
        ? differenceInDays(hoy, new Date(ultimaVisita))
        : 999;
      const diasSinAuditoria = ultimaAuditoria
        ? differenceInDays(hoy, new Date(ultimaAuditoria))
        : 999;

      // Contar NC pendientes (de auditorías completadas)
      let ncPendientes = 0;
      for (const v of visitasBase) {
        if (v.estado_analisis === 'completado' && Array.isArray(v.no_conformidades)) {
          ncPendientes += (v.no_conformidades as any[]).length;
        }
      }

      let accion = '';
      let prioridad: 'alta' | 'media' | 'baja' = 'baja';

      if (diasSinVisita > 180 && diasSinAuditoria > 365) {
        accion = 'Realizar auditoría y visita de seguridad (supera plazos recomendados)';
        prioridad = 'alta';
      } else if (diasSinAuditoria > 365) {
        accion = 'Realizar auditoría (más de 12 meses sin auditoría)';
        prioridad = 'alta';
      } else if (diasSinVisita > 180) {
        accion = 'Programar visita de seguridad (más de 6 meses sin visita)';
        prioridad = 'media';
      } else if (ncPendientes > 0) {
        accion = `Seguimiento de ${ncPendientes} no conformidad(es) detectada(s)`;
        prioridad = ncPendientes > 3 ? 'alta' : 'media';
      } else if (diasSinVisita > 90) {
        accion = 'Programar visita de seguimiento (más de 3 meses)';
        prioridad = 'baja';
      } else {
        accion = 'Sin acciones requeridas';
        prioridad = 'baja';
      }

      recomendaciones.push({
        base: base.nombre,
        ultimaVisita: ultimaVisita || undefined,
        ultimaAuditoria: ultimaAuditoria || undefined,
        diasSinVisita,
        diasSinAuditoria,
        ncPendientes,
        accion,
        prioridad,
      });
    }

    // Ordenar por prioridad
    const prioridadOrder = { alta: 0, media: 1, baja: 2 };
    recomendaciones.sort((a, b) => prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad]);

    return recomendaciones;
  }, [visitas, bases, effectiveBaseFilter]);

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

    if (!file) {
      toast.error('Selecciona un archivo');
      return;
    }

    if (!selectedBase) {
      toast.error('Selecciona una base');
      return;
    }

    const baseObj = bases.find(b => b.nombre === selectedBase);
    if (!baseObj) {
      toast.error('Base no válida');
      return;
    }

    // Validate file size
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('El archivo excede el tamaño máximo de 10MB');
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

      // Create record with placeholder - AI will detect type & date
      const { data: visita, error: insertError } = await supabase
        .from('visitas_base')
        .insert({
          base_id: baseObj.id,
          base_nombre: selectedBase,
          titulo: `Documento ${format(new Date(), 'dd/MM/yyyy')}`,
          tipo: 'visita_seguridad', // placeholder, AI will update
          fecha_visita: format(new Date(), 'yyyy-MM-dd'), // placeholder, AI will update
          archivo_url: filePath,
          archivo_nombre: file.name,
          estado_analisis: 'pendiente',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('Documento subido. La IA detectará el tipo, fecha y analizará el contenido...');
      
      fileInput.value = '';
      queryClient.invalidateQueries({ queryKey: ['visitas-base'] });

      // Trigger analysis
      if (visita) {
        analyzeMutation.mutate(visita.id);
      }
    } catch (err: any) {
      console.error('Upload error:', err);
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

  const prioridadBadge = (p: string) => {
    switch (p) {
      case 'alta': return <Badge className="bg-red-500 text-white">Alta</Badge>;
      case 'media': return <Badge className="bg-amber-500 text-white">Media</Badge>;
      default: return <Badge variant="secondary">Baja</Badge>;
    }
  };

  const tipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'auditoria': return 'Auditoría (Lista 122)';
      case 'visita_seguridad': return 'Visita Seguridad (Lista 80)';
      default: return tipo;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload form - simplified: only base + file */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" /> Subir documento de visita / auditoría
          </CardTitle>
          <CardDescription>
            La IA detectará automáticamente si es una Visita (Lista 80) o Auditoría (Lista 122), la fecha y analizará el contenido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-4 items-end">
            <div className="space-y-2">
              <Label>Base</Label>
              <Select value={selectedBase} onValueChange={setSelectedBase}>
                <SelectTrigger><SelectValue placeholder="Seleccionar base" /></SelectTrigger>
                <SelectContent>
                  {bases.map(b => (
                    <SelectItem key={b.id} value={b.nombre}>{b.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Archivo (PDF o imagen)</Label>
              <Input id="visita-file" type="file" accept=".pdf,.jpg,.jpeg,.png" />
            </div>
            <div>
              <Button type="submit" disabled={uploading || !selectedBase}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {uploading ? 'Subiendo…' : 'Subir y Analizar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Propuesta de auditoría */}
      {propuesta && propuesta.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> Propuesta de Auditoría — {format(new Date(), 'dd/MM/yyyy')}
            </CardTitle>
            <CardDescription>
              Estado actual y recomendaciones basadas en el histórico de visitas y auditorías
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Base</TableHead>
                  <TableHead>Última Visita</TableHead>
                  <TableHead>Última Auditoría</TableHead>
                  <TableHead className="text-center">NC detectadas</TableHead>
                  <TableHead>Prioridad</TableHead>
                   <TableHead>Recomendación</TableHead>
                   <TableHead className="text-center">Informe</TableHead>
                 </TableRow>
               </TableHeader>
              <TableBody>
                {propuesta.map(r => (
                  <TableRow key={r.base}>
                    <TableCell className="font-medium">{r.base}</TableCell>
                    <TableCell>
                      {r.ultimaVisita 
                        ? <span>{format(new Date(r.ultimaVisita), 'dd/MM/yyyy')} <span className="text-muted-foreground text-xs">({r.diasSinVisita}d)</span></span>
                        : <span className="text-muted-foreground italic">Sin registro</span>
                      }
                    </TableCell>
                    <TableCell>
                      {r.ultimaAuditoria 
                        ? <span>{format(new Date(r.ultimaAuditoria), 'dd/MM/yyyy')} <span className="text-muted-foreground text-xs">({r.diasSinAuditoria}d)</span></span>
                        : <span className="text-muted-foreground italic">Sin registro</span>
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      {r.ncPendientes > 0 
                        ? <Badge variant="destructive">{r.ncPendientes}</Badge>
                        : <span className="text-muted-foreground">0</span>
                      }
                    </TableCell>
                    <TableCell>{prioridadBadge(r.prioridad)}</TableCell>
                     <TableCell className="text-sm max-w-xs">{r.accion}</TableCell>
                     <TableCell className="text-center">
                       {canGenerateReport ? (
                         <Button
                           variant="ghost"
                           size="icon"
                           disabled={generatingReportBase === r.base}
                           title="Generar informe IA para esta base"
                           onClick={async () => {
                             setGeneratingReportBase(r.base);
                             try {
                               const { data, error } = await supabase.functions.invoke('generar-propuesta-auditoria', {
                                 body: { baseFilter: r.base },
                               });
                               if (error) {
                                 // Intentar extraer el mensaje real devuelto por la función
                                 let realMsg = error.message;
                                 try {
                                   const ctx: any = (error as any).context;
                                   if (ctx?.json) {
                                     realMsg = ctx.json.error || ctx.json.warning || realMsg;
                                   } else if (ctx?.body) {
                                     const text = typeof ctx.body === 'string' ? ctx.body : await new Response(ctx.body).text();
                                     try {
                                       const parsed = JSON.parse(text);
                                       realMsg = parsed.error || parsed.warning || text;
                                     } catch {
                                       realMsg = text || realMsg;
                                     }
                                   }
                                 } catch { /* noop */ }
                                 throw new Error(realMsg);
                               }
                               if (data?.informe) {
                                 setReportContent(data.informe);
                                 setReportBaseName(r.base);
                                 setReportDialogOpen(true);
                                 if (data.warning) {
                                   toast.warning(data.warning);
                                 }
                               } else {
                                 throw new Error(data?.error || 'No se recibió el informe');
                               }
                             } catch (err: any) {
                               console.error('Error generating report:', err);
                               toast.error(err.message || 'Error al generar el informe');
                             } finally {
                               setGeneratingReportBase(null);
                             }
                           }}
                         >
                           {generatingReportBase === r.base
                             ? <Loader2 className="w-4 h-4 animate-spin" />
                             : <FileBarChart className="w-4 h-4" />
                           }
                         </Button>
                       ) : (
                         <span className="text-xs text-muted-foreground">—</span>
                       )}
                     </TableCell>
                   </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Visitas y Auditorías</CardTitle>
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
                    <TableCell>{tipoLabel(v.tipo)}</TableCell>
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
              {selectedVisita?.titulo}
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

      {/* AI Report Dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <FileBarChart className="w-5 h-5 text-primary" />
                Informe de Propuesta de Auditoría
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                className="mr-8"
                onClick={() => {
                  if (reportContent) {
                    const safeName = (reportBaseName || 'informe').replace(/\s+/g, '_');
                    exportMarkdownToDoc(reportContent, `Propuesta_Auditoria_${safeName}_${format(new Date(), 'yyyyMMdd')}.doc`);
                  }
                }}
              >
                <Download className="w-4 h-4 mr-1" />
                Exportar .doc
              </Button>
            </div>
          </DialogHeader>
          {reportContent && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{reportContent}</ReactMarkdown>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
