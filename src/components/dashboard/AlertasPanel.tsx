import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Train, 
  FileCheck, 
  AlertCircle,
  Loader2,
  Bell,
  ChevronRight,
  Clock,
  Calendar,
  CalendarDays,
  Download,
  Eye,
} from 'lucide-react';
import { useDashboardAlertas, Alerta, GrupoAlerta } from '@/hooks/useDashboardAlertas';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
    case 'seg_especial':
      return <Eye className="w-4 h-4" />;
  }
}

function getAlertaLabel(alerta: Alerta): string {
  switch (alerta.tipo) {
    case 'certificacion':
      return `Cert. ${alerta.certificacion_tipo}`;
    case 'pe1603':
      return 'PE 16.03';
    case 'pe1201':
      return 'PE 12.01';
    case 'seg_especial':
      return 'Seg. Especial';
  }
}

const segTipoLabel: Record<string, string> = {
  acompanamiento: 'Acompañamiento',
  registro: 'Análisis de registro',
  formativa: 'Acción formativa',
};

function getAlertaDescription(alerta: Alerta): string {
  switch (alerta.tipo) {
    case 'certificacion':
      return alerta.certificacion_nombre;
    case 'pe1603':
      return `${alerta.tipo_actuacion}: ${alerta.etiqueta}`;
    case 'pe1201':
      return alerta.hito;
    case 'seg_especial':
      return segTipoLabel[alerta.tipo_actuacion] || alerta.tipo_actuacion;
  }
}

function getDiasText(alerta: Alerta): string {
  const dias = alerta.dias_restantes;
  if (dias === null) return 'Sin registro';
  if (dias < 0) return `${Math.abs(dias)}d vencido`;
  if (dias === 0) return 'Hoy';
  return `${dias}d`;
}

function getGrupoIcon(grupo: GrupoAlerta) {
  switch (grupo) {
    case 'vencidas':
      return <AlertTriangle className="w-4 h-4" />;
    case 'proximas_3_meses':
      return <Clock className="w-4 h-4" />;
    case 'resto_anio':
      return <CalendarDays className="w-4 h-4" />;
  }
}

function getGrupoLabel(grupo: GrupoAlerta): string {
  switch (grupo) {
    case 'vencidas':
      return 'Vencidas';
    case 'proximas_3_meses':
      return 'Próximas 3 meses';
    case 'resto_anio':
      return 'Resto del año';
  }
}

function getGrupoStyles(grupo: GrupoAlerta) {
  switch (grupo) {
    case 'vencidas':
      return {
        badge: 'bg-destructive text-destructive-foreground',
        iconBg: 'bg-status-vencido-bg text-status-vencido',
        text: 'text-status-vencido',
      };
    case 'proximas_3_meses':
      return {
        badge: 'bg-status-proximo text-white',
        iconBg: 'bg-status-proximo-bg text-status-proximo',
        text: 'text-status-proximo',
      };
    case 'resto_anio':
      return {
        badge: 'bg-muted text-muted-foreground',
        iconBg: 'bg-muted text-muted-foreground',
        text: 'text-muted-foreground',
      };
  }
}

interface AlertaItemProps {
  alerta: Alerta;
  onClick: () => void;
}

function AlertaItem({ alerta, onClick }: AlertaItemProps) {
  const styles = getGrupoStyles(alerta.grupo);
  
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer group"
      onClick={onClick}
    >
      {/* Icono */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${styles.iconBg}`}>
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
          <p className={`text-sm font-medium ${styles.text}`}>
            {getDiasText(alerta)}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}

interface AlertasGrupoProps {
  grupo: GrupoAlerta;
  alertas: Alerta[];
  onAlertaClick: (alerta: Alerta) => void;
  onExport: (grupo: GrupoAlerta, alertas: Alerta[]) => void;
  maxItems?: number;
}

function AlertasGrupo({ grupo, alertas, onAlertaClick, onExport, maxItems = 5 }: AlertasGrupoProps) {
  const styles = getGrupoStyles(grupo);
  const alertasMostradas = alertas.slice(0, maxItems);
  const hayMas = alertas.length > maxItems;

  if (alertas.length === 0) return null;

  return (
    <AccordionItem value={grupo} className="border-b-0">
      <div className="flex items-center">
        <AccordionTrigger className="py-2 hover:no-underline flex-1">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded flex items-center justify-center ${styles.iconBg}`}>
              {getGrupoIcon(grupo)}
            </div>
            <span className="font-medium text-sm">{getGrupoLabel(grupo)}</span>
            <Badge className={`ml-1 ${styles.badge}`}>
              {alertas.length}
            </Badge>
          </div>
        </AccordionTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={(e) => { e.stopPropagation(); onExport(grupo, alertas); }}
          title={`Exportar ${getGrupoLabel(grupo)}`}
        >
          <Download className="w-3.5 h-3.5" />
        </Button>
      </div>
      <AccordionContent className="pb-2">
        <div className="space-y-2">
          {alertasMostradas.map((alerta, idx) => (
            <AlertaItem
              key={`${alerta.tipo}-${alerta.id}-${idx}`}
              alerta={alerta}
              onClick={() => onAlertaClick(alerta)}
            />
          ))}
          {hayMas && (
            <p className="text-xs text-center text-muted-foreground pt-1">
              +{alertas.length - maxItems} más
            </p>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function AlertasPanel({ baseFilter, maxItems = 5 }: AlertasPanelProps) {
  const navigate = useNavigate();
  const { alertasVencidas, alertasProximas3Meses, alertasRestoAnio, loading, kpis } = useDashboardAlertas(baseFilter);

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
      case 'seg_especial':
        navigate(`/maquinistas/${alerta.maquinista_id}?tab=seguimiento-especial`);
        break;
    }
  };

  const handleExport = (grupo: GrupoAlerta, alertas: Alerta[]) => {
    const header = 'Maquinista;Base;Tipo;Descripción;Días;Estado';
    const rows = alertas.map(a => {
      const desc = a.tipo === 'certificacion' ? a.certificacion_nombre
        : a.tipo === 'pe1603' ? `${a.tipo_actuacion}: ${a.etiqueta}`
        : a.tipo === 'pe1201' ? a.hito
        : (segTipoLabel[a.tipo_actuacion] || a.tipo_actuacion);
      const dias = a.dias_restantes === null ? 'Sin registro'
        : a.dias_restantes < 0 ? `${Math.abs(a.dias_restantes)}d vencido`
        : `${a.dias_restantes}d`;
      const label = a.tipo === 'certificacion' ? `Cert. ${a.certificacion_tipo}`
        : a.tipo === 'pe1603' ? 'PE 16.03'
        : a.tipo === 'pe1201' ? 'PE 12.01'
        : 'Seg. Especial';
      return `${a.maquinista_nombre};${a.maquinista_base};${label};${desc};${dias};${getGrupoLabel(grupo)}`;
    });
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alertas_${grupo}_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  const tieneAlertas = kpis.totalAlertas > 0;

  // Determinar qué grupos abrir por defecto
  const defaultOpen: string[] = [];
  if (alertasVencidas.length > 0) defaultOpen.push('vencidas');
  if (alertasProximas3Meses.length > 0) defaultOpen.push('proximas_3_meses');

  return (
    <Card className={tieneAlertas ? 'border-destructive/20' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4 text-destructive" />
            Alertas
            {tieneAlertas && (
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
        {tieneAlertas ? (
          <Accordion type="multiple" defaultValue={defaultOpen} className="w-full">
            <AlertasGrupo 
              grupo="vencidas" 
              alertas={alertasVencidas} 
              onAlertaClick={handleAlertaClick}
              onExport={handleExport}
              maxItems={maxItems}
            />
            <AlertasGrupo 
              grupo="proximas_3_meses" 
              alertas={alertasProximas3Meses} 
              onAlertaClick={handleAlertaClick}
              onExport={handleExport}
              maxItems={maxItems}
            />
            <AlertasGrupo 
              grupo="resto_anio" 
              alertas={alertasRestoAnio} 
              onAlertaClick={handleAlertaClick}
              onExport={handleExport}
              maxItems={maxItems}
            />
          </Accordion>
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
