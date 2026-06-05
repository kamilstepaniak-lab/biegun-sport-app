import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div className={cn('page-header flex flex-col gap-4 md:flex-row md:items-center md:justify-between', className)}>
      <div className="page-header-copy">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm mt-0.5 max-w-xl text-justify">{description}</p>
        )}
      </div>
      {children && <div className="page-header-actions flex items-center gap-2">{children}</div>}
    </div>
  );
}
