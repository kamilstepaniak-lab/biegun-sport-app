'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Upload,
  RefreshCw,
  Check,
  X,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { runTripsImport, resetTripsImportStatus } from '@/lib/actions/trips-import';

interface ImportRecord {
  id: number;
  tytul_wyjazdu: string | null;
  opis: string | null;
  sekcja: string | null;
  data_wyjazdu: string | null;
  data_powrotu: string | null;
  miejsce_wyjazdu: string | null;
  miejsce_powrotu: string | null;
  godzina_wyjazdu: string | null;
  godzina_powrotu: string | null;
  kwota_1: string | null;
  termin_1: string | null;
  forma_platnosci_1: string | null;
  kwota_2: string | null;
  termin_2: string | null;
  forma_platnosci_2: string | null;
  karnety_reguly: string | null;
  status_importu: string;
  blad_opis: string | null;
}

interface TripsImportClientProps {
  records: ImportRecord[];
}

const statusConfig = {
  oczekuje: { label: 'Oczekuje', color: 'bg-amber-100 text-amber-700', icon: Clock },
  zaimportowano: { label: 'Zaimportowano', color: 'bg-green-100 text-green-700', icon: Check },
  blad: { label: 'Błąd', color: 'bg-red-100 text-red-700', icon: X },
};

export function TripsImportClient({ records }: TripsImportClientProps) {
  const router = useRouter();
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    errors: number;
    errorDetails: string[];
  } | null>(null);
  const [errorsOpen, setErrorsOpen] = useState(false);

  const pendingCount = records.filter(r => r.status_importu === 'oczekuje').length;
  const importedCount = records.filter(r => r.status_importu === 'zaimportowano').length;
  const errorCount = records.filter(r => r.status_importu === 'blad').length;

  async function handleImport() {
    setIsImporting(true);
    setImportResult(null);

    try {
      const result = await runTripsImport();

      setImportResult({
        imported: result.imported,
        errors: result.errors,
        errorDetails: result.errorDetails,
      });

      if (result.imported > 0) {
        toast.success(`Zaimportowano ${result.imported} wyjazdów`);
      }
      if (result.errors > 0) {
        toast.error(`${result.errors} rekordów z błędami`);
        setErrorsOpen(true);
      }

      router.refresh();
    } catch (err) {
      toast.error('Błąd podczas importu');
      console.error('Import error:', err);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleReset() {
    setIsResetting(true);

    try {
      const result = await resetTripsImportStatus();

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Statusy zresetowane - można ponowić import');
        router.refresh();
      }
    } catch (err) {
      toast.error('Błąd podczas resetowania');
      console.error('Reset error:', err);
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Statystyki */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{records.length}</div>
            <div className="text-sm text-muted-foreground">Wszystkich rekordów</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-amber-700">{pendingCount}</div>
            <div className="text-sm text-amber-600">Oczekujących</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-700">{importedCount}</div>
            <div className="text-sm text-green-600">Zaimportowanych</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-700">{errorCount}</div>
            <div className="text-sm text-red-600">Błędów</div>
          </CardContent>
        </Card>
      </div>

      {/* Przyciski akcji */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleImport}
          disabled={isImporting || pendingCount === 0}
        >
          {isImporting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Importowanie...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Uruchom import ({pendingCount} rekordów)
            </>
          )}
        </Button>

        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isResetting || (errorCount === 0 && importedCount === 0)}
        >
          {isResetting ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Resetowanie...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Resetuj statusy
            </>
          )}
        </Button>
      </div>

      {/* Wyniki importu */}
      {importResult && importResult.errorDetails.length > 0 && (
        <Collapsible open={errorsOpen} onOpenChange={setErrorsOpen}>
          <Card className="border-red-200">
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-base flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    Błędy importu ({importResult.errors})
                  </CardTitle>
                  {errorsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ul className="space-y-1 text-sm text-red-600">
                  {importResult.errorDetails.map((error, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Tabela danych */}
      {records.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Dane do importu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">ID</TableHead>
                    <TableHead>Tytuł</TableHead>
                    <TableHead>Sekcja</TableHead>
                    <TableHead>Data wyjazdu</TableHead>
                    <TableHead>Data powrotu</TableHead>
                    <TableHead>Rata 1</TableHead>
                    <TableHead>Rata 2</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => {
                    const status = statusConfig[record.status_importu as keyof typeof statusConfig] || statusConfig.oczekuje;
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={record.id} className={record.status_importu === 'blad' ? 'bg-red-50' : ''}>
                        <TableCell className="font-mono text-xs">{record.id}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {record.tytul_wyjazdu || '-'}
                        </TableCell>
                        <TableCell>{record.sekcja || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {record.data_wyjazdu || '-'}
                          {record.godzina_wyjazdu && <span className="text-muted-foreground ml-1">{record.godzina_wyjazdu}</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.data_powrotu || '-'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.kwota_1 ? `${record.kwota_1} PLN` : '-'}
                          {record.termin_1 && <span className="text-muted-foreground ml-1">(do {record.termin_1})</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {record.kwota_2 ? `${record.kwota_2} PLN` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={`${status.color} border-none`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                            {record.blad_opis && (
                              <p className="text-xs text-red-600 max-w-[150px] truncate" title={record.blad_opis}>
                                {record.blad_opis}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">Brak danych do importu</p>
            <p className="text-sm">
              Dodaj dane do tabeli <code className="bg-muted px-1 rounded">trips_import_buffer</code> w Supabase
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
