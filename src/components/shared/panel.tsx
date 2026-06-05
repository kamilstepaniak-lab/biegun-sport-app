import type { ComponentType, ReactNode } from 'react';
import { Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type IconComponent = ComponentType<{ className?: string }>;

const toneClasses = {
  blue: {
    box: 'bg-blue-600 text-white',
    soft: 'bg-blue-50 text-blue-700 ring-blue-200',
    text: 'text-blue-700',
  },
  slate: {
    box: 'bg-slate-100 text-slate-600',
    soft: 'bg-slate-50 text-slate-700 ring-slate-200',
    text: 'text-slate-700',
  },
  emerald: {
    box: 'bg-emerald-100 text-emerald-700',
    soft: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    text: 'text-emerald-700',
  },
  amber: {
    box: 'bg-amber-100 text-amber-700',
    soft: 'bg-amber-50 text-amber-700 ring-amber-200',
    text: 'text-amber-700',
  },
  red: {
    box: 'bg-red-100 text-red-700',
    soft: 'bg-red-50 text-red-700 ring-red-200',
    text: 'text-red-700',
  },
};

type Tone = keyof typeof toneClasses;

export function PanelCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200', className)}>
      {children}
    </section>
  );
}

export function PanelIcon({
  icon: Icon,
  tone = 'blue',
  className,
}: {
  icon: IconComponent;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneClasses[tone].box, className)}>
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function SectionTitle({
  icon,
  title,
  description,
  tone = 'blue',
  action,
  className,
}: {
  icon: IconComponent;
  title: string;
  description?: ReactNode;
  tone?: Tone;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        <PanelIcon icon={icon} tone={tone} />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  description,
  tone = 'blue',
  className,
}: {
  icon: IconComponent;
  label: string;
  value: ReactNode;
  description?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <PanelCard className={cn('p-4', className)}>
      <div className="flex items-center gap-3">
        <PanelIcon icon={icon} tone={tone} className="h-10 w-10" />
        <div className="min-w-0">
          <p className={cn('text-2xl font-bold leading-none tabular-nums', toneClasses[tone].text)}>
            {value}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
      </div>
    </PanelCard>
  );
}

export function CopyIconButton({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('rounded-lg bg-white text-slate-400 hover:text-blue-600', className)}
    >
      <Copy className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export function AdminTableShell({
  children,
  minWidth = '1180px',
  className,
}: {
  children: ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <PanelCard className={cn('overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <div style={{ minWidth }}>{children}</div>
      </div>
    </PanelCard>
  );
}
