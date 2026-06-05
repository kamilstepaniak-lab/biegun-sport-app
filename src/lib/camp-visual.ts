import { Mountain, Sun, Users, type LucideIcon } from 'lucide-react';
import type { TripCategory } from '@/types/database';

// Ikona + kolory apli przy tytule wyjazdu wg typu obozu.
// Zimowy: niebieskie góry. Letni: żółte słoneczko. Rodzinny: niebiescy ludzik.
export function getCampVisual(category: TripCategory | null | undefined): {
  Icon: LucideIcon;
  iconBox: string;
} {
  switch (category) {
    case 'summer_camp':
      return { Icon: Sun, iconBox: 'bg-amber-100 text-amber-500' };
    case 'family_camp':
      return { Icon: Users, iconBox: 'bg-blue-50 text-blue-600' };
    case 'winter_camp':
    default:
      return { Icon: Mountain, iconBox: 'bg-blue-50 text-blue-600' };
  }
}
