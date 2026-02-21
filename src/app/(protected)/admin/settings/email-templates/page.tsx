export const dynamic = 'force-dynamic';

import { Mail } from 'lucide-react';
import { PageHeader } from '@/components/shared';
import { getEmailTemplates } from '@/lib/actions/email-templates';
import { EmailTemplatesEditor } from './email-templates-editor';

export default async function EmailTemplatesPage() {
  const templates = await getEmailTemplates();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Szablony e-maili"
        description="Edytuj treść automatycznych wiadomości wysyłanych do rodziców"
      />
      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-12 text-center">
          <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Brak szablonów — uruchom migrację SQL</p>
        </div>
      ) : (
        <EmailTemplatesEditor templates={templates} />
      )}
    </div>
  );
}
