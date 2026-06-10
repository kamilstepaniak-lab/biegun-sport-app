'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  LayoutDashboard,
  Users,
  UsersRound,
  CreditCard,
  MapPin,
  User,
  Settings,
  Bell,
  UserCog,
  Upload,
  CalendarDays,
  FileText,
  BarChart2,
  Mail,
  ClipboardList,
  MessageSquare,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  UsersRound,
  CreditCard,
  MapPin,
  User,
  Settings,
  Bell,
  UserCog,
  Upload,
  CalendarDays,
  FileText,
  BarChart2,
  Mail,
  ClipboardList,
  MessageSquare,
};

export interface SidebarItem {
  title: string;
  href: string;
  icon: string;
  badge?: string | number;
  /** Pokazuj w dolnym pasku nawigacji na mobile (max 4 pozycje). */
  mobile?: boolean;
}

interface SidebarProps {
  items: SidebarItem[];
  title: string;
  subtitle?: string;
}

function NavItem({ item, isActive, isCollapsed, onClick }: { item: SidebarItem; isActive: boolean; isCollapsed?: boolean; onClick?: () => void }) {
  const Icon = iconMap[item.icon] || LayoutDashboard;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'group relative flex select-none items-center gap-3 rounded-xl py-2 pr-3 text-sm font-semibold transition-all duration-200',
        isCollapsed ? 'justify-center px-1.5' : 'pl-3',
        isActive
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100'
      )}
      title={isCollapsed ? item.title : undefined}
    >
      {/* Lewy pasek aktywności */}
      {isActive && !isCollapsed && (
        <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-blue-600" />
      )}
      {/* Kafelek ikony */}
      <span className={cn(
        'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
        isActive
          ? 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-100'
          : 'bg-slate-50 text-slate-400 ring-1 ring-slate-100 group-hover:text-slate-600'
      )}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      {!isCollapsed && (
        <>
          <span className="truncate">{item.title}</span>
          {item.badge ? (
            <span className={cn(
              'ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-semibold',
              isActive ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'
            )}>
              {item.badge}
            </span>
          ) : !isActive ? (
            <ChevronRight className="ml-auto h-4 w-4 flex-shrink-0 text-slate-300 transition-colors group-hover:text-slate-400" />
          ) : null}
        </>
      )}
    </Link>
  );
}

export function Sidebar({ items, title, subtitle }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Ujednolicony styl sidebara dla panelu admina i rodzica
  const isAdmin = true;

  // Aktywny jest tylko najbardziej szczegółowy pasujący element —
  // dzięki temu /admin/settings/email-templates nie podświetla też /admin/settings.
  const activeHref = items
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    .reduce<string | null>(
      (best, item) => (best === null || item.href.length > best.length ? item.href : best),
      null,
    );

  const renderLogo = (collapsed?: boolean) => (
    collapsed ? (
      <div className="flex justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden flex-shrink-0">
          <Image src="/logo.png" alt="BSAPP" width={40} height={40} className="object-cover rounded-xl" priority />
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden flex-shrink-0">
          <Image src="/logo.png" alt="BSAPP" width={40} height={40} className="object-cover rounded-xl" priority />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>
      </div>
    )
  );

  const mobileItems = items.filter((item) => item.mobile).slice(0, 4);

  return (
    <>
      {/* Mobile: pełne menu w drawerze (otwierane z dolnego paska) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="p-0 w-72 bg-white border-r border-gray-100"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Menu nawigacyjne</SheetTitle>
          <div className="flex flex-col h-full">
            <div className="px-5 pt-6 pb-4 border-b border-gray-50">
              {renderLogo()}
            </div>
            <ScrollArea className="flex-1 px-3 py-3">
              <nav className="space-y-1">
                {items.map((item) => {
                  const isActive = item.href === activeHref;
                  return <NavItem key={item.href} item={item} isActive={isActive} onClick={() => setSheetOpen(false)} />;
                })}
              </nav>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside
        data-admin={isAdmin ? 'true' : undefined}
        className={cn(
          'app-sidebar hidden md:flex flex-col bg-white border-r border-gray-100 transition-all duration-300 relative',
          isCollapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        {/* Logo area */}
        <div className={cn(
          'border-b border-gray-50 flex items-center',
          isCollapsed ? 'px-3 py-5 justify-center' : 'px-4 py-5'
        )}>
          {renderLogo(isCollapsed)}
        </div>

        {/* Nav items */}
        <ScrollArea className="flex-1 px-3 py-3">
          <nav className="space-y-1">
            {items.map((item) => {
              const isActive = item.href === activeHref;
              return <NavItem key={item.href} item={item} isActive={isActive} isCollapsed={isCollapsed} />;
            })}
          </nav>
        </ScrollArea>

        {/* Collapse arrow — floating on right edge */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-400 shadow-sm transition-all duration-200"
          title={isCollapsed ? 'Rozwiń' : 'Zwiń'}
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Mobile: dolny pasek nawigacji (jak w natywnych aplikacjach) */}
      <nav
        aria-label="Nawigacja dolna"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 select-none border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-white/90"
      >
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length + 1}, 1fr)` }}
        >
          {mobileItems.map((item) => (
            <BottomNavItem
              key={item.href}
              item={item}
              isActive={item.href === activeHref}
            />
          ))}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex flex-col items-center gap-0.5 pb-1.5 pt-2 text-slate-500 transition-opacity active:opacity-60"
            aria-label="Otwórz pełne menu"
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-full">
              <Menu className="h-[21px] w-[21px]" strokeWidth={2} />
            </span>
            <span className="text-[10px] font-semibold leading-none">Menu</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function BottomNavItem({ item, isActive }: { item: SidebarItem; isActive: boolean }) {
  const Icon = iconMap[item.icon] || LayoutDashboard;

  return (
    <Link
      href={item.href}
      className={cn(
        'flex flex-col items-center gap-0.5 pb-1.5 pt-2 transition-opacity active:opacity-60',
        isActive ? 'text-blue-700' : 'text-slate-500'
      )}
      aria-current={isActive ? 'page' : undefined}
    >
      <span
        className={cn(
          'relative flex h-7 w-12 items-center justify-center rounded-full transition-colors',
          isActive && 'bg-blue-100/80'
        )}
      >
        <Icon className="h-[21px] w-[21px]" strokeWidth={isActive ? 2.4 : 2} />
        {item.badge ? (
          <span className="absolute -top-1 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {item.badge}
          </span>
        ) : null}
      </span>
      <span className="text-[10px] font-semibold leading-none">{item.title}</span>
    </Link>
  );
}
