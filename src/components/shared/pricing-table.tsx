'use client';

import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CreditCard, Copy, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { EmptyState } from '@/components/shared';
import type { TripPaymentTemplate } from '@/types';

function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} skopiowany do schowka`);
}

function getMethodStyle(method: string | null): { label: string; className: string } | null {
    if (method === 'transfer') return { label: 'Przelew', className: 'bg-blue-100 text-blue-800 border-blue-200' };
    if (method === 'cash') return { label: 'Gotówka', className: 'bg-amber-100 text-amber-800 border-amber-200' };
    return { label: 'Przelew/Gotówka', className: 'bg-violet-100 text-violet-800 border-violet-200' };
}

function PricingRow({ template, departureDate }: { template: TripPaymentTemplate; departureDate?: string }) {
    const methodStyle = getMethodStyle(template.payment_method);

    const paymentTypeLabel = template.payment_type === 'installment'
        ? `Rata ${template.installment_number}`
        : `Karnet ${template.category_name || ''}`;

    return (
        <div className="px-4 py-3 hover:bg-muted/30 transition-colors">
            {/* Górny wiersz: Nazwa + Kwota — działa na mobile i desktop */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-semibold text-sm">{paymentTypeLabel}</span>
                    {methodStyle && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold border ${methodStyle.className}`}>
                            {methodStyle.label}
                        </span>
                    )}
                </div>
                <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                    {template.amount.toFixed(0)} {template.currency}
                </span>
            </div>

            {/* Dolny wiersz: Termin + roczniki */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                {template.due_date && (() => {
                    const isDepartureDay = departureDate && template.due_date === new Date(departureDate).toISOString().split('T')[0];
                    return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-100 text-amber-700 border-amber-300">
                            <Clock className="h-3 w-3" />
                            {isDepartureDay ? 'w dniu wyjazdu' : `do ${format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl })}`}
                        </span>
                    );
                })()}
                {(template.payment_type === 'season_pass' || (template.is_first_installment && template.includes_season_pass)) && (
                    <span>
                        {template.payment_type === 'season_pass'
                            ? `Roczniki: ${template.birth_year_from} – ${template.birth_year_to}`
                            : '(zawiera opłatę za karnet)'}
                    </span>
                )}
                {!template.due_date && (
                    <span className="italic">Termin wg ustaleń</span>
                )}
            </div>
        </div>
    );
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
        <div className="space-y-4">
            <div className="rounded-lg border bg-card divide-y">
                {sortedTemplates.map((template) => (
                    <PricingRow key={template.id} template={template} departureDate={departureDate} />
                ))}
            </div>
        </div>
    );
}
