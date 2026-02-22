'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { deleteAccount } from '@/lib/actions/profile';

export function DeleteAccountSection() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleDeleteConfirm() {
    setIsLoading(true);
    try {
      const result = await deleteAccount();
      if (result.error) {
        toast.error(result.error);
        setIsLoading(false);
      } else {
        toast.success('Konto zostało usunięte');
        router.push('/login');
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
      setIsLoading(false);
    }
  }

  return (
    <>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">Strefa niebezpieczna</CardTitle>
          <CardDescription>
            Trwałe i nieodwracalne operacje na Twoim koncie
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Usuń konto</p>
              <p className="text-sm text-muted-foreground">
                Usuwa konto, wszystkie dzieci, rejestracje na wyjazdy i historię płatności. Tej operacji nie można cofnąć.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsOpen(true)}
              className="shrink-0"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Usuń konto
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isOpen} onOpenChange={(open) => !isLoading && setIsOpen(open)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć konto?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Ta operacja jest <strong>nieodwracalna</strong>. Zostaną trwale usunięte:</p>
                <ul className="list-none space-y-1 text-sm">
                  <li>• Twoje dane osobowe i kontaktowe</li>
                  <li>• Wszystkie dodane dzieci</li>
                  <li>• Wszystkie rejestracje na wyjazdy</li>
                  <li>• Cała historia płatności</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading} className="rounded-xl">
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {isLoading ? 'Usuwanie...' : 'Tak, usuń moje konto'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
