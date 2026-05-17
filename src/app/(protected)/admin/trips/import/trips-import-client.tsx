'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { bulkImportTrips, type ImportTripRow, type BulkImportResult } from '@/lib/actions/trips-import';

// Minimalny parser CSV — obsługuje cudzysłowy oraz separator ; lub ,
function parseCSV(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const firstLine = clean.split('\n')[0] ?? '';
  const delim = firstLine.includes(';') ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function TripsImportClient() {
  const router = useRouter();
  const [rows, setRows] = useState<ImportTripRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      const matrix = parseCSV(String(reader.result ?? ''));
      if (matrix.length < 2) {
        toast.error('Plik jest pusty lub zawiera tylko nagłówek');
        return;
      }
      const header = matrix[0].map((h) => h.trim().toLowerCase());
      const parsed: ImportTripRow[] = matrix.slice(1).map((cells) => {
        const obj: Record<string, string> = {};
        header.forEach((h, idx) => {
          obj[h] = (cells[idx] ?? '').trim();
        });
        return obj as ImportTripRow;
      });
      setRows(parsed);
      setFileName(file.name);
    };
    reader.readAsText(file, 'UTF-8');
    // pozwól wgrać ten sam plik ponownie
    e.target.value = '';
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setIsImporting(true);
    setResult(null);
    try {
      const res = await bulkImportTrips(rows);
      setResult(res);
      if (res.imported > 0) {
        toast.success(`Zaimportowano ${res.imported} wyjazdów`);
        router.refresh();
      }
      if (res.errors > 0) {
        toast.error(`${res.errors} wierszy z błędami`);
      }
    } catch {
      toast.error('Wystąpił błąd podczas importu');
    } finally {
      setIsImporting(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName('');
    setResult(null);
  }

  return (
    <div className="space-y-6">
      {/* Instrukcja + szablon */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jak to działa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-1">
            <li>Pobierz szablon CSV i wypełnij go w Excelu (jeden wyjazd = jeden wiersz).</li>
            <li>Zapisz plik w formacie CSV i wgraj go poniżej.</li>
            <li>Sprawdź podgląd i kliknij „Importuj”.</li>
          </ol>
          <p>
            Wyjazdy trafiają jako <strong>szkice</strong> — daty, ceny i grupę można potem
            poprawić. Karnety i drugi przystanek dodajesz ręcznie w edycji wyjazdu.
          </p>
          <Button variant="outline" asChild>
            <a href="/szablon-wyjazdy.csv" download>
              <Download className="mr-2 h-4 w-4" />
              Pobierz szablon CSV
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wgraj plik</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-8 cursor-pointer hover:bg-gray-50 transition-colors">
              <Upload className="h-8 w-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Kliknij, aby wybrać plik CSV</span>
              <span className="text-xs text-muted-foreground">Obsługiwany jest plik z szablonu</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            </label>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700 truncate">{fileName}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  ({rows.length} wierszy)
                </span>
              </div>
              <button
                onClick={reset}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Podgląd */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Podgląd ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border overflow-auto max-h-[420px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tytuł</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Grupa</TableHead>
                    <TableHead>Wyjazd</TableHead>
                    <TableHead>Powrót</TableHead>
                    <TableHead>Rata 1</TableHead>
                    <TableHead>Rata 2</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.tytul || '—'}</TableCell>
                      <TableCell>
                        {(r.typ || '').toLowerCase().includes('obow') ? 'Obowiązkowy' : 'Dla chętnych'}
                      </TableCell>
                      <TableCell>{r.grupa || '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.data_wyjazdu || '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{r.data_powrotu || '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.kwota_1 ? `${r.kwota_1} ${r.waluta_1 || 'PLN'}` : '—'}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {r.kwota_2 ? `${r.kwota_2} ${r.waluta_2 || 'PLN'}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importowanie...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importuj {rows.length} wyjazdów
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Wynik */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wynik importu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle className="h-4 w-4" />
                Zaimportowano: {result.imported}
              </span>
              {result.errors > 0 && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  Błędy: {result.errors}
                </span>
              )}
            </div>
            {result.details.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {result.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
