'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Calendar, ChevronRight, Mail, Phone, Search, X, Eye, Plus, Users } from 'lucide-react';

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

  const groupedParticipants = useMemo(() => {
    const groupsByLetter = new Map<string, ParticipantFull[]>();
    filtered.forEach((participant) => {
      const letter = participant.last_name.charAt(0).toUpperCase();
      const bucket = groupsByLetter.get(letter) ?? [];
      bucket.push(participant);
      groupsByLetter.set(letter, bucket);
    });
    return Array.from(groupsByLetter.entries()).sort(([a], [b]) => a.localeCompare(b, 'pl'));
  }, [filtered]);

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
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-white ring-1 ring-gray-200 border-0 text-base md:text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
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
            className="h-11 px-3 rounded-xl bg-white ring-1 ring-gray-200 border-0 text-base md:text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
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

      {/* Lista */}
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
        <div className="space-y-6">
          {groupedParticipants.map(([letter, letterParticipants]) => (
            <div key={letter} className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">
                  {letter}
                </div>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  {letterParticipants.length}
                </span>
              </div>

              <div className="grid gap-3">
                {letterParticipants.map((p) => {
                  const colors = p.group ? getGroupColor(p.group.name) : null;
                  return (
                    <div
                      key={p.id}
                      className="group overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-lg"
                    >
                      <div className="grid gap-4 p-4 lg:grid-cols-[1.25fr_1fr_auto] lg:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-600">
                            {p.first_name.charAt(0)}
                            {p.last_name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/participants/${p.id}`}
                              className="text-base font-semibold text-slate-900 hover:text-blue-600"
                            >
                              {p.last_name} {p.first_name}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                {format(new Date(p.birth_date), 'dd.MM.yyyy')}
                              </span>
                              {p.group && colors ? (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
                                    colors.bg,
                                    colors.text,
                                    colors.border
                                  )}
                                >
                                  <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                                  {p.group.name}
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-400">
                                  Bez grupy
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid min-w-0 gap-2 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                            <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">{p.parent?.email ?? '—'}</span>
                          </div>
                          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="truncate">{p.parent?.phone ?? '—'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 lg:justify-end">
                          <div className="max-w-[280px] truncate text-xs text-slate-500">
                            {p.notes?.trim() ? (
                              <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700 ring-1 ring-amber-200">
                                {p.notes}
                              </span>
                            ) : (
                              <span className="text-slate-300">Brak notatki</span>
                            )}
                          </div>
                        <Link
                          href={`/admin/participants/${p.id}`}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Szczegóły
                            <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
