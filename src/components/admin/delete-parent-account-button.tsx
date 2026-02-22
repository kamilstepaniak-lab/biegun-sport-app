'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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

import { deleteParentAccount } from '@/lib/actions/admin-accounts';

interface DeleteParentAccountButtonProps {
  parentId: string;
  parentName: string;
}

export function DeleteParentAccountButton({ parentId, parentName }: DeleteParentAccountButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleConfirm() {
    setIsLoading(true);
    try {
      const result = await deleteParentAccount(parentId);
      if (result.error) {
        toast.error(result.error);
        setIsLoading(false);
      } else {
        toast.success(`Konto ${parentName} zostało usunięte`);
        router.push('/admin/participants');
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
      setIsLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Usuń konto rodzica
      </Button>

      <AlertDialog open={isOpen} onOpenChange={(open) => !isLoading && setIsOpen(open)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń konto: {parentName}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Ta operacja jest <strong>nieodwracalna</strong>. Zostaną trwale usunięte:</p>
                <ul className="list-none space-y-1 text-sm">
                  <li>• Konto i dane rodzica ({parentName})</li>
                  <li>• Wszystkie dzieci przypisane do tego konta</li>
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
              onClick={handleConfirm}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {isLoading ? 'Usuwanie...' : 'Tak, usuń konto'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
