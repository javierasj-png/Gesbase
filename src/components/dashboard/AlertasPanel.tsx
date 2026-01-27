import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { 
  AlertTriangle, 
  Train, 
  FileCheck, 
  AlertCircle,
  Loader2,
  Bell,
  ChevronRight
} from 'lucide-react';
import { useDashboardAlertas, Alerta } from '@/hooks/useDashboardAlertas';
import { format } from 'date-fns';

interface AlertasPanelProps {
  baseFilter?: string;
  maxItems?: number;
}

function getAlertaIcon(alerta: Alerta) {
  switch (alerta.tipo) {
    case 'certificacion':
      return <Train className="w-4 h-4" />;
    case 'pe1603':
      return <FileCheck className="w-4 h-4" />;
    case 'pe1201':
      return <AlertCircle className="w-4 h-4" />;
  }
}

function getAlertaBadgeVariant(alerta: Alerta): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (alerta.estado === 'Vencida') return 'destructive';
  return 'secondary';
}

function getAlertaLabel(alerta: Alerta): string {
  switch (alerta.tipo) {
    case 'certificacion':
      return `Cert. ${alerta.certificacion_tipo}`;
    case 'pe1603':
      return 'PE 16.03';
    case 'pe1201':
      return 'PE 12.01';
  }
}

function getAlertaDescription(alerta: Alerta): string {
  switch (alerta.tipo) {
    case 'certificacion':
      return alerta.certificacion_nombre;
    case 'pe1603':
      return `${alerta.tipo_actuacion}: ${alerta.etiqueta}`;
    case 'pe1201':
      return alerta.hito;
  }
}

function getDiasText(alerta: Alerta): string {
  const dias = alerta.dias_restantes;
  if (dias === null) return 'Sin registro';
  if (dias < 0) return `${Math.abs(dias)}d vencido`;
  if (dias === 0) return 'Hoy';
  return `${dias}d`;
}

export function AlertasPanel({ baseFilter, maxItems = 10 }: AlertasPanelProps) {
  const navigate = useNavigate();
  const { alertas, loading, kpis } = useDashboardAlertas(baseFilter);

  const alertasMostradas = alertas.slice(0, maxItems);

  const handleAlertaClick = (alerta: Alerta) => {
    switch (alerta.tipo) {
      case 'certificacion':
        navigate(`/maquinistas/${alerta.maquinista_id}?tab=certificaciones`);
        break;
      case 'pe1603':
        navigate(`/maquinistas/${alerta.maquinista_id}?tab=pe1603`);
        break;
      case 'pe1201':
        navigate(`/maquinistas/${alerta.maquinista_id}?tab=pe1201`);
        break;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-destructive" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-destructive" />
            Alertas
            {kpis.totalAlertas > 0 && (
              <Badge variant="destructive" className="ml-2">
                {kpis.totalAlertas}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {kpis.certificaciones > 0 && (
              <Badge variant="outline" className="gap-1">
                <Train className="w-3 h-3" />
                {kpis.certificaciones}
              </Badge>
            )}
            {kpis.pe1603 > 0 && (
              <Badge variant="outline" className="gap-1">
                <FileCheck className="w-3 h-3" />
                {kpis.pe1603}
              </Badge>
            )}
            {kpis.pe1201 > 0 && (
              <Badge variant="outline" className="gap-1">
                <AlertCircle className="w-3 h-3" />
                {kpis.pe1201}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alertasMostradas.length > 0 ? (
          <div className="space-y-2">
            {alertasMostradas.map((alerta, idx) => (
              <div
                key={`${alerta.tipo}-${alerta.id}-${idx}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
                onClick={() => handleAlertaClick(alerta)}
              >
                {/* Icono */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  alerta.estado === 'Vencida' 
                    ? 'bg-status-vencido-bg text-status-vencido' 
                    : 'bg-status-proximo-bg text-status-proximo'
                }`}>
                  {getAlertaIcon(alerta)}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">
                      {alerta.maquinista_nombre}
                    </p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {getAlertaLabel(alerta)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {getAlertaDescription(alerta)}
                  </p>
                </div>

                {/* Estado y días */}
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      alerta.estado === 'Vencida' ? 'text-status-vencido' : 'text-status-proximo'
                    }`}>
                      {getDiasText(alerta)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}

            {alertas.length > maxItems && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                +{alertas.length - maxItems} alertas más
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No hay alertas pendientes
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
