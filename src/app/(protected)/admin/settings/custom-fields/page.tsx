export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Settings, UserPlus, Mail } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, EmptyState } from '@/components/shared';
import { ParentAccountsManager } from '../parent-accounts-manager';
import { getCustomFieldDefinitions } from '@/lib/actions/participants';

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Tekst',
  number: 'Liczba',
  date: 'Data',
  boolean: 'Tak/Nie',
  select: 'Wybór',
};

export default async function CustomFieldsSettingsPage() {
  const customFields = await getCustomFieldDefinitions();

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
                  <Mail className="h-4 w-4 text-blue-600" />
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
            <div className="divide-y">
              {customFields.map((field) => (
                <div key={field.id} className="flex items-center justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{field.field_label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{field.field_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}
                    </Badge>
                    {field.is_required && (
                      <Badge variant="destructive" className="text-xs">
                        Wymagane
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
