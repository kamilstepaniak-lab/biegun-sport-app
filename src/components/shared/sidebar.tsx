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
}

interface SidebarProps {
  items: SidebarItem[];
  title: string;
  subtitle?: string;
}

function NavItem({ item, isActive, isCollapsed }: { item: SidebarItem; isActive: boolean; isCollapsed?: boolean }) {
  const Icon = iconMap[item.icon] || LayoutDashboard;

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isCollapsed ? 'justify-center px-2' : '',
        isActive
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
      )}
      title={isCollapsed ? item.title : undefined}
    >
      <Icon className={cn(
        'h-4 w-4 flex-shrink-0 transition-colors',
        isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
      )} />
      {!isCollapsed && (
        <>
          <span className="truncate">{item.title}</span>
          {item.badge && (
            <span className={cn(
              'ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full text-xs font-semibold px-1.5',
              isActive ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-600'
            )}>
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

  const LogoBlock = ({ collapsed }: { collapsed?: boolean }) => (
    collapsed ? (
      <div className="flex justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm">
          BS
        </div>
      </div>
    ) : (
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm flex-shrink-0">
          BS
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
        </div>
      </div>
    )
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <button className="md:hidden fixed top-4 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-md border border-gray-100 text-gray-500 hover:text-gray-800 transition-colors">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-white border-r border-gray-100">
          <div className="flex flex-col h-full">
            <div className="px-5 pt-6 pb-4 border-b border-gray-50">
              <LogoBlock />
            </div>
            <ScrollArea className="flex-1 px-3 py-3">
              <nav className="space-y-0.5">
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
          'hidden md:flex flex-col bg-white border-r border-gray-100 transition-all duration-300',
          isCollapsed ? 'w-[68px]' : 'w-60'
        )}
      >
        {/* Logo area */}
        <div className={cn(
          'border-b border-gray-50 flex items-center',
          isCollapsed ? 'px-3 py-5 justify-center' : 'px-4 py-5'
        )}>
          <LogoBlock collapsed={isCollapsed} />
        </div>

        {/* Nav items */}
        <ScrollArea className="flex-1 px-3 py-3">
          <nav className="space-y-0.5">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return <NavItem key={item.href} item={item} isActive={isActive} isCollapsed={isCollapsed} />;
            })}
          </nav>
        </ScrollArea>

        {/* Collapse toggle */}
        <div className="px-3 pb-4 border-t border-gray-50 pt-3">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all duration-200"
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
