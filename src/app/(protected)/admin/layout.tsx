import { redirect } from 'next/navigation';

import { Sidebar, Header, type SidebarItem } from '@/components/shared';
import { getUserProfile } from '@/lib/actions/auth';

const adminNavItems: SidebarItem[] = [
  {
    title: 'Grupy',
    href: '/admin/groups',
    icon: 'Users',
  },
  {
    title: 'Wyjazdy',
    href: '/admin/trips',
    icon: 'MapPin',
  },
  {
    title: 'Kalendarz',
    href: '/admin/calendar',
    icon: 'CalendarDays',
  },
  {
    title: 'Płatności',
    href: '/admin/payments',
    icon: 'CreditCard',
  },
  {
    title: 'Ustawienia',
    href: '/admin/settings/custom-fields',
    icon: 'Settings',
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  if (profile.role !== 'admin') {
    redirect('/parent/children');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f9fb]">
      <Sidebar
        items={adminNavItems}
        title="BiegunSport"
        subtitle="Panel admina"
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={profile} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
