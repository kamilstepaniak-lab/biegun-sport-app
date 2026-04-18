'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ChildOption {
  id: string;
  name: string;
}

interface ChildGuardProps {
  /** ID wybranego dziecka lub 'all' — przekazywane z searchParams po stronie serwera */
  selectedChildId?: string;
  /** Nazwa dziecka do wyświetlenia w bannerze (opcjonalna) */
  selectedChildName?: string;
  /** Lista wszystkich dzieci rodzica — do wyboru dziecka */
  childrenList?: ChildOption[];
  children: React.ReactNode;
}

const STORAGE_KEY = 'biegun_selected_child';
const ALL_CHILDREN_ID = 'all';
const ALL_CHILDREN_NAME = 'Wszystkie dzieci';

export function ChildGuard({ selectedChildId, selectedChildName, childrenList, children }: ChildGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);

  const isAll = selectedChildId === ALL_CHILDREN_ID;

  // Memoizowane — pozwala uniknąć re-kalkulacji przy re-renderach layoutu
  const { isValidChild, effectiveChildId } = useMemo(() => {
    const valid = !selectedChildId || isAll || !childrenList || childrenList.some(c => c.id === selectedChildId);
    return {
      isValidChild: valid,
      effectiveChildId: valid ? selectedChildId : undefined,
    };
  }, [selectedChildId, isAll, childrenList]);

  // Scalona logika: walidacja + localStorage sync + default redirect w jednym efekcie
  useEffect(() => {
    // 1. Nieprawidłowe dziecko w URL — wyczyść i przekieruj
    if (selectedChildId && !isValidChild) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('selectedChild');
      router.replace(`${pathname}?child=${ALL_CHILDREN_ID}`);
      return;
    }

    // 2. Prawidłowe dziecko — zapisz do localStorage
    if (selectedChildId && isValidChild) {
      const name = isAll ? ALL_CHILDREN_NAME : (selectedChildName ?? '');
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: selectedChildId, name }));
      } catch {}
      return;
    }

    // 3. Brak dziecka w URL — spróbuj przywrócić z localStorage, inaczej "wszystkie"
    if (!effectiveChildId && childrenList && childrenList.length > 0) {
      let targetParams = `?child=${ALL_CHILDREN_ID}`;
      const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        try {
          const { id, name } = JSON.parse(stored);
          if (id === ALL_CHILDREN_ID) {
            targetParams = `?child=${ALL_CHILDREN_ID}`;
          } else if (childrenList.some(c => c.id === id)) {
            targetParams = `?child=${id}&childName=${encodeURIComponent(name)}`;
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      setRedirecting(true);
      router.replace(`${pathname}${targetParams}`);
    }
  }, [selectedChildId, selectedChildName, isAll, isValidChild, effectiveChildId, pathname, router, childrenList]);

  const navigateTo = useCallback((child: ChildOption | { id: typeof ALL_CHILDREN_ID; name: string }) => {
    if (child.id === ALL_CHILDREN_ID) {
      router.push(`${pathname}?child=${ALL_CHILDREN_ID}`);
    } else {
      router.push(`${pathname}?child=${child.id}&childName=${encodeURIComponent(child.name)}`);
    }
  }, [router, pathname]);

  if (!effectiveChildId) {
    if (redirecting) {
      return <div className="h-32" />;
    }
    return (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-12 flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Users className="h-8 w-8 text-gray-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Wybierz dziecko</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Aby zobaczyć tę sekcję, najpierw wybierz dziecko.
          </p>
        </div>
        {childrenList && childrenList.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => navigateTo({ id: ALL_CHILDREN_ID, name: ALL_CHILDREN_NAME })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Users className="h-4 w-4" />
              Wszystkie dzieci
            </button>
            {childrenList.map(child => (
              <button
                key={child.id}
                onClick={() => navigateTo(child)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors"
              >
                <span className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                  {child.name.charAt(0)}
                </span>
                {child.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-500">
              Nie masz jeszcze żadnego dziecka w systemie.<br />Dodaj dziecko, aby korzystać z tej sekcji.
            </p>
            <Link
              href="/parent/children/add"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Users className="h-4 w-4" />
              Dodaj dziecko
            </Link>
          </div>
        )}
      </div>
    );
  }

  const displayName = isAll ? ALL_CHILDREN_NAME : (selectedChildName || childrenList?.find(c => c.id === effectiveChildId)?.name || 'Wybrane dziecko');

  return (
    <div className="space-y-5">
      {/* Banner z wyborem dziecka */}
      <div className="bg-blue-600 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {isAll ? <Users className="h-4 w-4" /> : displayName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-blue-100">
              {isAll ? 'Widok zbiorczy' : 'Przeglądasz dane dla'}
            </p>
            <p className="text-sm font-semibold text-white truncate">{displayName}</p>
          </div>
        </div>

        {/* Przyciski wyboru dziecka */}
        {childrenList && childrenList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => navigateTo({ id: ALL_CHILDREN_ID, name: ALL_CHILDREN_NAME })}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                isAll
                  ? 'bg-white text-blue-700'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              )}
            >
              <Users className="h-3 w-3" />
              Wszystkie
            </button>
            {childrenList.map(child => (
              <button
                key={child.id}
                onClick={() => navigateTo(child)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  child.id === effectiveChildId
                    ? 'bg-white text-blue-700'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                )}
              >
                <span className="w-4 h-4 rounded bg-current/20 flex items-center justify-center text-[9px] font-bold opacity-80">
                  {child.name.charAt(0)}
                </span>
                {child.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
