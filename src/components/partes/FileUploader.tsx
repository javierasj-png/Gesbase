import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Image, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileSelect: (file: File, preview: string) => void;
  isProcessing: boolean;
  disabled?: boolean;
}

export function FileUploader({ onFileSelect, isProcessing, disabled }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';

    if (!isImage && !isPdf) {
      alert('Solo se permiten archivos PDF o imágenes (JPG, PNG)');
      return;
    }

    setFileName(file.name);
    setFileType(isImage ? 'image' : 'pdf');

    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setPreview(base64);
        onFileSelect(file, base64);
      };
      reader.readAsDataURL(file);
    } else {
      // Para PDF, mostrar icono genérico
      setPreview(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onFileSelect(file, base64);
      };
      reader.readAsDataURL(file);
    }
  }, [onFileSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const clearFile = useCallback(() => {
    setPreview(null);
    setFileName(null);
    setFileType(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  return (
    <Card className={cn(
      "border-2 border-dashed transition-colors",
      dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <CardContent className="p-6">
        {fileName ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {fileType === 'image' ? (
                  <Image className="h-8 w-8 text-primary" />
                ) : (
                  <FileText className="h-8 w-8 text-primary" />
                )}
                <div>
                  <p className="font-medium text-sm">{fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {fileType === 'image' ? 'Imagen' : 'Documento PDF'}
                  </p>
                </div>
              </div>
              {!isProcessing && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={clearFile}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {preview && fileType === 'image' && (
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <img 
                  src={preview} 
                  alt="Vista previa" 
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center justify-center gap-2 py-4 text-primary">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Extrayendo datos con IA...</span>
              </div>
            )}
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center justify-center py-8 cursor-pointer"
          >
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">
              Arrastra un archivo aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, JPG o PNG (máx. 10MB)
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,image/*,application/pdf"
          onChange={handleInputChange}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}
