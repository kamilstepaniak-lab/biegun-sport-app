'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, User, Settings, ChevronDown, Search } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { logout } from '@/lib/actions/auth';
import type { Profile } from '@/types';

interface HeaderProps {
  user: Profile;
}

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const initials = user.first_name && user.last_name
    ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
    : user.email[0].toUpperCase();

  const displayName = user.first_name && user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.email;

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  }

  const profileHref = user.role === 'admin' ? '/admin/settings' : '/parent/profile';

  return (
    <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-gray-200/60 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-4 md:hidden">
        {/* Space for mobile menu button */}
        <div className="w-10" />
      </div>

      {/* Search bar area (left side on desktop) */}
      <div className="hidden md:flex items-center flex-1">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Szukaj..."
            className="w-full h-9 pl-9 pr-4 rounded-xl bg-gray-100/80 border-0 text-sm text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-all"
          />
        </div>
      </div>

      {/* Right side - User menu */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-gray-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-white text-xs font-semibold">
                {initials}
              </div>
              <span className="hidden sm:inline-block text-sm font-medium text-gray-700">
                {displayName}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg ring-1 ring-gray-200/60 border-0 p-1">
            <DropdownMenuLabel className="px-3 py-2">
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuItem asChild className="rounded-lg px-3 py-2 cursor-pointer">
              <Link href={profileHref}>
                <User className="mr-2.5 h-4 w-4 text-gray-500" />
                <span className="text-sm">Profil</span>
              </Link>
            </DropdownMenuItem>
            {user.role === 'admin' && (
              <DropdownMenuItem asChild className="rounded-lg px-3 py-2 cursor-pointer">
                <Link href="/admin/settings/custom-fields">
                  <Settings className="mr-2.5 h-4 w-4 text-gray-500" />
                  <span className="text-sm">Ustawienia</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-gray-100" />
            <DropdownMenuItem
              className="rounded-lg px-3 py-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="mr-2.5 h-4 w-4" />
              <span className="text-sm">{isLoggingOut ? 'Wylogowywanie...' : 'Wyloguj się'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
