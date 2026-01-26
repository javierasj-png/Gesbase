import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ParteExtraido, DudaConflicto, RegistroListo } from '@/types/partes';

interface ExtractionResultProps {
  parteExtraido: ParteExtraido;
  confianzaGlobal: number;
  dudas: DudaConflicto[];
  registroListo: RegistroListo;
}

const fieldLabels: Record<string, string> = {
  numeroParte: 'Número de Parte',
  fechaParte: 'Fecha',
  horaParte: 'Hora',
  horaInicio: 'Hora Inicio',
  horaFin: 'Hora Fin',
  base: 'Base/Dependencia',
  maquinista: 'Maquinista',
  maquinistaId: 'ID Maquinista',
  trenServicio: 'Tren/Servicio',
  lineaTramo: 'Línea/Tramo',
  tipoParte: 'Tipo de Parte',
  descripcionHechos: 'Descripción',
  minutosRetraso: 'Minutos Retraso',
  causa: 'Causa',
  accionesTomadas: 'Acciones Tomadas',
  firmante: 'Firmante',
  observaciones: 'Observaciones',
};

function ConfidenceBadge({ value }: { value: number }) {
  const getColor = () => {
    if (value >= 80) return 'bg-green-500/10 text-green-600 border-green-500/20';
    if (value >= 50) return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
    return 'bg-red-500/10 text-red-600 border-red-500/20';
  };

  return (
    <Badge variant="outline" className={cn("text-xs", getColor())}>
      {value}%
    </Badge>
  );
}

function FieldRow({ label, value, confianza }: { label: string; value: string | number | null; confianza: number }) {
  if (value === null || value === undefined || value === '') {
    return (
      <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm text-muted-foreground/50 italic">No detectado</span>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between py-2 border-b border-border/50 last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <span className="text-sm font-medium">{String(value)}</span>
        <ConfidenceBadge value={confianza} />
      </div>
    </div>
  );
}

export function ExtractionResult({ parteExtraido, confianzaGlobal, dudas, registroListo }: ExtractionResultProps) {
  const getGlobalIcon = () => {
    if (confianzaGlobal >= 80) return <CheckCircle2 className="h-6 w-6 text-green-500" />;
    if (confianzaGlobal >= 50) return <AlertTriangle className="h-6 w-6 text-yellow-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  const getGlobalColor = () => {
    if (confianzaGlobal >= 80) return 'text-green-500';
    if (confianzaGlobal >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="space-y-4">
      {/* Resumen de confianza */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getGlobalIcon()}
              <div>
                <p className="font-medium">Extracción completada</p>
                <p className="text-sm text-muted-foreground">
                  {confianzaGlobal >= 80 ? 'Alta confianza - listo para guardar' :
                   confianzaGlobal >= 50 ? 'Confianza media - revisar campos marcados' :
                   'Baja confianza - requiere verificación manual'}
                </p>
              </div>
            </div>
            <div className={cn("text-3xl font-bold", getGlobalColor())}>
              {confianzaGlobal}%
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dudas y conflictos */}
      {dudas && dudas.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-yellow-500" />
              Dudas/Conflictos ({dudas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {dudas.map((duda, idx) => (
                <li key={idx} className="text-sm">
                  <span className="font-medium text-yellow-600">{duda.campo}:</span>{' '}
                  <span className="text-muted-foreground">{duda.motivo}</span>
                  {duda.necesito && (
                    <span className="block text-xs text-yellow-600 mt-0.5">
                      → Necesito: {duda.necesito}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Datos extraídos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Datos Extraídos</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid md:grid-cols-2 gap-x-6">
            <div>
              {Object.entries(parteExtraido).slice(0, 9).map(([key, field]) => (
                <FieldRow 
                  key={key}
                  label={fieldLabels[key] || key}
                  value={field?.valor}
                  confianza={field?.confianza || 0}
                />
              ))}
            </div>
            <div>
              {Object.entries(parteExtraido).slice(9).map(([key, field]) => (
                <FieldRow 
                  key={key}
                  label={fieldLabels[key] || key}
                  value={field?.valor}
                  confianza={field?.confianza || 0}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* JSON del registro listo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Registro Listo para Insertar</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-48">
            {JSON.stringify(registroListo, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
