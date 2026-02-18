import { useState, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUploader } from '@/components/partes/FileUploader';
import { ExtractionResult } from '@/components/partes/ExtractionResult';
import { EditableExtractionForm } from '@/components/partes/EditableExtractionForm';
import { PartesTable } from '@/components/partes/PartesTable';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, FileText, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ExtraccionResult, Parte, EstadoParte } from '@/types/partes';

export default function PartesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Upload & extraction state
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtraccionResult | null>(null);
  const [editedRegistro, setEditedRegistro] = useState<ExtraccionResult['registroListo'] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedParte, setSelectedParte] = useState<Parte | null>(null);

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
    </AppLayout>
  );
}
