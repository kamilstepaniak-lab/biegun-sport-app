'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Search, X, Eye, Plus, Users } from 'lucide-react';

import { getGroupColor } from '@/lib/group-colors';
import { cn } from '@/lib/utils';
import type { ParticipantFull, Group } from '@/types';
import { AddExternalChildDialog } from './add-external-child-dialog';

interface ParticipantsListProps {
  participants: ParticipantFull[];
  groups: Group[];
}

const NO_GROUP = '__none__';

export function ParticipantsList({ participants, groups }: ParticipantsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const filtered = useMemo(() => {
    let list = [...participants];

    if (groupFilter !== 'all') {
      list = list.filter((p) => {
        if (groupFilter === NO_GROUP) return !p.group;
        return p.group?.id === groupFilter;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const fullName = `${p.last_name} ${p.first_name}`.toLowerCase();
        const fullNameReversed = `${p.first_name} ${p.last_name}`.toLowerCase();
        const parentName = `${p.parent?.last_name ?? ''} ${p.parent?.first_name ?? ''}`.toLowerCase();
        const email = (p.parent?.email ?? '').toLowerCase();
        return (
          fullName.includes(q) ||
          fullNameReversed.includes(q) ||
          parentName.includes(q) ||
          email.includes(q)
        );
      });
    }

    list.sort((a, b) => a.last_name.localeCompare(b.last_name, 'pl'));
    return list;
  }, [participants, searchQuery, groupFilter]);

  return (
    <div className="space-y-4">
      {/* Pasek akcji */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          {/* Wyszukiwarka */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              placeholder="Szukaj po nazwisku, imieniu, rodzicu lub emailu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-10 rounded-xl bg-white ring-1 ring-gray-200 border-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtr po grupie */}
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="h-10 px-3 rounded-xl bg-white ring-1 ring-gray-200 border-0 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
          >
            <option value="all">Wszystkie grupy</option>
            <option value={NO_GROUP}>Bez grupy (z zewnątrz)</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          Dodaj dziecko z zewnątrz
        </button>
      </div>

      {/* Licznik */}
      <p className="text-sm text-gray-500">
        {filtered.length === participants.length
          ? `${participants.length} ${pluralize(participants.length, 'uczestnik', 'uczestników', 'uczestników')}`
          : `Znaleziono ${filtered.length} z ${participants.length}`}
      </p>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl ring-1 ring-gray-100 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 mx-auto mb-4">
            <Users className="h-7 w-7 text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">
            {searchQuery || groupFilter !== 'all'
              ? 'Brak uczestników pasujących do filtrów'
              : 'Brak uczestników w systemie'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50/30">
                    Nazwisko i imię
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50/30">
                    Data ur.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50/30">
                    Grupa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50/30">
                    Rodzic
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-50/30">
                    Email
                  </th>
                  <th className="px-4 py-3 bg-gray-50/30 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((p) => {
                  const colors = p.group ? getGroupColor(p.group.name) : null;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/participants/${p.id}`}
                          className="font-medium text-gray-900 text-sm hover:text-primary hover:underline"
                        >
                          {p.last_name} {p.first_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {format(new Date(p.birth_date), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        {p.group && colors ? (
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border whitespace-nowrap',
                              colors.bg,
                              colors.text,
                              colors.border
                            )}
                          >
                            {p.group.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">— Brak —</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {p.parent ? `${p.parent.first_name ?? ''} ${p.parent.last_name ?? ''}`.trim() || '—' : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[240px]">
                        {p.parent?.email ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/participants/${p.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg ring-1 ring-gray-200 transition-colors whitespace-nowrap"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Szczegóły
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddExternalChildDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        groups={groups}
      />
    </div>
  );
}

function pluralize(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return many;
  if (last >= 2 && last <= 4) return few;
  return many;
}
