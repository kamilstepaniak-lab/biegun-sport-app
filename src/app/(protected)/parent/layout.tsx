import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { Sidebar, Header, type SidebarItem } from '@/components/shared';
import { ChildUrlSync } from '@/components/parent/child-url-sync';
import { getUserProfile } from '@/lib/actions/auth';
import { getMessagesForParent } from '@/lib/actions/messages';

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
    title: 'Dokumenty',
    href: '/parent/contracts',
    icon: 'FileText',
  },
  {
    title: 'Wiadomości',
    href: '/parent/messages',
    icon: 'MessageSquare',
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

  const messages = await getMessagesForParent();
  const unreadCount = messages.filter((m) => !m.is_read).length;

  const navItems: SidebarItem[] = parentNavItems.map((item) =>
    item.href === '/parent/messages' && unreadCount > 0
      ? { ...item, badge: unreadCount }
      : item,
  );

  return (
    <div className="admin-shell flex h-screen overflow-hidden bg-[#f8fafc]">
      <Sidebar
        items={navItems}
        title="BiegunSport"
        subtitle="Panel rodzica"
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header user={profile} />
        <main className="admin-main flex-1 overflow-y-auto overflow-x-hidden safe-bottom">
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
