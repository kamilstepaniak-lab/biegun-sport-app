'use client';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CreditCard, Clock } from 'lucide-react';
import { EmptyState } from './empty-state';
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
}

export function PricingTable({ templates, departureDate }: PricingTableProps) {
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

    return (
        <div className="rounded-lg border bg-card overflow-x-auto">
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
                        const isDepartureDay = departureDate && template.due_date === new Date(departureDate).toISOString().split('T')[0];

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
                                <td className="px-4 py-3 whitespace-nowrap">
                                    {template.due_date ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-700 border border-amber-300">
                                            <Clock className="h-3 w-3" />
                                            {isDepartureDay ? 'w dniu wyjazdu' : `do ${format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl })}`}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-muted-foreground italic">wg ustaleń</span>
                                    )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${methodStyle.className}`}>
                                        {methodStyle.label}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-green-600 whitespace-nowrap">
                                    {template.amount.toFixed(0)} {template.currency}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
