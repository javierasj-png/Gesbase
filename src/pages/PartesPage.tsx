import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { FileUploader } from '@/components/partes/FileUploader';
import { ExtractionResult } from '@/components/partes/ExtractionResult';
import { PartesTable } from '@/components/partes/PartesTable';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, FileText, Save, RotateCcw, AlertCircle } from 'lucide-react';
import type { ExtraccionResult, Parte, RegistroListo } from '@/types/partes';

export default function PartesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtraccionResult | null>(null);
  const [currentFile, setCurrentFile] = useState<{ file: File; preview: string } | null>(null);
  const [partes, setPartes] = useState<Parte[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedParte, setSelectedParte] = useState<Parte | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Cargar partes existentes
  const loadPartes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('partes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartes((data || []) as unknown as Parte[]);
    } catch (error) {
      console.error('Error cargando partes:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los partes",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPartes();
  }, [loadPartes]);

  // Procesar archivo con IA
  const handleFileSelect = async (file: File, preview: string) => {
    setCurrentFile({ file, preview });
    setExtractionResult(null);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('imageBase64', preview);
      formData.append('fileName', file.name);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extraer-parte`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al procesar documento');
      }

      setExtractionResult(result);
      
      toast({
        title: "Extracción completada",
        description: `Confianza global: ${result.confianzaGlobal}%`,
      });
    } catch (error) {
      console.error('Error en extracción:', error);
      toast({
        title: "Error de extracción",
        description: error instanceof Error ? error.message : "No se pudo procesar el documento",
        variant: "destructive",
      });
      setExtractionResult({
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Guardar registro
  const handleSave = async () => {
    if (!extractionResult?.registroListo || !currentFile) return;

    setIsSaving(true);
    try {
      // 1. Subir archivo a storage
      const fileExt = currentFile.file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('partes')
        .upload(filePath, currentFile.file);

      if (uploadError) throw uploadError;

      // 2. Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('partes')
        .getPublicUrl(filePath);

      // 3. Insertar registro
      const registro = extractionResult.registroListo as RegistroListo;
      const insertData = {
        numero_parte: registro.numero_parte,
        fecha_parte: registro.fecha_parte,
        hora_parte: registro.hora_parte,
        hora_inicio: registro.hora_inicio,
        hora_fin: registro.hora_fin,
        base: registro.base,
        maquinista_texto: registro.maquinista_texto,
        maquinista_id: registro.maquinista_id,
        tren_servicio: registro.tren_servicio,
        linea_tramo: registro.linea_tramo,
        tipo_parte: registro.tipo_parte || 'Otro',
        descripcion_hechos: registro.descripcion_hechos,
        minutos_retraso: registro.minutos_retraso || 0,
        causa: registro.causa,
        acciones_tomadas: registro.acciones_tomadas,
        firmante: registro.firmante,
        observaciones: registro.observaciones,
        fuente_archivo: registro.fuente_archivo,
        archivo_url: urlData.publicUrl,
        estado: 'Nuevo' as const,
        dudas_conflictos: extractionResult.dudas ? JSON.stringify(extractionResult.dudas) : null,
        confianza_global: extractionResult.confianzaGlobal || 0,
        datos_extraidos: JSON.stringify(extractionResult.parteExtraido),
        created_by: 'sistema',
      };
      
      const { error: insertError } = await supabase
        .from('partes')
        .insert([insertData]);

      if (insertError) throw insertError;

      toast({
        title: "Parte guardado",
        description: "El registro se ha guardado correctamente",
      });

      // Resetear y recargar
      setCurrentFile(null);
      setExtractionResult(null);
      setActiveTab('list');
      loadPartes();
    } catch (error) {
      console.error('Error guardando:', error);
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "No se pudo guardar el registro",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar parte
  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este parte?')) return;

    try {
      const { error } = await supabase
        .from('partes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Parte eliminado",
        description: "El registro se ha eliminado correctamente",
      });

      loadPartes();
    } catch (error) {
      console.error('Error eliminando:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el parte",
        variant: "destructive",
      });
    }
  };

  // Resetear formulario
  const handleReset = () => {
    setCurrentFile(null);
    setExtractionResult(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de Partes</h1>
          <p className="text-muted-foreground">
            Sube documentos de partes y extrae automáticamente los datos con IA
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="upload" className="gap-2">
              <Upload className="h-4 w-4" />
              Subir Parte
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <FileText className="h-4 w-4" />
              Listado ({partes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4 space-y-4">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Columna izquierda: Upload */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Documento</CardTitle>
                    <CardDescription>
                      Arrastra un PDF o imagen del parte para extraer los datos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FileUploader
                      onFileSelect={handleFileSelect}
                      isProcessing={isProcessing}
                      disabled={isSaving}
                    />
                  </CardContent>
                </Card>

                {extractionResult && !extractionResult.error && (
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSave} 
                      disabled={isSaving}
                      className="flex-1"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Guardando...' : 'Guardar Parte'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={handleReset}
                      disabled={isSaving}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Nuevo
                    </Button>
                  </div>
                )}
              </div>

              {/* Columna derecha: Resultado */}
              <div>
                {extractionResult?.error ? (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                        <div>
                          <p className="font-medium text-destructive">Error de extracción</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {extractionResult.error}
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-3"
                            onClick={handleReset}
                          >
                            Intentar de nuevo
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : extractionResult?.parteExtraido ? (
                  <ExtractionResult
                    parteExtraido={extractionResult.parteExtraido}
                    confianzaGlobal={extractionResult.confianzaGlobal || 0}
                    dudas={extractionResult.dudas || []}
                    registroListo={extractionResult.registroListo!}
                  />
                ) : !isProcessing && !currentFile ? (
                  <Card className="h-full flex items-center justify-center min-h-[300px]">
                    <CardContent className="text-center text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Sube un documento para ver el resultado</p>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Partes Registrados</CardTitle>
                <CardDescription>
                  Historial de partes extraídos y guardados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : (
                  <PartesTable
                    partes={partes}
                    onView={setSelectedParte}
                    onDelete={handleDelete}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para ver detalle */}
      <Dialog open={!!selectedParte} onOpenChange={() => setSelectedParte(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Parte {selectedParte?.numero_parte || 'Sin número'}
            </DialogTitle>
          </DialogHeader>
          {selectedParte && (
            <div className="space-y-4">
              <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                {JSON.stringify(selectedParte, null, 2)}
              </pre>
              {selectedParte.archivo_url && (
                <Button asChild variant="outline" className="w-full">
                  <a href={selectedParte.archivo_url} target="_blank" rel="noopener noreferrer">
                    Ver documento original
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
