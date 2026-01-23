import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  variant?: 'default' | 'warning' | 'danger' | 'success';
  onClick?: () => void;
}

const variantStyles = {
  default: 'border-l-4 border-l-primary',
  warning: 'border-l-4 border-l-status-proximo',
  danger: 'border-l-4 border-l-status-vencido',
  success: 'border-l-4 border-l-status-ok',
};

export function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant = 'default',
  onClick 
}: KPICardProps) {
  return (
    <div 
      className={cn(
        'kpi-card',
        variantStyles[variant],
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="kpi-label">{title}</p>
          <p className={cn(
            'kpi-value',
            variant === 'danger' && 'text-status-vencido',
            variant === 'warning' && 'text-status-proximo',
            variant === 'success' && 'text-status-ok',
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'p-2 rounded-lg',
            variant === 'default' && 'bg-primary/10 text-primary',
            variant === 'warning' && 'bg-status-proximo-bg text-status-proximo',
            variant === 'danger' && 'bg-status-vencido-bg text-status-vencido',
            variant === 'success' && 'bg-status-ok-bg text-status-ok',
          )}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
