import { HelpCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ParteExtraido, DudaConflicto, RegistroListo } from '@/types/partes';

interface ExtractionResultProps {
  parteExtraido: ParteExtraido;
  confianzaGlobal?: number;
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

function FieldRow({ label, value }: { label: string; value: string | number | null }) {
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
      <span className="text-sm font-medium text-right">{String(value)}</span>
    </div>
  );
}

export function ExtractionResult({ parteExtraido, dudas, registroListo }: ExtractionResultProps) {
  return (
    <div className="space-y-4">
      {/* Resumen */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <p className="font-medium">Extracción completada</p>
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
                />
              ))}
            </div>
            <div>
              {Object.entries(parteExtraido).slice(9).map(([key, field]) => (
                <FieldRow 
                  key={key}
                  label={fieldLabels[key] || key}
                  value={field?.valor}
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
