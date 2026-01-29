import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileCheck, 
  AlertTriangle,
  Clock,
  Calendar
} from 'lucide-react';
import { plantilla1603Mock, catalogoHitos1201Mock } from '@/data/mockData';

export function PlantillasSGS() {
  // Agrupar plantilla 1603 por tipo
  const tiposActuacion = ['Acompañamiento', 'Registro', 'Alcohol', 'Drogas'] as const;
  
  return (
    <div className="space-y-6">
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
                      <div 
                        key={bloque.id} 
                        className="p-3 bg-muted/50 rounded-lg border"
                      >
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
            Se generan automáticamente al crear el expediente. El resto de la programación es ad-hoc según criterio del mando.
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
                      <div 
                        key={hito.id} 
                        className="p-3 bg-muted/50 rounded-lg border text-center"
                      >
                        <p className="font-medium text-sm">{hito.etiqueta}</p>
                        <div className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>±2 días</span>
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
              Cada hito tiene una ventana de cumplimiento de ±2 días. El cierre manual está disponible según criterio del mando (PREVER).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
