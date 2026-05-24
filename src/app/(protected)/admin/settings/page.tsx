import Link from 'next/link';
import { Activity, Mail, ChevronDown, ChevronRight, UserPlus, ShieldCheck, Landmark, FileText } from 'lucide-react';

import { PageHeader } from '@/components/shared';
import { getActivityLogs, getEmailLogs } from '@/lib/actions/activity-logs';
import { getBankAccounts } from '@/lib/actions/settings';
import { ParentAccountsManager } from './parent-accounts-manager';
import { SyncJwtRolesButton } from './sync-jwt-roles';
import { BankAccountsForm } from './bank-accounts-form';
import { ActivityLogsPanel } from './activity-logs-panel';
import { EmailLogsPanel } from './email-logs-panel';

export default async function SettingsPage() {
  const [activityLogs, emailLogs, bankAccounts] = await Promise.all([
    getActivityLogs(30),
    getEmailLogs(30),
    getBankAccounts(),
  ]);

  return (
    <div className="space-y-3 max-w-4xl">
      <PageHeader
        title="Ustawienia"
        description="Konfiguracja aplikacji, logi i narzędzia administracyjne"
      />

      {/* ── Szablony e-maili ───────────────────────────────────────── */}
      <Link
        href="/admin/settings/email-templates"
        className="flex items-center justify-between gap-3 px-5 py-4 bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Szablony e-maili</p>
            <p className="text-xs text-gray-500">Edytuj treści wiadomości: zapisy, płatności, informacje o wyjazdach</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </Link>

      {/* ── Konta bankowe ─────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
              <Landmark className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Konta bankowe</p>
              <p className="text-xs text-gray-500">Wspólny numer konta PLN i EUR dla wszystkich wyjazdów</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100 px-5 py-4">
          <BankAccountsForm initial={bankAccounts} />
        </div>
      </details>

      {/* ── Konta rodziców ────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <UserPlus className="h-4 w-4 text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Konta rodziców</p>
              <p className="text-xs text-gray-500">Twórz i resetuj hasła kont logowania rodziców</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100 px-5 py-4">
          <ParentAccountsManager />
        </div>
      </details>

      {/* ── Synchronizacja ról JWT ────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <ShieldCheck className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Synchronizacja ról JWT</p>
              <p className="text-xs text-gray-500">Zapisz role użytkowników w tokenach JWT</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100 px-5 py-4">
          <SyncJwtRolesButton />
        </div>
      </details>

      {/* ── Logi aktywności ───────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
              <Activity className="h-4 w-4 text-slate-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Logi aktywności</p>
              <p className="text-xs text-gray-500">Zdarzenia rodziców i admina z ostatnich 30 dni · {activityLogs.length} wpisów</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100">
          <ActivityLogsPanel logs={activityLogs} />
        </div>
      </details>

      {/* ── Logi e-maili ──────────────────────────────────────────── */}
      <details className="group bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
        <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none hover:bg-gray-50/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Logi e-maili</p>
              <p className="text-xs text-gray-500">Wysłane wiadomości z ostatnich 30 dni · {emailLogs.length} maili</p>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 flex-shrink-0" />
        </summary>
        <div className="border-t border-gray-100">
          <EmailLogsPanel logs={emailLogs} />
        </div>
      </details>
    </div>
  );
}
