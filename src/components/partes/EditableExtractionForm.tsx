import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RegistroListo, TipoParte, TipoInforme } from '@/types/partes';

interface EditableExtractionFormProps {
  registroListo: RegistroListo;
  onChange: (updated: RegistroListo) => void;
}

const TIPOS_PARTE: TipoParte[] = ['Incidencia', 'Retraso', 'Avería', 'Seguridad', 'Otro'];
const TIPOS_INFORME: TipoInforme[] = ['PAI', 'Informe Conducción'];

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function EditableExtractionForm({ registroListo, onChange }: EditableExtractionFormProps) {
  const update = (key: keyof RegistroListo, value: string | number | null) => {
    onChange({ ...registroListo, [key]: value === '' ? null : value });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          Editar Datos Extraídos
          <Badge variant="secondary" className="text-xs ml-auto">Revisa y corrige antes de guardar</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Tipo de Informe">
            <Select
              value={registroListo.tipo_informe || ''}
              onValueChange={v => update('tipo_informe', v as TipoInforme)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_INFORME.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Número de Parte">
            <Input
              value={registroListo.numero_parte || ''}
              onChange={e => update('numero_parte', e.target.value)}
              placeholder="Ej: PAI-2026-001"
            />
          </Field>

          <Field label="Fecha">
            <Input
              type="date"
              value={registroListo.fecha_parte || ''}
              onChange={e => update('fecha_parte', e.target.value)}
            />
          </Field>

          <Field label="Hora">
            <Input
              type="time"
              value={registroListo.hora_parte || ''}
              onChange={e => update('hora_parte', e.target.value)}
            />
          </Field>

          <Field label="Hora Inicio">
            <Input
              type="time"
              value={registroListo.hora_inicio || ''}
              onChange={e => update('hora_inicio', e.target.value)}
            />
          </Field>

          <Field label="Hora Fin">
            <Input
              type="time"
              value={registroListo.hora_fin || ''}
              onChange={e => update('hora_fin', e.target.value)}
            />
          </Field>

          <Field label="Base/Dependencia">
            <Input
              value={registroListo.base || ''}
              onChange={e => update('base', e.target.value)}
              placeholder="Ej: Madrid-Chamartín"
            />
          </Field>

          <Field label="Maquinista">
            <Input
              value={registroListo.maquinista_texto || ''}
              onChange={e => update('maquinista_texto', e.target.value)}
              placeholder="Nombre del maquinista"
            />
          </Field>

          <Field label="ID Maquinista">
            <Input
              value={registroListo.maquinista_id || ''}
              onChange={e => update('maquinista_id', e.target.value)}
              placeholder="Matrícula"
            />
          </Field>

          <Field label="Tren/Servicio">
            <Input
              value={registroListo.tren_servicio || ''}
              onChange={e => update('tren_servicio', e.target.value)}
              placeholder="Ej: AVE 1234"
            />
          </Field>

          <Field label="Línea/Tramo">
            <Input
              value={registroListo.linea_tramo || ''}
              onChange={e => update('linea_tramo', e.target.value)}
              placeholder="Ej: Madrid-Sevilla"
            />
          </Field>

          <Field label="Tipo de Suceso">
            <Select
              value={registroListo.tipo_parte || 'Otro'}
              onValueChange={v => update('tipo_parte', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PARTE.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Minutos Retraso">
            <Input
              type="number"
              min={0}
              value={registroListo.minutos_retraso || 0}
              onChange={e => update('minutos_retraso', parseInt(e.target.value) || 0)}
            />
          </Field>

          <Field label="Firmante" className="md:col-span-2 lg:col-span-1">
            <Input
              value={registroListo.firmante || ''}
              onChange={e => update('firmante', e.target.value)}
              placeholder="Nombre del firmante"
            />
          </Field>

          <Field label="Causa" className="md:col-span-2 lg:col-span-3">
            <Input
              value={registroListo.causa || ''}
              onChange={e => update('causa', e.target.value)}
              placeholder="Causa del incidente"
            />
          </Field>

          <Field label="Descripción de los Hechos" className="md:col-span-2 lg:col-span-3">
            <Textarea
              value={registroListo.descripcion_hechos || ''}
              onChange={e => update('descripcion_hechos', e.target.value)}
              rows={3}
              placeholder="Descripción detallada"
            />
          </Field>

          <Field label="Acciones Tomadas" className="md:col-span-2 lg:col-span-3">
            <Textarea
              value={registroListo.acciones_tomadas || ''}
              onChange={e => update('acciones_tomadas', e.target.value)}
              rows={2}
              placeholder="Acciones realizadas"
            />
          </Field>

          <Field label="Observaciones" className="md:col-span-2 lg:col-span-3">
            <Textarea
              value={registroListo.observaciones || ''}
              onChange={e => update('observaciones', e.target.value)}
              rows={2}
              placeholder="Observaciones adicionales"
            />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
