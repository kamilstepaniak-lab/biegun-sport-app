'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CheckCircle, Clock, Download, Trash2, Loader2, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ContractViewDialog } from '@/components/admin/contract-view-dialog';
import { deleteContractsAdmin } from '@/lib/actions/contracts';

export interface ContractRow {
  id: string;
  contract_number: string | null;
  contract_text: string;
  accepted_at: string | null;
  childName: string;
  parentName: string;
  parentEmail: string;
}

interface ContractsTableProps {
  contracts: ContractRow[];
}

export function ContractsTable({ contracts }: ContractsTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const allSelected = contracts.length > 0 && selected.size === contracts.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contracts.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDownloadSingle(contract: ContractRow) {
    const blob = new Blob([contract.contract_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Umowa_${contract.contract_number ?? contract.id}_${contract.childName.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadSelected() {
    if (selected.size === 0) return;
    setIsDownloading(true);
    const selectedContracts = contracts.filter((c) => selected.has(c.id));
    selectedContracts.forEach((contract) => {
      setTimeout(() => {
        handleDownloadSingle(contract);
      }, 100);
    });
    toast.success(`Pobieranie ${selectedContracts.length} umów...`);
    setIsDownloading(false);
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    setIsDeleting(true);
    const ids = Array.from(selected);
    const result = await deleteContractsAdmin(ids);
    setIsDeleting(false);
    setShowDeleteDialog(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Usunięto ${ids.length} umów`);
      setSelected(new Set());
      router.refresh();
    }
  }

  return (
    <div className="space-y-3">
      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-blue-800">
            Zaznaczono: {selected.size}
          </span>
          <div className="h-4 w-px bg-blue-300" />
          <button
            onClick={handleDownloadSelected}
            disabled={isDownloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 text-xs font-medium rounded-lg ring-1 ring-blue-200 transition-colors disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileDown className="h-3.5 w-3.5" />
            )}
            Pobierz zaznaczone
          </button>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 text-red-600 text-xs font-medium rounded-lg ring-1 ring-red-200 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Usuń zaznaczone
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-blue-500 hover:text-blue-700"
          >
            Odznacz
          </button>
        </div>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="py-2 pr-3 w-8">
                <Checkbox
                  checked={allSelected}
                  data-state={someSelected ? 'indeterminate' : allSelected ? 'checked' : 'unchecked'}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="text-left py-2 pr-4 font-medium">Nr umowy</th>
              <th className="text-left py-2 pr-4 font-medium">Dziecko</th>
              <th className="text-left py-2 pr-4 font-medium">Rodzic</th>
              <th className="text-left py-2 pr-4 font-medium">Status</th>
              <th className="text-left py-2 pr-4 font-medium">Data akceptacji</th>
              <th className="text-left py-2 pr-4 font-medium">Podgląd</th>
              <th className="text-left py-2 font-medium">Pobierz</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => {
              const isSelected = selected.has(contract.id);
              return (
                <tr
                  key={contract.id}
                  className={`border-b last:border-0 transition-colors ${isSelected ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                >
                  <td className="py-2.5 pr-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(contract.id)}
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    {contract.contract_number ? (
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {contract.contract_number}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 font-medium">{contract.childName}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    <div className="text-sm">{contract.parentName}</div>
                    <div className="text-xs text-gray-400">{contract.parentEmail}</div>
                  </td>
                  <td className="py-2.5 pr-4">
                    {contract.accepted_at ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Zaakceptowana
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 border-amber-300">
                        <Clock className="mr-1 h-3 w-3" />
                        Oczekuje
                      </Badge>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground text-sm">
                    {contract.accepted_at
                      ? format(new Date(contract.accepted_at), 'd MMM yyyy, HH:mm', { locale: pl })
                      : '—'}
                  </td>
                  <td className="py-2.5 pr-4">
                    <ContractViewDialog
                      contractId={contract.id}
                      contractNumber={contract.contract_number}
                      contractText={contract.contract_text}
                      childName={contract.childName}
                      parentName={contract.parentName}
                      acceptedAt={contract.accepted_at}
                      acceptedByName={contract.parentName}
                    />
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleDownloadSingle(contract)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg ring-1 ring-gray-200 transition-colors"
                      title="Pobierz umowę jako .txt"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Pobierz
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Dialog potwierdzenia usunięcia */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń zaznaczone umowy</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć {selected.size} zaznaczonych umów?
              Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 rounded-xl"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Usuwanie...
                </>
              ) : (
                'Usuń'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
