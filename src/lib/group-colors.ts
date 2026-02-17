// Mapowanie nazw grup na kolory - stonowana paleta
export const groupColors: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  beeski: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    dot: 'bg-amber-400',
    border: 'border-amber-300',
  },
  prokids: {
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    dot: 'bg-violet-400',
    border: 'border-violet-300',
  },
  semipro: {
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    dot: 'bg-teal-400',
    border: 'border-teal-300',
  },
  hero: {
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    border: 'border-slate-300',
  },
  pro: {
    bg: 'bg-zinc-100',
    text: 'text-zinc-700',
    dot: 'bg-zinc-500',
    border: 'border-zinc-400',
  },
};

// Domyślny kolor dla nieznanych grup
export const defaultGroupColor = {
  bg: 'bg-gray-50',
  text: 'text-gray-500',
  dot: 'bg-gray-300',
  border: 'border-gray-200',
};

// Funkcja do pobierania koloru grupy
export function getGroupColor(groupName: string) {
  const normalized = groupName.toLowerCase().replace(/\s+/g, '');
  return groupColors[normalized] || defaultGroupColor;
}

// Lista wszystkich grup z ich kolorami (do legendy)
export const groupColorsList = [
  { name: 'Beeski', color: groupColors.beeski },
  { name: 'ProKids', color: groupColors.prokids },
  { name: 'SemiPRO', color: groupColors.semipro },
  { name: 'Hero', color: groupColors.hero },
  { name: 'Pro', color: groupColors.pro },
];
