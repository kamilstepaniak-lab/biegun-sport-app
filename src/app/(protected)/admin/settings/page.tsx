import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Activity, Mail, ChevronDown, ChevronRight, UserPlus, ShieldCheck, Landmark, FileText } from 'lucide-react';

import { PageHeader, PanelIcon } from '@/components/shared';
import { getActivityLogs, getEmailLogs, getSystemEmailQueueLogs } from '@/lib/actions/activity-logs';
import { getBankAccounts } from '@/lib/actions/settings';
import { ParentAccountsManager } from './parent-accounts-manager';
import { SyncJwtRolesButton } from './sync-jwt-roles';
import { BankAccountsForm } from './bank-accounts-form';
import { ActivityLogsPanel } from './activity-logs-panel';
import { EmailLogsPanel } from './email-logs-panel';

function SettingsSummary({
  icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PanelIcon icon={icon} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const [activityLogs, emailLogs, queueLogs, bankAccounts] = await Promise.all([
    getActivityLogs(30),
    getEmailLogs(30),
    getSystemEmailQueueLogs(30),
    getBankAccounts(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ustawienia"
        description="Konfiguracja aplikacji, logi i narzędzia administracyjne"
      />

      <div className="space-y-3">
      {/* ── Szablony e-maili ───────────────────────────────────────── */}
      <Link
        href="/admin/settings/email-templates"
        className="flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 hover:bg-gray-50/50 transition-colors"
      >
        <SettingsSummary
          icon={FileText}
          title="Szablony e-maili"
          description="Edytuj treści wiadomości: zapisy, płatności, informacje o wyjazdach"
        />
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </Link>

      {/* ── Konta bankowe ─────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <SettingsSummary
            icon={Landmark}
            title="Konta bankowe"
            description="Wspólny numer konta PLN i EUR dla wszystkich wyjazdów"
          />
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100 px-5 py-4">
          <BankAccountsForm initial={bankAccounts} />
        </div>
      </details>

      {/* ── Konta rodziców ────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <SettingsSummary
            icon={UserPlus}
            title="Konta rodziców"
            description="Twórz i resetuj hasła kont logowania rodziców"
          />
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100 px-5 py-4">
          <ParentAccountsManager />
        </div>
      </details>

      {/* ── Synchronizacja ról JWT ────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <SettingsSummary
            icon={ShieldCheck}
            title="Synchronizacja ról JWT"
            description="Zapisz role użytkowników w tokenach JWT"
          />
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100 px-5 py-4">
          <SyncJwtRolesButton />
        </div>
      </details>

      {/* ── Logi aktywności ───────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <SettingsSummary
            icon={Activity}
            title="Logi aktywności"
            description={`Zdarzenia rodziców i admina z ostatnich 30 dni · ${activityLogs.length} wpisów`}
          />
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100">
          <ActivityLogsPanel logs={activityLogs} />
        </div>
      </details>

      {/* ── Logi e-maili ──────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <SettingsSummary
            icon={Mail}
            title="Logi e-maili"
            description={`Wysłane i kolejkowane wiadomości z ostatnich 30 dni · ${emailLogs.length} wysłanych`}
          />
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100">
          <EmailLogsPanel logs={emailLogs} queueLogs={queueLogs} />
        </div>
      </details>
      </div>
    </div>
  );
}
