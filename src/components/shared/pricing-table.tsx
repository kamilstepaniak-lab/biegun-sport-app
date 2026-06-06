'use client';

import { CreditCard } from 'lucide-react';
import { EmptyState } from './empty-state';
import { PaymentDue } from './payment-due';
import type { TripPaymentTemplate } from '@/types';

function getMethodLabel(method: string | null): { label: string; className: string } {
    if (method === 'transfer') return { label: 'Przelew', className: 'bg-blue-100 text-blue-700' };
    if (method === 'cash') return { label: 'Gotówka', className: 'bg-amber-100 text-amber-700' };
    return { label: 'Przelew/Gotówka', className: 'bg-violet-100 text-violet-700' };
}

function getPaymentTypeLabel(template: TripPaymentTemplate): string {
    return template.payment_type === 'installment'
        ? `Rata ${template.installment_number}`
        : `Karnet ${template.category_name || ''}`.trim();
}

interface PricingTableProps {
    templates: TripPaymentTemplate[];
    departureDate?: string;
    actualDueDatesByTemplateId?: Record<string, string>;
}

export function PricingTable({ templates, departureDate, actualDueDatesByTemplateId }: PricingTableProps) {
    if (!templates || templates.length === 0) {
        return (
            <EmptyState
                icon={CreditCard}
                title="Brak cennika"
                description="Nie zdefiniowano planu płatności dla tego wyjazdu."
            />
        );
    }

    const sortedTemplates = [...templates].sort((a, b) => {
        if (a.payment_type === 'installment' && b.payment_type !== 'installment') return -1;
        if (a.payment_type !== 'installment' && b.payment_type === 'installment') return 1;
        if (a.payment_type === 'installment' && b.payment_type === 'installment') {
            return (a.installment_number || 0) - (b.installment_number || 0);
        }
        return a.amount - b.amount;
    });

    // Rata 1 — źródło terminu dla karnetów płatnych „w terminie raty 1".
    const firstInstallment = templates.find(
        (t) => t.payment_type === 'installment' && (t.installment_number === 1 || t.is_first_installment),
    );
    // Termin do pokazania dla karnetu „w terminie raty 1": konkretna data raty 1
    // jeśli znana, inaczej PaymentDue pokaże etykietę „w terminie raty 1".
    function dueProps(template: TripPaymentTemplate) {
        if (template.due_with_first_installment && firstInstallment) {
            return {
                paymentDueDate:
                    actualDueDatesByTemplateId?.[firstInstallment.id] ?? firstInstallment.due_date ?? undefined,
                dueWithFirstInstallment: true as const,
            };
        }
        return {
            paymentDueDate: actualDueDatesByTemplateId?.[template.id],
            templateDueDate: template.due_date,
            dueDaysFromConfirmation: template.due_days_from_confirmation,
        };
    }

    return (
        <div className="rounded-lg border bg-card">
            {/* Mobile: karty */}
            <div className="md:hidden divide-y">
                {sortedTemplates.map((template) => {
                    const methodStyle = getMethodLabel(template.payment_method);
                    const label = getPaymentTypeLabel(template);
                    return (
                        <div key={template.id} className="p-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold text-foreground text-sm">{label}</p>
                                    {(template.payment_type === 'season_pass' || (template.is_first_installment && template.includes_season_pass)) && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {template.payment_type === 'season_pass'
                                                ? `Roczniki: ${template.birth_year_from}–${template.birth_year_to}`
                                                : '(zawiera karnet)'}
                                        </p>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-emerald-600 tabular-nums whitespace-nowrap">
                                    {template.amount.toFixed(0)} {template.currency}
                                </p>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${methodStyle.className}`}>
                                    {methodStyle.label}
                                </span>
                                <span className="text-muted-foreground">
                                    <PaymentDue
                                        {...dueProps(template)}
                                        departureDate={departureDate}
                                    />
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
            {/* Desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b bg-muted/30">
                            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Za co</th>
                            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Termin</th>
                            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Forma</th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Kwota</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {sortedTemplates.map((template) => {
                            const methodStyle = getMethodLabel(template.payment_method);
                            const label = getPaymentTypeLabel(template);

                            return (
                                <tr key={template.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <p className="font-semibold text-foreground">{label}</p>
                                        {(template.payment_type === 'season_pass' || (template.is_first_installment && template.includes_season_pass)) && (
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {template.payment_type === 'season_pass'
                                                    ? `Roczniki: ${template.birth_year_from}–${template.birth_year_to}`
                                                    : '(zawiera karnet)'}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                        <PaymentDue
                                            {...dueProps(template)}
                                            departureDate={departureDate}
                                        />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${methodStyle.className}`}>
                                            {methodStyle.label}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                                        {template.amount.toFixed(0)} {template.currency}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
