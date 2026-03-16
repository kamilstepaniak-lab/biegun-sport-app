'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteMyAccount } from '@/lib/actions/profile';

export function DeleteAccountSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [isPending, startTransition] = useTransition();

  const CONFIRM_TEXT = 'USUŃ KONTO';
  const isConfirmed = confirmation === CONFIRM_TEXT;

  function handleDelete() {
    if (!isConfirmed) return;

    startTransition(async () => {
      const result = await deleteMyAccount();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Konto zostało usunięte');
        router.push('/login');
      }
    });
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <Trash2 className="h-4 w-4" />
          Usuń konto
        </CardTitle>
        <CardDescription>
          Trwałe usunięcie konta i wszystkich powiązanych danych
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => setOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Chcę usunąć swoje konto
          </Button>
        ) : (
          <div className="space-y-4 max-w-sm">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold mb-1">Ta operacja jest nieodwracalna!</p>
                  <p>Zostaną usunięte:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-red-700">
                    <li>Twoje konto i dane profilowe</li>
                    <li>Wszystkie zapisane dzieci</li>
                    <li>Wszystkie zapisy na wyjazdy</li>
                    <li>Historia płatności</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm text-gray-600">
                Wpisz <span className="font-mono font-semibold bg-gray-100 px-1.5 py-0.5 rounded text-xs">{CONFIRM_TEXT}</span> aby potwierdzić:
              </p>
              <Input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder={CONFIRM_TEXT}
                disabled={isPending}
                className="font-mono"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setOpen(false); setConfirmation(''); }}
                disabled={isPending}
              >
                Anuluj
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={!isConfirmed || isPending}
              >
                {isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Usuwanie...</>
                ) : (
                  <><Trash2 className="h-4 w-4 mr-2" />Usuń konto na zawsze</>
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
