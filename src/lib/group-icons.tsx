import type { SVGProps } from 'react';
import { Rocket, Flame, BicepsFlexed } from 'lucide-react';

import { cn } from '@/lib/utils';
import { getGroupColor } from '@/lib/group-colors';

type IconProps = SVGProps<SVGSVGElement>;

// Pszczółka (Beeski) — własna ikona w stylu lucide (stroke, viewBox 24)
function Bee({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M9 4.5 7.5 3M15 4.5 16.5 3" />
      <ellipse cx="12" cy="14" rx="4" ry="5.5" />
      <path d="M8 12.5h8M8.2 16h7.6" />
      <path d="M8 11.5C5.2 10.4 3.4 11.6 4 14c.5 1.9 2.8 1.8 4 .3" />
      <path d="M16 11.5c2.8-1.1 4.6.1 4 2.5-.5 1.9-2.8 1.8-4 .3" />
    </svg>
  );
}

// Dwie pionowe narty (SemiPRO) — własna ikona w stylu lucide
function Skis({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M8 4.5v14.8c0 1.4-1.3 2.2-2.5 1.4" />
      <path d="M16 4.5v14.8c0 1.4 1.3 2.2 2.5 1.4" />
      <path d="M6.8 8.5h2.4" />
      <path d="M14.8 8.5h2.4" />
      <path d="M7 13h2" />
      <path d="M15 13h2" />
    </svg>
  );
}

// Ikona grupy — mapowanie po nazwie. Switch zamiast dynamicznego komponentu,
// żeby komponent był statyczny (wymóg react-hooks/static-components).
export function GroupIcon({ name, className }: { name: string; className?: string }) {
  const normalized = name.toLowerCase().replace(/\s+/g, '');
  switch (normalized) {
    case 'beeski':
      return <Bee className={className} />;
    case 'prokids':
      return <Rocket className={className} strokeWidth={2.5} />;
    case 'semipro':
      return <Skis className={className} />;
    case 'hero':
      return <BicepsFlexed className={className} strokeWidth={2.5} />;
    case 'pro':
      return <Flame className={className} strokeWidth={2.5} />;
    default:
      return <Rocket className={className} strokeWidth={2.5} />;
  }
}

// Powiększona kropka z ikonką grupy + nazwa — używana na niebieskim tle
// w rozwiniętym wyjeździe (panel rodzica i admina).
export function GroupBadge({ name, className }: { name: string; className?: string }) {
  const colors = getGroupColor(name);
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-semibold text-white', className)}>
      <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-white', colors.dot)}>
        <GroupIcon name={name} className="h-3 w-3" />
      </span>
      {name}
    </span>
  );
}
