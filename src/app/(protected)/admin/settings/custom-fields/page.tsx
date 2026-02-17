import { Settings } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, EmptyState } from '@/components/shared';

export default async function CustomFieldsSettingsPage() {
  // TODO: Pobierz definicje pól
  const customFields: unknown[] = [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ustawienia"
        description="Konfiguracja dodatkowych pól dla uczestników"
      />

      <Card>
        <CardHeader>
          <CardTitle>Dodatkowe pola</CardTitle>
          <CardDescription>
            Skonfiguruj dodatkowe pola, które będą zbierane dla każdego uczestnika
          </CardDescription>
        </CardHeader>
        <CardContent>
          {customFields.length === 0 ? (
            <EmptyState
              icon={Settings}
              title="Brak dodatkowych pól"
              description="Nie skonfigurowano jeszcze żadnych dodatkowych pól. Możesz je dodać po podłączeniu bazy danych."
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
