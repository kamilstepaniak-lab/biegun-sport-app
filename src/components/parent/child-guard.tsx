'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Users, X, ChevronDown, Check } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ChildOption {
  id: string;
  name: string;
}

interface ChildGuardProps {
  /** ID wybranego dziecka lub 'all' — przekazywane z searchParams po stronie serwera */
  selectedChildId?: string;
  /** Nazwa dziecka do wyświetlenia w bannerze (opcjonalna) */
  selectedChildName?: string;
  /** Lista wszystkich dzieci rodzica — do dropdownu zmiany dziecka */
  childrenList?: ChildOption[];
  children: React.ReactNode;
}

const STORAGE_KEY = 'selectedChild';
const ALL_CHILDREN_ID = 'all';
const ALL_CHILDREN_NAME = 'Wszystkie dzieci';

export function ChildGuard({ selectedChildId, selectedChildName, childrenList, children }: ChildGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAll = selectedChildId === ALL_CHILDREN_ID;

  // Zamknij dropdown po kliknięciu poza nim
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Zapisz wybrane dziecko do localStorage
  useEffect(() => {
    if (selectedChildId) {
      const name = isAll ? ALL_CHILDREN_NAME : (selectedChildName ?? '');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: selectedChildId, name }));
    }
  }, [selectedChildId, selectedChildName, isAll]);

  // Jeśli brak dziecka w URL — domyślnie idź na "Wszystkie dzieci"
  useEffect(() => {
    if (!selectedChildId && childrenList && childrenList.length > 0) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const { id, name } = JSON.parse(stored);
          if (id === ALL_CHILDREN_ID || childrenList.some(c => c.id === id)) {
            setRedirecting(true);
            const params = id === ALL_CHILDREN_ID
              ? `?child=${ALL_CHILDREN_ID}`
              : `?child=${id}&childName=${encodeURIComponent(name)}`;
            router.replace(`${pathname}${params}`);
            return;
          }
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      // Brak w localStorage — domyślnie "Wszystkie dzieci"
      setRedirecting(true);
      router.replace(`${pathname}?child=${ALL_CHILDREN_ID}`);
    }
  }, [selectedChildId, pathname, router, childrenList]);

  function handleSelectChild(child: ChildOption | { id: typeof ALL_CHILDREN_ID; name: string }) {
    setDropdownOpen(false);
    if (child.id === ALL_CHILDREN_ID) {
      router.push(`${pathname}?child=${ALL_CHILDREN_ID}`);
    } else {
      router.push(`${pathname}?child=${child.id}&childName=${encodeURIComponent(child.name)}`);
    }
  }

  if (!selectedChildId) {
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
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(v => !v)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Users className="h-4 w-4" />
              Wybierz dziecko
              <ChevronDown className="h-4 w-4" />
            </button>
            {dropdownOpen && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg ring-1 ring-gray-200 py-1 min-w-[200px] z-50">
                {/* Opcja "Wszystkie dzieci" */}
                <button
                  onClick={() => handleSelectChild({ id: ALL_CHILDREN_ID, name: ALL_CHILDREN_NAME })}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 border-b border-gray-100"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Users className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                  <span className="font-medium text-blue-700">Wszystkie dzieci</span>
                </button>
                {childrenList.map(child => (
                  <button
                    key={child.id}
                    onClick={() => handleSelectChild(child)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                      {child.name.charAt(0)}
                    </div>
                    {child.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/parent/children"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Users className="h-4 w-4" />
            Przejdź do Moje dzieci
          </Link>
        )}
      </div>
    );
  }

  const displayName = isAll ? ALL_CHILDREN_NAME : (selectedChildName || 'Wybrane dziecko');

  return (
    <div className="space-y-5">
      {/* Banner wybranego dziecka */}
      <div className="bg-blue-600 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold text-sm">
            {isAll ? <Users className="h-4 w-4" /> : displayName.charAt(0)}
          </div>
          <div>
            <p className="text-xs text-blue-100">
              {isAll ? 'Widok zbiorczy' : 'Przeglądasz dane dla'}
            </p>
            <p className="text-sm font-semibold text-white">{displayName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Dropdown zmiany dziecka */}
          {childrenList && childrenList.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
              >
                Zmień
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full mt-2 right-0 bg-white rounded-xl shadow-lg ring-1 ring-gray-200 py-1 min-w-[200px] z-50">
                  {/* Opcja "Wszystkie dzieci" */}
                  <button
                    onClick={() => handleSelectChild({ id: ALL_CHILDREN_ID, name: ALL_CHILDREN_NAME })}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 border-b border-gray-100"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Users className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="flex-1 font-medium text-blue-700">Wszystkie dzieci</span>
                    {isAll && <Check className="h-3.5 w-3.5 text-gray-900 flex-shrink-0" />}
                  </button>
                  {childrenList.map(child => (
                    <button
                      key={child.id}
                      onClick={() => handleSelectChild(child)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                        {child.name.charAt(0)}
                      </div>
                      <span className="flex-1">{child.name}</span>
                      {child.id === selectedChildId && (
                        <Check className="h-3.5 w-3.5 text-gray-900 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Link "X" wraca do "Wszystkie dzieci" zamiast czyścić URL */}
          <button
            onClick={() => router.push(`${pathname}?child=${ALL_CHILDREN_ID}`)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            title="Pokaż wszystkie dzieci"
          >
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
