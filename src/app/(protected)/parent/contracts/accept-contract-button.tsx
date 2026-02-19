'use client';

import { useState } from 'react';
import { CheckCircle, Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { acceptContract } from '@/lib/actions/contracts';

interface AcceptContractButtonProps {
  contractId: string;
}

export function AcceptContractButton({ contractId }: AcceptContractButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [owuChecked, setOwuChecked] = useState(false);
  const router = useRouter();

  async function handleAccept() {
    if (!owuChecked) return;
    setIsLoading(true);
    try {
      const result = await acceptContract(contractId);
      if (result.error) {
        toast.error(result.error);
      } else {
        setAccepted(true);
        toast.success('Umowa zaakceptowana!');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsLoading(false);
    }
  }

  if (accepted) {
    return (
      <div className="flex items-center gap-2 text-green-700 text-sm font-medium py-2">
        <CheckCircle className="h-4 w-4" />
        Zaakceptowano pomyślnie
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2 border-t border-gray-100">
      {/* Checkbox OWU */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <Checkbox
          id={`owu-${contractId}`}
          checked={owuChecked}
          onCheckedChange={(v) => setOwuChecked(!!v)}
          className="mt-0.5 shrink-0"
        />
        <span className="text-sm text-gray-700 leading-relaxed">
          Zapoznałem/am się z{' '}
          <a
            href="/parent/owu"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-purple-700 font-medium hover:text-purple-900 underline underline-offset-2"
            onClick={(e) => e.stopPropagation()}
          >
            Ogólnymi Warunkami Uczestnictwa (OWU)
            <ExternalLink className="h-3 w-3" />
          </a>{' '}
          i akceptuję ich postanowienia.
        </span>
      </label>

      {/* Przycisk akceptacji */}
      <Button
        onClick={handleAccept}
        disabled={isLoading || !owuChecked}
        className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Akceptowanie...
          </>
        ) : (
          <>
            <CheckCircle className="mr-2 h-4 w-4" />
            Akceptuję warunki umowy
          </>
        )}
      </Button>

      {!owuChecked && (
        <p className="text-xs text-gray-400">
          Zaznacz potwierdzenie zapoznania się z OWU, aby aktywować przycisk.
        </p>
      )}
    </div>
  );
}
