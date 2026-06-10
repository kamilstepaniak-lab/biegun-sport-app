'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Check, Users } from 'lucide-react';
import { useCallback } from 'react';

import { GroupIcon } from '@/lib/group-icons';
import { getGroupColor } from '@/lib/group-colors';
import { cn } from '@/lib/utils';

export interface ParentChildOption {
  id: string;
  name: string;
  groupName?: string | null;
}

interface ParentChildSelectorProps {
  selectedChildId?: string;
  selectedChildName?: string;
  childrenList: ParentChildOption[];
  showAllOption?: boolean;
  variant?: 'default' | 'compact';
}

const ALL_CHILDREN_ID = 'all';
const ALL_CHILDREN_NAME = 'Wszystkie dzieci';

export function ParentChildSelector({
  selectedChildId,
  selectedChildName,
  childrenList,
  showAllOption = true,
  variant = 'default',
}: ParentChildSelectorProps) {
  const pathname = usePathname();
  const router = useRouter();

  const navigateTo = useCallback((child: ParentChildOption | { id: typeof ALL_CHILDREN_ID; name: string }) => {
    if (child.id === ALL_CHILDREN_ID) {
      router.push(`${pathname}?child=${ALL_CHILDREN_ID}`);
    } else {
      router.push(`${pathname}?child=${child.id}&childName=${encodeURIComponent(child.name)}`);
    }
  }, [pathname, router]);

  const hasAllSelected = selectedChildId === ALL_CHILDREN_ID || !selectedChildId;
  const selectedName = selectedChildName || childrenList.find((child) => child.id === selectedChildId)?.name;
  const isCompact = variant === 'compact';
  const buttonClassName = cn(
    'flex shrink-0 items-center rounded-[10px] border text-left text-sm font-bold transition-colors',
    // Mobile zawsze kompaktowo (chipy mieszczą się bez przewijania),
    // wariant default rośnie dopiero od sm
    isCompact ? 'h-10 gap-2 px-2.5' : 'h-10 gap-2 px-2.5 sm:h-12 sm:gap-2.5 sm:px-3',
  );
  const avatarClassName = isCompact ? 'h-6 w-6' : 'h-6 w-6 sm:h-8 sm:w-8';
  const iconClassName = isCompact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4';
  const checkClassName = isCompact ? 'h-4 w-4' : 'h-4 w-4 sm:h-5 sm:w-5';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-normal text-blue-700">
        <Users className="h-3.5 w-3.5" />
        Wybierz dziecko
      </div>
      {/* Mobile: chipy zawijają się do kolejnej linii (zero przewijania w bok);
          od sm jeden rząd z przewijaniem jak dotąd */}
      <div className="flex flex-wrap gap-2 pb-1 sm:flex-nowrap sm:gap-2.5 sm:overflow-x-auto">
        {showAllOption && (
          <button
            type="button"
            onClick={() => navigateTo({ id: ALL_CHILDREN_ID, name: ALL_CHILDREN_NAME })}
            className={cn(
              buttonClassName,
              hasAllSelected
                ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50',
            )}
          >
            <span className={cn('flex items-center justify-center rounded-full bg-blue-100 text-blue-600', avatarClassName)}>
              <Users className={iconClassName} />
            </span>
            {/* Mobile: krótka etykieta — chipy mają się mieścić bez przewijania */}
            <span className="whitespace-nowrap sm:hidden">Wszystkie</span>
            <span className="hidden whitespace-nowrap sm:inline">Wszystkie dzieci</span>
          </button>
        )}

        {childrenList.map((child) => {
          const isSelected = child.id === selectedChildId || (!selectedChildId && child.name === selectedName);
          const colors = getGroupColor(child.groupName ?? '');
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => navigateTo(child)}
              className={cn(
                buttonClassName,
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50',
              )}
            >
              {isSelected && (
                <span className={cn('hidden items-center justify-center rounded-full bg-blue-600 text-white sm:flex', checkClassName)}>
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              )}
              <span className={cn('flex items-center justify-center rounded-full text-white', avatarClassName, colors.dot)}>
                <GroupIcon name={child.groupName ?? ''} className={iconClassName} />
              </span>
              {/* Mobile: samo imię (zaznaczenie widać po tle/ramce) */}
              <span className="whitespace-nowrap sm:hidden">{child.name.split(' ')[0]}</span>
              <span className="hidden whitespace-nowrap sm:inline">{child.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
