import { Suspense } from 'react';
import { redirect } from 'next/navigation';

import { Sidebar, Header, type SidebarItem } from '@/components/shared';
import { getUserProfile } from '@/lib/actions/auth';
import { countPendingRegistrationRequests } from '@/lib/actions/trip-registration-requests';

function buildNavItems(pendingRegistrations: number): SidebarItem[] {
  return [
    { title: 'Uczestnicy', href: '/admin/participants', icon: 'Users' },
    { title: 'Grupy', href: '/admin/groups', icon: 'UsersRound' },
    { title: 'Wyjazdy', href: '/admin/trips', icon: 'MapPin' },
    {
      title: 'Zgłoszenia',
      href: '/admin/registrations',
      icon: 'ClipboardList',
      badge: pendingRegistrations > 0 ? pendingRegistrations : undefined,
    },
    { title: 'Kalendarz', href: '/admin/calendar', icon: 'CalendarDays' },
    { title: 'Płatności', href: '/admin/payments', icon: 'CreditCard' },
    { title: 'Finanse', href: '/admin/finance', icon: 'BarChart2' },
    { title: 'Dokumenty', href: '/admin/contracts', icon: 'FileText' },
    { title: 'E-maile', href: '/admin/settings/email-templates', icon: 'Mail' },
    { title: 'Wiadomości', href: '/admin/messages', icon: 'MessageSquare' },
    { title: 'Ustawienia', href: '/admin/settings', icon: 'Settings' },
  ];
}

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

  const pendingRegistrations = await countPendingRegistrationRequests();
  const adminNavItems = buildNavItems(pendingRegistrations);

  return (
    <div className="admin-shell flex h-screen overflow-hidden bg-[#f8fafc]">
      <Sidebar
        items={adminNavItems}
        title="BiegunSport"
        subtitle="Panel admina"
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={profile} />
        <main className="admin-main flex-1 overflow-y-auto overflow-x-hidden safe-bottom">
          <Suspense fallback={<div className="h-32" />}>
            {children}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
