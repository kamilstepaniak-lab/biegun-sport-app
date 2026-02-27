export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Settings, UserPlus, Mail, ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, EmptyState } from '@/components/shared';
import { ParentAccountsManager } from '../parent-accounts-manager';
import { SyncJwtRolesButton } from '../sync-jwt-roles';

export default async function CustomFieldsSettingsPage() {
  // TODO: Pobierz definicje pól
  const customFields: unknown[] = [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ustawienia"
        description="Konfiguracja systemu"
      />

      {/* Szablony e-maili */}
      <Link href="/admin/settings/email-templates">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle>Szablony e-maili</CardTitle>
                  <CardDescription>
                    Edytuj treść automatycznych wiadomości wysyłanych do rodziców
                  </CardDescription>
                </div>
              </div>
              <span className="text-xs text-blue-600 font-medium">Edytuj →</span>
            </div>
          </CardHeader>
        </Card>
      </Link>

      {/* Konta rodziców */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <UserPlus className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <CardTitle>Konta rodziców</CardTitle>
              <CardDescription>
                Utwórz konta logowania dla rodziców z domyślnym hasłem
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ParentAccountsManager />
        </CardContent>
      </Card>

      {/* Synchronizacja ról JWT */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <ShieldCheck className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <CardTitle>Synchronizacja ról JWT</CardTitle>
              <CardDescription>
                Zapisuje rolę każdego użytkownika w tokenie JWT — przyspiesza działanie aplikacji (brak zapytania do bazy przy każdej nawigacji). Uruchom raz po wdrożeniu lub gdy zmienisz rolę komuś ręcznie.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SyncJwtRolesButton />
        </CardContent>
      </Card>

      {/* Dodatkowe pola */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <Settings className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <CardTitle>Dodatkowe pola</CardTitle>
              <CardDescription>
                Skonfiguruj dodatkowe pola, które będą zbierane dla każdego uczestnika
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {customFields.length === 0 ? (
            <EmptyState
              icon={Settings}
              title="Brak dodatkowych pól"
              description="Nie skonfigurowano jeszcze żadnych dodatkowych pól."
            />
          ) : (
            <div>
              {/* Lista pól */}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
