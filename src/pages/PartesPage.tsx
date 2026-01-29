import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Construction } from 'lucide-react';

export default function PartesPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de Partes</h1>
          <p className="text-muted-foreground">
            Gestión y extracción automática de partes con IA
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Construction className="h-5 w-5 text-amber-500" />
              Módulo en Desarrollo
            </CardTitle>
            <CardDescription>
              Esta funcionalidad estará disponible próximamente
            </CardDescription>
          </CardHeader>
          <CardContent className="py-12 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-2">
              El módulo de Control de Partes permitirá:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Subir documentos PDF o imágenes de partes</li>
              <li>• Extracción automática de datos con IA</li>
              <li>• Validación y almacenamiento de registros</li>
              <li>• Historial y consulta de partes</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
