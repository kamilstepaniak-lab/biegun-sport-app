'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  Menu,
  LayoutDashboard,
  Users,
  CreditCard,
  MapPin,
  User,
  Settings,
  Bell,
  UserCog,
  Upload,
  CalendarDays,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  CreditCard,
  MapPin,
  User,
  Settings,
  Bell,
  UserCog,
  Upload,
  CalendarDays,
};

// Map icons to background colors for the modern icon badges
const iconColorMap: Record<string, string> = {
  LayoutDashboard: 'bg-blue-100 text-blue-600',
  Users: 'bg-violet-100 text-violet-600',
  CreditCard: 'bg-emerald-100 text-emerald-600',
  MapPin: 'bg-orange-100 text-orange-600',
  User: 'bg-sky-100 text-sky-600',
  Settings: 'bg-gray-200 text-gray-600',
  Bell: 'bg-amber-100 text-amber-600',
  UserCog: 'bg-pink-100 text-pink-600',
  Upload: 'bg-teal-100 text-teal-600',
  CalendarDays: 'bg-indigo-100 text-indigo-600',
};

export interface SidebarItem {
  title: string;
  href: string;
  icon: string;
  badge?: string | number;
}

interface SidebarProps {
  items: SidebarItem[];
  title: string;
  subtitle?: string;
}

function NavItem({ item, isActive, isCollapsed }: { item: SidebarItem; isActive: boolean; isCollapsed?: boolean }) {
  const Icon = iconMap[item.icon] || LayoutDashboard;
  const iconColor = iconColorMap[item.icon] || 'bg-gray-100 text-gray-600';

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isCollapsed ? 'justify-center px-2' : '',
        isActive
          ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/60'
          : 'text-gray-500 hover:bg-white/60 hover:text-gray-900'
      )}
      title={isCollapsed ? item.title : undefined}
    >
      <div className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 transition-all duration-200',
        isActive ? iconColor : 'bg-gray-100/80 text-gray-400 group-hover:text-gray-600'
      )}>
        <Icon className="h-4 w-4" />
      </div>
      {!isCollapsed && (
        <>
          <span className="truncate">{item.title}</span>
          {item.badge && (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-semibold px-1.5">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export function Sidebar({ items, title, subtitle }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <button className="md:hidden fixed top-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md ring-1 ring-gray-200/60 text-gray-600 hover:text-gray-900 transition-colors">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-[#f8f9fb] border-r-0">
          <div className="flex flex-col h-full">
            <div className="px-5 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white font-bold text-sm">
                  BS
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{title}</h2>
                  {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                </div>
              </div>
            </div>
            <ScrollArea className="flex-1 px-3 pb-4">
              <nav className="space-y-1">
                {items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                  return <NavItem key={item.href} item={item} isActive={isActive} />;
                })}
              </nav>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col bg-[#f8f9fb] transition-all duration-300 border-r border-gray-200/60',
          isCollapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        {/* Logo area */}
        <div className={cn('px-4 pt-5 pb-4', isCollapsed && 'px-3')}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white font-bold text-sm flex-shrink-0">
                BS
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
                {subtitle && <p className="text-xs text-gray-500 truncate">{subtitle}</p>}
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white font-bold text-sm">
                BS
              </div>
            </div>
          )}
        </div>

        {/* Nav items */}
        <ScrollArea className="flex-1 px-3">
          <nav className="space-y-1">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return <NavItem key={item.href} item={item} isActive={isActive} isCollapsed={isCollapsed} />;
            })}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className="p-3 mt-auto">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm text-gray-400 hover:bg-white/60 hover:text-gray-600 transition-all duration-200"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Zwiń</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
