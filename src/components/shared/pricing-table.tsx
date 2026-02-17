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
    // Jeśli oba lub null - traktujemy jako mieszane/dowolne
    return { label: 'Przelew/Gotówka', className: 'bg-violet-100 text-violet-800 border-violet-200' };
}

function PricingRow({ template }: { template: TripPaymentTemplate }) {
    const methodStyle = getMethodStyle(template.payment_method);

    const paymentTypeLabel = template.payment_type === 'installment'
        ? `Rata ${template.installment_number}`
        : `Karnet ${template.category_name || ''}`;

    // Dla cennika "Status" symulujemy jako "Do zapłaty" (bo to planowane), 
    // ale żeby nie mylić użytkownika, nazwiemy to "Termin" w badge'u.
    // Albo po prostu po prawej damy kwotę na zielono jak w screenie.

    // Layout from screenshot:
    // [Payment Name] [MethodBadge] ... [StatusBadge] [Amount]

    return (
        <div className="px-4 py-3 hover:bg-muted/30 transition-colors">
            {/* Górny wiersz: Typ + Metoda | Status | Kwota */}
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-2 md:gap-4 items-center">

                {/* LEWA STRONA: Nazwa płatności + Metoda */}
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">{paymentTypeLabel}</span>
                    {methodStyle && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold border ${methodStyle.className}`}>
                            {methodStyle.label}
                        </span>
                    )}
                </div>

                {/* ŚRODEK: Termin (Status) */}
                <div className="flex justify-start md:justify-center">
                    {template.due_date && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-100 text-amber-700 border-amber-300">
                            <Clock className="h-3 w-3" />
                            Do {format(new Date(template.due_date), 'd.MM.yyyy', { locale: pl })}
                        </span>
                    )}
                </div>

                {/* PRAWA STRONA: Kwota */}
                <div className="text-right">
                    <span className="text-sm font-bold text-green-600">
                        {template.amount.toFixed(0)} {template.currency}
                    </span>
                </div>
            </div>

            {/* Dolny wiersz: Dodatkowe informacje (Roczniki, Tytuł przelewu - symulacja) */}
            <div className="flex items-center justify-between mt-1 gap-4">
                <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0">
                    {/* Informacje o rocznikach dla karnetów */}
                    {(template.payment_type === 'season_pass' || (template.is_first_installment && template.includes_season_pass)) && (
                        <span className="truncate">
                            {template.payment_type === 'season_pass'
                                ? `Roczniki: ${template.birth_year_from} - ${template.birth_year_to}`
                                : '(zawiera opłatę za karnet)'}
                        </span>
                    )}

                    {/* Jeśli brak daty, wyświetlamy tu info */}
                    {!template.due_date && (
                        <span className="italic">Termin wg ustaleń</span>
                    )}
                </div>
            </div>
        </div>
    );
}

interface PricingTableProps {
    templates: TripPaymentTemplate[];
}

export function PricingTable({ templates }: PricingTableProps) {
    if (!templates || templates.length === 0) {
        return (
            <EmptyState
                icon={CreditCard}
                title="Brak cennika"
                description="Nie zdefiniowano planu płatności dla tego wyjazdu."
            />
        );
    }

    // Sortowanie: Raty (wg numeru), potem Karnety (wg kwoty)
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
            {/* Nagłówek kolumn - tylko desktop - dopasowany do treści */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr] gap-4 px-4 py-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <div>Płatność</div>
                <div className="text-center">Termin</div>
                <div className="text-right">Kwota</div>
            </div>

            <div className="rounded-lg border bg-card divide-y">
                {sortedTemplates.map((template) => (
                    <PricingRow key={template.id} template={template} />
                ))}
            </div>
        </div>
    );
}
