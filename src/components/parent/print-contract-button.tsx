'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PrintContractButtonProps {
  contractId: string;
  contractNumber: string | null;
}

export function PrintContractButton({ contractId }: PrintContractButtonProps) {
  return (
    <Button variant="outline" size="sm" asChild className="gap-2">
      <a href={`/api/contracts/${contractId}/pdf`} download>
        <Download className="h-4 w-4" />
        Pobierz PDF
      </a>
    </Button>
  );
}
