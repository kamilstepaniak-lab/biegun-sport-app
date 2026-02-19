import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Sidebar, Header, type SidebarItem } from '@/components/shared';
import { ChildUrlSync } from '@/components/parent/child-url-sync';
import { getUserProfile } from '@/lib/actions/auth';

const parentNavItems: SidebarItem[] = [
  {
    title: 'Moje dzieci',
    href: '/parent/children',
    icon: 'Users',
  },
  {
    title: 'Wyjazdy',
    href: '/parent/trips',
    icon: 'MapPin',
  },
  {
    title: 'Kalendarz',
    href: '/parent/calendar',
    icon: 'CalendarDays',
  },
  {
    title: 'Płatności',
    href: '/parent/payments',
    icon: 'CreditCard',
  },
  {
    title: 'Umowy',
    href: '/parent/contracts',
    icon: 'FileText',
  },
  {
    title: 'Profil',
    href: '/parent/profile',
    icon: 'User',
  },
];

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Admini mają swój panel — nie mają dostępu do panelu rodzica
  if (profile.role === 'admin') {
    redirect('/admin/groups');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
      <Sidebar
        items={parentNavItems}
        title="BiegunSport"
        subtitle="Panel rodzica"
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={profile} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {/* Synchronizuje ?child= w URL z localStorage — działa w tle */}
          <Suspense fallback={null}>
            <ChildUrlSync />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
