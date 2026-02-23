import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUploader } from '@/components/partes/FileUploader';
import { ExtractionResult } from '@/components/partes/ExtractionResult';
import { EditableExtractionForm } from '@/components/partes/EditableExtractionForm';
import { PartesTable } from '@/components/partes/PartesTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, FileText, Search, X, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExtraccionResult, Parte, EstadoParte, TipoInforme } from '@/types/partes';
import { useBaseFilter } from '@/hooks/useBaseFilter';
export default function PartesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { getAccessibleBases } = useBaseFilter();

  // Upload & extraction state
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtraccionResult | null>(null);
  const [editedRegistro, setEditedRegistro] = useState<ExtraccionResult['registroListo'] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedParte, setSelectedParte] = useState<Parte | null>(null);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingParte, setEditingParte] = useState<Parte | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState<string>('all');

  // Fetch partes from DB
  const { data: partes = [], isLoading } = useQuery({
    queryKey: ['partes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Parte[];
    },
  });

  // Handle file selection and AI extraction
  const handleFileSelect = useCallback(async (file: File, preview: string) => {
    setCurrentFile(file);
    setExtractionResult(null);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      
      if (file.type.startsWith('image/')) {
        formData.append('imageBase64', preview);
      } else {
        formData.append('file', file);
      }
      formData.append('fileName', file.name);

      const { data, error } = await supabase.functions.invoke('extraer-parte', {
        body: formData,
      });

      if (error) throw error;

      if (data?.success) {
        const result = data as ExtraccionResult;
        setExtractionResult(result);
        setEditedRegistro(result.registroListo ? { ...result.registroListo } : null);
        toast({
          title: 'Extracción completada',
          description: `Confianza global: ${data.confianzaGlobal}%`,
        });
      } else {
        throw new Error(data?.error || 'Error en la extracción');
      }
    } catch (err: any) {
      console.error('Extraction error:', err);
      toast({
        title: 'Error de extracción',
        description: err.message || 'No se pudo procesar el documento',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // Save extracted parte to DB
  const handleSave = async () => {
    if (!editedRegistro) return;

    setIsSaving(true);
    try {
      const reg = editedRegistro;

      // Upload file to storage if available
      let archivoUrl: string | null = null;
      if (currentFile) {
        const filePath = `${Date.now()}_${currentFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('partes')
          .upload(filePath, currentFile);
        if (uploadError) {
          console.warn('File upload failed:', uploadError);
        } else {
          archivoUrl = filePath;
        }
      }

      const { error } = await supabase.from('partes').insert({
        numero_parte: reg.numero_parte,
        tipo_informe: reg.tipo_informe,
        fecha_parte: reg.fecha_parte,
        hora_parte: reg.hora_parte,
        hora_inicio: reg.hora_inicio,
        hora_fin: reg.hora_fin,
        base: reg.base,
        maquinista_texto: reg.maquinista_texto,
        maquinista_id: reg.maquinista_id,
        tren_servicio: reg.tren_servicio,
        linea_tramo: reg.linea_tramo,
        tipo_parte: reg.tipo_parte || 'Otro',
        descripcion_hechos: reg.descripcion_hechos,
        minutos_retraso: reg.minutos_retraso || 0,
        causa: reg.causa,
        acciones_tomadas: reg.acciones_tomadas,
        firmante: reg.firmante,
        observaciones: reg.observaciones,
        fuente_archivo: reg.fuente_archivo,
        archivo_url: archivoUrl,
        estado: 'Nuevo',
        confianza_global: extractionResult.confianzaGlobal || 0,
        dudas_conflictos: extractionResult.dudas ? JSON.stringify(extractionResult.dudas) : null,
        datos_extraidos: extractionResult.parteExtraido as any,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: 'Parte guardado',
        description: `Parte ${reg.numero_parte || 'sin número'} almacenado correctamente`,
      });

      // Reset
      setExtractionResult(null);
      setEditedRegistro(null);
      setCurrentFile(null);
      queryClient.invalidateQueries({ queryKey: ['partes'] });
    } catch (err: any) {
      console.error('Save error:', err);
      toast({
        title: 'Error al guardar',
        description: err.message || 'No se pudo guardar el parte',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete parte
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este parte?')) return;
    try {
      const parte = partes.find(p => p.id === id);
      if (parte?.archivo_url) {
        await supabase.storage.from('partes').remove([parte.archivo_url]);
      }
      const { error } = await supabase.from('partes').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Parte eliminado' });
      queryClient.invalidateQueries({ queryKey: ['partes'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // View detail
  const handleView = (parte: Parte) => {
    setSelectedParte(parte);
    setDetailOpen(true);
  };

  // Edit parte
  const handleEdit = (parte: Parte) => {
    setEditingParte({ ...parte });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingParte) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('partes')
        .update({
          tipo_informe: editingParte.tipo_informe,
          base: editingParte.base,
          numero_parte: editingParte.numero_parte,
          fecha_parte: editingParte.fecha_parte,
          hora_parte: editingParte.hora_parte,
          hora_inicio: editingParte.hora_inicio,
          hora_fin: editingParte.hora_fin,
          maquinista_texto: editingParte.maquinista_texto,
          maquinista_id: editingParte.maquinista_id,
          tren_servicio: editingParte.tren_servicio,
          linea_tramo: editingParte.linea_tramo,
          tipo_parte: editingParte.tipo_parte,
          descripcion_hechos: editingParte.descripcion_hechos,
          minutos_retraso: editingParte.minutos_retraso,
          causa: editingParte.causa,
          acciones_tomadas: editingParte.acciones_tomadas,
          firmante: editingParte.firmante,
          observaciones: editingParte.observaciones,
          estado: editingParte.estado,
          updated_by: user?.id,
        })
        .eq('id', editingParte.id);
      if (error) throw error;
      toast({ title: 'Parte actualizado correctamente' });
      setEditOpen(false);
      setEditingParte(null);
      queryClient.invalidateQueries({ queryKey: ['partes'] });
    } catch (err: any) {
      toast({ title: 'Error al actualizar', description: err.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Filtered partes
  const filteredPartes = partes.filter(p => {
    const matchesSearch = !searchTerm ||
      (p.numero_parte?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.maquinista_texto?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.base?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEstado = estadoFilter === 'all' || p.estado === estadoFilter;
    return matchesSearch && matchesEstado;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de Partes</h1>
          <p className="text-muted-foreground">
            Gestión y extracción automática de partes con IA
          </p>
        </div>

        {/* Upload section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Subir Parte</CardTitle>
            <CardDescription>Arrastra un PDF o imagen para extraer datos automáticamente</CardDescription>
          </CardHeader>
          <CardContent>
            <FileUploader
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
              disabled={isSaving}
            />
          </CardContent>
        </Card>

        {/* Extraction result */}
        {extractionResult && extractionResult.parteExtraido && (
          <div className="space-y-4">
            <ExtractionResult
              parteExtraido={extractionResult.parteExtraido}
              confianzaGlobal={extractionResult.confianzaGlobal || 0}
              dudas={extractionResult.dudas || []}
              registroListo={extractionResult.registroListo!}
            />

            {editedRegistro && (
              <EditableExtractionForm
                registroListo={editedRegistro}
                onChange={setEditedRegistro}
              />
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => { setExtractionResult(null); setEditedRegistro(null); setCurrentFile(null); }}
              >
                <X className="w-4 h-4 mr-2" />
                Descartar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Guardar Parte
              </Button>
            </div>
          </div>
        )}

        {/* Filters + Table */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Partes</CardTitle>
            <CardDescription>Consulta y gestión de partes registrados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nº parte, maquinista o base..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={estadoFilter} onValueChange={setEstadoFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="Nuevo">Nuevo</SelectItem>
                  <SelectItem value="En revisión">En revisión</SelectItem>
                  <SelectItem value="Cerrado">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <PartesTable
                partes={filteredPartes}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Parte {selectedParte?.numero_parte || 'sin número'}
            </DialogTitle>
          </DialogHeader>
          {selectedParte && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Fecha:</span> <span className="font-medium">{selectedParte.fecha_parte ? format(new Date(selectedParte.fecha_parte), 'dd/MM/yyyy', { locale: es }) : '-'}</span></div>
                  <div><span className="text-muted-foreground">Hora:</span> <span className="font-medium">{selectedParte.hora_parte || '-'}</span></div>
                  <div><span className="text-muted-foreground">Base:</span> <span className="font-medium">{selectedParte.base || '-'}</span></div>
                  <div><span className="text-muted-foreground">Maquinista:</span> <span className="font-medium">{selectedParte.maquinista_texto || '-'}</span></div>
                  <div><span className="text-muted-foreground">Tren/Servicio:</span> <span className="font-medium">{selectedParte.tren_servicio || '-'}</span></div>
                  <div><span className="text-muted-foreground">Línea/Tramo:</span> <span className="font-medium">{selectedParte.linea_tramo || '-'}</span></div>
                  <div><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{selectedParte.tipo_parte}</span></div>
                  <div><span className="text-muted-foreground">Min. retraso:</span> <span className="font-medium">{selectedParte.minutos_retraso}</span></div>
                </div>
                <Separator />
                {selectedParte.descripcion_hechos && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Descripción</p>
                    <p className="text-sm whitespace-pre-line">{selectedParte.descripcion_hechos}</p>
                  </div>
                )}
                {selectedParte.causa && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Causa</p>
                    <p className="text-sm">{selectedParte.causa}</p>
                  </div>
                )}
                {selectedParte.acciones_tomadas && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Acciones tomadas</p>
                    <p className="text-sm">{selectedParte.acciones_tomadas}</p>
                  </div>
                )}
                {selectedParte.observaciones && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Observaciones</p>
                    <p className="text-sm">{selectedParte.observaciones}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Modificar Informe
            </DialogTitle>
          </DialogHeader>
          {editingParte && (
            <ScrollArea className="max-h-[65vh] pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo de Informe</Label>
                  <Select
                    value={editingParte.tipo_informe || ''}
                    onValueChange={v => setEditingParte({ ...editingParte, tipo_informe: v as TipoInforme })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAI">P.A.I.</SelectItem>
                      <SelectItem value="Informe Conducción">Informe Conducción</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Base</Label>
                  <Select
                    value={editingParte.base || ''}
                    onValueChange={v => setEditingParte({ ...editingParte, base: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar base..." />
                    </SelectTrigger>
                    <SelectContent>
                      {getAccessibleBases.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nº Parte</Label>
                  <Input
                    value={editingParte.numero_parte || ''}
                    onChange={e => setEditingParte({ ...editingParte, numero_parte: e.target.value || null })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Fecha</Label>
                  <Input
                    type="date"
                    value={editingParte.fecha_parte || ''}
                    onChange={e => setEditingParte({ ...editingParte, fecha_parte: e.target.value || null })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Hora</Label>
                  <Input
                    type="time"
                    value={editingParte.hora_parte || ''}
                    onChange={e => setEditingParte({ ...editingParte, hora_parte: e.target.value || null })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Maquinista</Label>
                  <Input
                    value={editingParte.maquinista_texto || ''}
                    onChange={e => setEditingParte({ ...editingParte, maquinista_texto: e.target.value || null })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tren/Servicio</Label>
                  <Input
                    value={editingParte.tren_servicio || ''}
                    onChange={e => setEditingParte({ ...editingParte, tren_servicio: e.target.value || null })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Línea/Tramo</Label>
                  <Input
                    value={editingParte.linea_tramo || ''}
                    onChange={e => setEditingParte({ ...editingParte, linea_tramo: e.target.value || null })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo de Suceso</Label>
                  <Select
                    value={editingParte.tipo_parte || 'Otro'}
                    onValueChange={v => setEditingParte({ ...editingParte, tipo_parte: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Incidencia">Incidencia</SelectItem>
                      <SelectItem value="Retraso">Retraso</SelectItem>
                      <SelectItem value="Avería">Avería</SelectItem>
                      <SelectItem value="Seguridad">Seguridad</SelectItem>
                      <SelectItem value="Otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Min. Retraso</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editingParte.minutos_retraso || 0}
                    onChange={e => setEditingParte({ ...editingParte, minutos_retraso: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estado</Label>
                  <Select
                    value={editingParte.estado}
                    onValueChange={v => setEditingParte({ ...editingParte, estado: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Nuevo">Nuevo</SelectItem>
                      <SelectItem value="En revisión">En revisión</SelectItem>
                      <SelectItem value="Cerrado">Cerrado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Firmante</Label>
                  <Input
                    value={editingParte.firmante || ''}
                    onChange={e => setEditingParte({ ...editingParte, firmante: e.target.value || null })}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="text-xs text-muted-foreground">Causa</Label>
                  <Input
                    value={editingParte.causa || ''}
                    onChange={e => setEditingParte({ ...editingParte, causa: e.target.value || null })}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="text-xs text-muted-foreground">Descripción de los Hechos</Label>
                  <Textarea
                    value={editingParte.descripcion_hechos || ''}
                    onChange={e => setEditingParte({ ...editingParte, descripcion_hechos: e.target.value || null })}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="text-xs text-muted-foreground">Acciones Tomadas</Label>
                  <Textarea
                    value={editingParte.acciones_tomadas || ''}
                    onChange={e => setEditingParte({ ...editingParte, acciones_tomadas: e.target.value || null })}
                    rows={2}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="text-xs text-muted-foreground">Observaciones</Label>
                  <Textarea
                    value={editingParte.observaciones || ''}
                    onChange={e => setEditingParte({ ...editingParte, observaciones: e.target.value || null })}
                    rows={2}
                  />
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={isUpdating}>
              {isUpdating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
