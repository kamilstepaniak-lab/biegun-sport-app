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

  function handlePrint() {
    const el = document.getElementById(`admin-contract-doc-${contractId}`);
    if (!el) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Umowa ${contractNumber ?? ''} — BiegunSport</title>
  <style>
    @page { size: A4; margin: 15mm 15mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; color: #111; line-height: 1.6; margin: 0; }
    .contract-header { background: #6d28d9; color: white; padding: 16px 24px; margin-bottom: 0; }
    .contract-header p { margin: 0 0 2px 0; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.1em; color: #ddd6fe; }
    .contract-header h1 { margin: 0; font-size: 18pt; font-weight: bold; }
    .contract-header .contract-num { text-align: right; }
    .contract-header .contract-num p { color: #c4b5fd; }
    .contract-header .contract-num strong { font-size: 14pt; color: white; }
    .header-inner { display: flex; justify-content: space-between; align-items: flex-start; }
    .section { border-bottom: 1px solid #e5e7eb; padding: 12px 24px; }
    .section-title { font-weight: bold; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 0.08em; color: #5b21b6; margin: 0 0 8px 0; }
    .kv-row { display: flex; gap: 8px; font-size: 10pt; padding: 3px 0; border-bottom: 1px solid #f9fafb; }
    .kv-key { color: #6b7280; min-width: 200px; flex-shrink: 0; }
    .kv-val { font-weight: 600; }
    p { margin: 2px 0; font-size: 10pt; }
    .num-point { display: flex; gap: 12px; }
    .num-point span:first-child { color: #6b7280; flex-shrink: 0; min-width: 1.2em; }
    .check-row { display: flex; gap: 8px; }
    .check-row span:first-child { color: #5b21b6; }
    .signature-block { background: #f0fdf4; border-top: 2px solid #86efac; padding: 14px 24px; }
    .sig-title { display: flex; align-items: center; gap: 8px; font-weight: bold; text-transform: uppercase; font-size: 8.5pt; color: #15803d; letter-spacing: 0.08em; margin-bottom: 10px; }
    .sig-row { display: flex; gap: 8px; font-size: 10pt; padding: 2px 0; }
    .sig-key { color: #6b7280; min-width: 180px; flex-shrink: 0; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 10px 24px; text-align: center; font-size: 8pt; color: #9ca3af; }
    .owu-bar { background: #eff6ff; border-top: 1px solid #bfdbfe; padding: 10px 24px; font-size: 9pt; color: #1d4ed8; }
    .accept-section { background: #faf5ff; padding: 12px 24px; }
  </style>
</head>
<body>
${el.innerHTML}
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 400);
  }

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
                onClick={handlePrint}
                className="gap-2"
              >
                <Download className="h-3.5 w-3.5" />
                Pobierz PDF
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
