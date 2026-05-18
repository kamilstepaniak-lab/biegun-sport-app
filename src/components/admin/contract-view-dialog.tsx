'use client';

import { useState } from 'react';
import { Eye, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ContractDocument } from '@/components/contract-document';

interface ContractViewDialogProps {
  contractId: string;
  contractNumber: string | null;
  contractText: string;
  childName: string;
  parentName: string;
  acceptedAt: string | null;
  acceptedByName?: string | null;
}

export function ContractViewDialog({
  contractId,
  contractNumber,
  contractText,
  childName,
  parentName,
  acceptedAt,
  acceptedByName,
}: ContractViewDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-lg ring-1 ring-gray-200 transition-colors"
      >
        <Eye className="h-3.5 w-3.5" />
        Podgląd
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2">
                Umowa — {childName}
                {contractNumber && (
                  <span className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {contractNumber}
                  </span>
                )}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-2"
              >
                <a href={`/api/contracts/${contractId}/pdf`} download>
                  <Download className="h-3.5 w-3.5" />
                  Pobierz PDF
                </a>
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-2">
            <div id={`admin-contract-doc-${contractId}`}>
              <ContractDocument
                text={contractText}
                contractNumber={contractNumber}
                acceptedAt={acceptedAt}
                acceptedByName={acceptedByName ?? parentName}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
