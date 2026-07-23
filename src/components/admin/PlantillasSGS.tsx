import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileCheck, 
  AlertTriangle,
  Clock,
  Calendar,
  ClipboardList
} from 'lucide-react';
import { plantilla1603Mock, catalogoHitos1201Mock } from '@/data/mockData';
import { useYearFilter } from '@/hooks/useYearFilter';
import { useCriteriosPlanAnual } from '@/hooks/useCriteriosPlanAnual';

export function PlantillasSGS() {
  const [yearFilter] = useYearFilter();
  const { criterios, loading } = useCriteriosPlanAnual(yearFilter);

  const tiposActuacion = ['Acompañamiento', 'Registro', 'Alcohol', 'Drogas'] as const;
  
  return (
    <div className="space-y-6">
      {/* Plan de Acción Anual */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            <CardTitle>Plan de Acción Anual</CardTitle>
            <Badge variant="secondary" className="ml-2">Año {yearFilter}</Badge>
          </div>
          <CardDescription>
            Criterios individuales de vigilancia guardados para el año {yearFilter}. Editables en la pestaña <strong>Criterios Plan Anual</strong>.
            Las actuaciones de PE 16.03 computan automáticamente. Las redes se configuran por base de conducción.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando criterios…</p>
          ) : (
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Registro</Badge>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="font-medium text-sm">Análisis de Registro por Red</p>
                <p className="text-xs text-muted-foreground mt-1">
                  1 registro por cada tipo de red (Convencional / AV) con un mínimo de <strong>{criterios.registro_km_minimo} km</strong> recorridos.
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Acompañamiento</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg border">
                  <p className="font-medium text-sm">Acompañamiento por Red</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>{criterios.acompanamientos_por_red}</strong> acompañamiento{criterios.acompanamientos_por_red === 1 ? '' : 's'} por tipo de red al año.
                  </p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="font-medium text-sm">Con PE 12.01 reciente</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <strong>{criterios.acompanamientos_con_1201}</strong> acompañamientos por red si el maquinista ha tenido un expediente PE 12.01 en los últimos <strong>{criterios.vigencia_1201_anios}</strong> años.
                  </p>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Alcohol</Badge>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="font-medium text-sm">Control Anual</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <strong>{criterios.alcohol_anual}</strong> control{criterios.alcohol_anual === 1 ? '' : 'es'} de alcohol al año por maquinista.
                </p>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline">Drogas</Badge>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="font-medium text-sm">Cobertura de Base ({criterios.drogas_cobertura_pct}%)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Al menos el <strong>{criterios.drogas_cobertura_pct}%</strong> de la plantilla activa de cada base debe tener un control de drogas al año.
                </p>
              </div>
            </div>

            {criterios.notas && (
              <div className="p-3 bg-muted/30 border rounded-lg">
                <p className="text-xs text-muted-foreground"><strong>Notas del año:</strong> {criterios.notas}</p>
              </div>
            )}
          </div>
          )}

          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm">
              <strong>Nota:</strong> Las actuaciones registradas en PE 16.03 computan automáticamente en el Plan Anual.
              Las redes (Convencional / AV) se configuran en la ficha de cada base de conducción.

            </p>
          </div>
        </CardContent>
      </Card>

      {/* PE 16.03 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-primary" />
            <CardTitle>Plantilla PE 16.03 - Nuevo Acceso</CardTitle>
          </div>
          <CardDescription>
            Plan de vigilancia de 3 años desde el primer servicio en la dependencia.
            Estas ventanas se generan automáticamente al dar de alta un maquinista con "Bajo PE 16.03" activo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tiposActuacion.map(tipo => {
              const bloques = plantilla1603Mock.filter(p => p.tipo === tipo);
              return (
                <div key={tipo} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">{tipo}</Badge>
                    <span className="text-sm text-muted-foreground">
                      ({bloques.length} {bloques.length === 1 ? 'bloque' : 'bloques'})
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {bloques.map(bloque => (
                      <div key={bloque.id} className="p-3 bg-muted/50 rounded-lg border">
                        <p className="font-medium text-sm">{bloque.etiqueta}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>Día {bloque.offsetInicioDias}</span>
                          <span>→</span>
                          <span>Día {bloque.offsetFinDias}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Duración: {bloque.offsetFinDias - bloque.offsetInicioDias + 1} días
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* PE 12.01 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <CardTitle>Catálogo Hitos PE 12.01 - Factor Humano</CardTitle>
          </div>
          <CardDescription>
            Hitos de seguimiento tras un suceso (día 1, 7, 23, 30, 40 desde primer servicio). 
            Se generan automáticamente al crear el expediente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['Acompañamientos', 'Registros'].map(bloque => {
              const hitos = catalogoHitos1201Mock.filter(h => h.bloque === bloque);
              return (
                <div key={bloque} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline">{bloque}</Badge>
                    <span className="text-sm text-muted-foreground">
                      ({hitos.length} hitos obligatorios)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {hitos.map(hito => (
                      <div key={hito.id} className="p-3 bg-muted/50 rounded-lg border text-center">
                        <p className="font-medium text-sm">{hito.etiqueta}</p>
                        <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>Día exacto</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Nota:</strong> La ficha PE 12.01 tiene un período de vigilancia de 40 días desde el primer servicio tras el suceso.
              El cierre manual está disponible según criterio del mando (PREVER).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
