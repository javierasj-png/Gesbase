import { EstadoCertificacionMaquinista, EstadoBloque1603, EstadoCelda1201 } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  estado: EstadoCertificacionMaquinista | EstadoBloque1603 | EstadoCelda1201 | string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

const statusConfig: Record<string, { class: string; dotColor: string }> = {
  // Estados de certificación (nuevo sistema)
  'Vigente': { class: 'status-ok', dotColor: 'bg-status-ok' },
  'Próxima a vencer': { class: 'status-proximo', dotColor: 'bg-status-proximo' },
  'Vencida': { class: 'status-vencido', dotColor: 'bg-status-vencido' },
  'No aplica': { class: 'status-no-procede', dotColor: 'bg-status-no-procede' },
  
  // Legacy (para compatibilidad)
  'OK': { class: 'status-ok', dotColor: 'bg-status-ok' },
  'Próximo': { class: 'status-proximo', dotColor: 'bg-status-proximo' },
  'Vencido': { class: 'status-vencido', dotColor: 'bg-status-vencido' },
  'Sin evidencia': { class: 'status-sin-evidencia', dotColor: 'bg-status-sin-evidencia' },
  
  // Bloques 16.03
  'Pendiente': { class: 'status-pendiente', dotColor: 'bg-status-pendiente' },
  'En ventana': { class: 'status-proximo', dotColor: 'bg-status-proximo' },
  'Cumplida': { class: 'status-cumplida', dotColor: 'bg-status-cumplida' },
  
  // Celdas 12.01
  'No planificar': { class: 'status-no-procede', dotColor: 'bg-status-no-procede' },
  
  // Estados de expediente
  'Activo': { class: 'status-ok', dotColor: 'bg-status-ok' },
  'Cerrado': { class: 'status-sin-evidencia', dotColor: 'bg-status-sin-evidencia' },
  'Abierta': { class: 'status-proximo', dotColor: 'bg-status-proximo' },
  'Cerrada': { class: 'status-cumplida', dotColor: 'bg-status-cumplida' },
};

export function StatusBadge({ estado, size = 'md', showDot = true }: StatusBadgeProps) {
  const config = statusConfig[estado] || statusConfig['Sin evidencia'];
  
  return (
    <span className={cn(
      'status-badge',
      config.class,
      size === 'sm' && 'text-[10px] px-2 py-0.5'
    )}>
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} />
      )}
      {estado}
    </span>
  );
}
