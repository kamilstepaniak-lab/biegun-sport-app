'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { exportMyData } from '@/lib/actions/profile';

export function DataExportSection() {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await exportMyData();
      if (res.error || !res.data) {
        toast.error(res.error || 'Nie udało się pobrać danych');
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `moje-dane-biegunsport-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Dane zostały pobrane');
    } catch {
      toast.error('Wystąpił błąd podczas pobierania danych');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Pobierz moje dane
        </CardTitle>
        <CardDescription>
          Pobierz kopię wszystkich danych, jakie przechowujemy o Tobie i Twoich dzieciach
          (zgodnie z art. 15 i 20 RODO). Plik zostanie zapisany w formacie JSON.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={handleExport} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Przygotowuję plik...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Pobierz moje dane (JSON)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
