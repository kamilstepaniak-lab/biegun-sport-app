// Mapowanie nazw grup na kolory — Beeski=żółty, ProKids=czerwony, SemiPRO=niebieski, Hero=ciemny szary, Pro=błękitny
export const groupColors: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  beeski: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-400',
    border: 'border-amber-300',
  },
  prokids: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    dot: 'bg-red-400',
    border: 'border-red-200',
  },
  semipro: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
  },
  hero: {
    bg: 'bg-gray-700',
    text: 'text-white',
    dot: 'bg-gray-400',
    border: 'border-gray-700',
  },
  pro: {
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    dot: 'bg-sky-400',
    border: 'border-sky-200',
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
