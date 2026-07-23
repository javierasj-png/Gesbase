import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Plus, CalendarClock } from 'lucide-react';
import { CriteriosPlanAnual, CRITERIOS_DEFAULT } from '@/hooks/useCriteriosPlanAnual';
import { getAvailableYears } from '@/hooks/useYearFilter';

/**
 * Panel de administración para editar los criterios del Plan de Acción Anual por año.
 * Cada año guarda su propia fila: los años pasados quedan congelados con los criterios
 * vigentes en ese momento, garantizando trazabilidad de auditoría.
 */
export function CriteriosPlanAnualAdmin() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<CriteriosPlanAnual[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [current, setCurrent] = useState<CriteriosPlanAnual | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('criterios_plan_anual')
      .select('*')
      .order('anio', { ascending: false });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setRows((data || []) as CriteriosPlanAnual[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const existing = rows.find(r => r.anio === selectedYear);
    if (existing) setCurrent({ ...existing });
    else setCurrent({ anio: selectedYear, ...CRITERIOS_DEFAULT, notas: null });
  }, [rows, selectedYear]);

  const yearsWithData = new Set(rows.map(r => r.anio));
  const availableYears = getAvailableYears();

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    const payload = {
      anio: current.anio,
      registro_km_minimo: current.registro_km_minimo,
      acompanamientos_por_red: current.acompanamientos_por_red,
      acompanamientos_con_1201: current.acompanamientos_con_1201,
      alcohol_anual: current.alcohol_anual,
      drogas_cobertura_pct: current.drogas_cobertura_pct,
      vigencia_1201_anios: current.vigencia_1201_anios,
      notas: current.notas,
    };
    const { error } = await supabase
      .from('criterios_plan_anual')
      .upsert(payload, { onConflict: 'anio' });
    setSaving(false);
    if (error) {
      toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Criterios guardados', description: `Criterios del año ${current.anio} actualizados.` });
      fetchAll();
    }
  };

  const handleDuplicate = () => {
    const src = rows[0];
    if (!src) return;
    setCurrent({ ...src, anio: selectedYear, notas: `Duplicado de ${src.anio}` });
    toast({ title: 'Copiado', description: `Se han cargado los criterios de ${src.anio}. Revisa y guarda.` });
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Solo administradores pueden editar los criterios del Plan de Acción Anual.
        </CardContent>
      </Card>
    );
  }

  if (loading || !current) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
        </CardContent>
      </Card>
    );
  }

  const isNew = !yearsWithData.has(current.anio);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              Criterios del Plan de Acción Anual
            </CardTitle>
            <CardDescription>
              Cada año se guarda de forma independiente. Los años pasados quedan congelados para preservar la trazabilidad de auditoría.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm">Año</Label>
            <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v, 10))}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)}>
                    {y} {yearsWithData.has(y) ? '' : '(nuevo)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isNew && rows.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Plus className="w-4 h-4 mr-1" />
                Copiar del último
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isNew && (
          <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-800">
            Este año todavía no tiene criterios guardados. Se está mostrando la plantilla por defecto. Ajusta y pulsa <strong>Guardar</strong>.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Km mínimos por red (Registro)</Label>
            <Input
              type="number"
              min={0}
              value={current.registro_km_minimo}
              onChange={(e) => setCurrent({ ...current, registro_km_minimo: parseInt(e.target.value || '0', 10) })}
            />
            <p className="text-xs text-muted-foreground">Km acumulados requeridos por tipo de red al año.</p>
          </div>

          <div className="space-y-2">
            <Label>Acompañamientos por red</Label>
            <Input
              type="number"
              min={0}
              value={current.acompanamientos_por_red}
              onChange={(e) => setCurrent({ ...current, acompanamientos_por_red: parseInt(e.target.value || '0', 10) })}
            />
            <p className="text-xs text-muted-foreground">Nº mínimo por red y maquinista.</p>
          </div>

          <div className="space-y-2">
            <Label>Acompañamientos si PE 12.01 reciente</Label>
            <Input
              type="number"
              min={0}
              value={current.acompanamientos_con_1201}
              onChange={(e) => setCurrent({ ...current, acompanamientos_con_1201: parseInt(e.target.value || '0', 10) })}
            />
            <p className="text-xs text-muted-foreground">Aplica si tuvo un PE 12.01 en la ventana indicada.</p>
          </div>

          <div className="space-y-2">
            <Label>Controles de alcohol al año</Label>
            <Input
              type="number"
              min={0}
              value={current.alcohol_anual}
              onChange={(e) => setCurrent({ ...current, alcohol_anual: parseInt(e.target.value || '0', 10) })}
            />
          </div>

          <div className="space-y-2">
            <Label>Cobertura mínima de drogas (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={current.drogas_cobertura_pct}
              onChange={(e) => setCurrent({ ...current, drogas_cobertura_pct: parseInt(e.target.value || '0', 10) })}
            />
            <p className="text-xs text-muted-foreground">% de la plantilla activa por base con un control anual.</p>
          </div>

          <div className="space-y-2">
            <Label>Vigencia PE 12.01 reciente (años)</Label>
            <Input
              type="number"
              min={0}
              value={current.vigencia_1201_anios}
              onChange={(e) => setCurrent({ ...current, vigencia_1201_anios: parseInt(e.target.value || '0', 10) })}
            />
            <p className="text-xs text-muted-foreground">Ventana hacia atrás que considera "PE 12.01 reciente".</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Notas (opcional)</Label>
          <Textarea
            value={current.notas || ''}
            onChange={(e) => setCurrent({ ...current, notas: e.target.value })}
            placeholder="Motivo del cambio, referencia normativa, etc."
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar criterios {current.anio}
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium mb-2">Histórico</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2">Año</th>
                    <th className="text-right p-2">Km Reg.</th>
                    <th className="text-right p-2">Acomp/red</th>
                    <th className="text-right p-2">Acomp+1201</th>
                    <th className="text-right p-2">Alcohol</th>
                    <th className="text-right p-2">% Drogas</th>
                    <th className="text-right p-2">Vig. 1201</th>
                    <th className="text-left p-2">Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.anio} className="border-b last:border-0">
                      <td className="p-2 font-mono font-semibold">{r.anio}</td>
                      <td className="p-2 text-right">{r.registro_km_minimo}</td>
                      <td className="p-2 text-right">{r.acompanamientos_por_red}</td>
                      <td className="p-2 text-right">{r.acompanamientos_con_1201}</td>
                      <td className="p-2 text-right">{r.alcohol_anual}</td>
                      <td className="p-2 text-right">{r.drogas_cobertura_pct}%</td>
                      <td className="p-2 text-right">{r.vigencia_1201_anios}a</td>
                      <td className="p-2 text-muted-foreground truncate max-w-[200px]">{r.notas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
