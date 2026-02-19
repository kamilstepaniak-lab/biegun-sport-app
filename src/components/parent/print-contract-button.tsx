'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PrintContractButtonProps {
  contractId: string;
  contractNumber: string | null;
}

export function PrintContractButton({ contractId, contractNumber }: PrintContractButtonProps) {
  function handlePrint() {
    const el = document.getElementById(`contract-doc-${contractId}`);
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
    <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
      <Download className="h-4 w-4" />
      Pobierz PDF
    </Button>
  );
}
