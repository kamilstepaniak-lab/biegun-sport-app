'use client';

import { useState } from 'react';
import { FileText, Eye, EyeOff, CheckCircle, Save, ShieldAlert, Loader2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ContractDocument } from '@/components/contract-document';
import {
  saveTripContractTemplate,
  activateTripContractTemplate,
  deactivateTripContractTemplate,
  previewContractTemplate,
} from '@/lib/actions/contracts';
import type { TripContractTemplate } from '@/types';

interface ContractTemplateEditorProps {
  tripId: string;
  initialTemplate: TripContractTemplate | null;
  defaultTemplateText: string;
  compact?: boolean;
}

export function ContractTemplateEditor({
  tripId,
  initialTemplate,
  defaultTemplateText,
  compact = false,
}: ContractTemplateEditorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState(initialTemplate?.template_text ?? defaultTemplateText);
  const [isActive, setIsActive] = useState(initialTemplate?.is_active ?? false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [previewParticipant, setPreviewParticipant] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const result = await saveTripContractTemplate(tripId, text);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Wzór umowy zapisany');
        setHasUnsavedChanges(false);
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleActivate() {
    if (hasUnsavedChanges) {
      toast.error('Najpierw zapisz zmiany');
      return;
    }
    setIsActivating(true);
    try {
      const result = await activateTripContractTemplate(tripId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Wzór aktywowany — rodzice będą dostawać umowy po potwierdzeniu wyjazdu');
        setIsActive(true);
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsActivating(false);
    }
  }

  async function handleDeactivate() {
    setIsActivating(true);
    try {
      const result = await deactivateTripContractTemplate(tripId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Wzór dezaktywowany');
        setIsActive(false);
        router.refresh();
      }
    } catch {
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsActivating(false);
    }
  }

  async function handleTogglePreview() {
    if (showPreview) {
      setShowPreview(false);
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await previewContractTemplate(tripId, text);
      if (result) {
        setPreviewText(result.contractText);
        setPreviewParticipant(result.participantName);
      }
      setShowPreview(true);
    } catch {
      toast.error('Nie udało się wygenerować podglądu');
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <>
      {/* Przycisk */}
      {compact ? (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl ring-1 ring-gray-200 transition-colors"
        >
          <FileText className="h-4 w-4" />
          Wzór umowy
          {isActive && <ShieldCheck className="h-3.5 w-3.5 text-green-600" />}
        </button>
      ) : (
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <FileText className="mr-2 h-4 w-4" />
          Wzór umowy
          {isActive && (
            <span className="ml-2 inline-flex items-center">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
            </span>
          )}
        </Button>
      )}

      {/* Dialog z edytorem */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between gap-4 pr-8">
              <DialogTitle className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-600" />
                Wzór umowy uczestnictwa
                {isActive ? (
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    Aktywna
                  </Badge>
                ) : initialTemplate ? (
                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                    <ShieldAlert className="mr-1 h-3 w-3" />
                    Draft
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-400">Brak wzoru</Badge>
                )}
              </DialogTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Każdy rodzic który potwierdzi wyjazd automatycznie otrzyma umowę wypełnioną jego danymi
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {/* Edytor tekstu */}
            {!showPreview && (
              <div className="space-y-2">
                <Textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="font-mono text-xs leading-relaxed min-h-[420px] resize-y"
                  placeholder="Wklej treść wzoru umowy..."
                />
                <p className="text-xs text-muted-foreground">
                  Placeholdery:{' '}
                  {['{{trip_title}}', '{{child_name}}', '{{parent_name}}', '{{parent_email}}', '{{trip_departure}}', '{{trip_return}}', '{{trip_location}}', '{{child_birth_date}}', '{{today_date}}'].map((p) => (
                    <code key={p} className="bg-gray-100 px-1 rounded mr-1">{p}</code>
                  ))}
                </p>
              </div>
            )}

            {/* Podgląd */}
            {showPreview && previewText && (
              <div className="space-y-2">
                {previewParticipant ? (
                  <p className="text-xs text-blue-600 flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Podgląd wypełniony danymi: <strong>{previewParticipant}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-amber-600 flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Brak uczestników — podgląd z placeholderami
                  </p>
                )}
                <ContractDocument text={previewText} />
              </div>
            )}
          </div>

          {/* Akcje na dole dialogu */}
          <div className="shrink-0 border-t pt-4 flex flex-wrap items-center gap-2">
            {/* Podgląd toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePreview}
              disabled={previewLoading}
            >
              {previewLoading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : showPreview ? (
                <EyeOff className="mr-2 h-3.5 w-3.5" />
              ) : (
                <Eye className="mr-2 h-3.5 w-3.5" />
              )}
              {showPreview ? 'Wróć do edytora' : 'Podgląd'}
            </Button>

            {/* Zapisz */}
            {!showPreview && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-2 h-3.5 w-3.5" />
                )}
                {hasUnsavedChanges ? 'Zapisz wzór' : 'Zapisano'}
              </Button>
            )}

            {/* Aktywuj / Dezaktywuj */}
            {isActive ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeactivate}
                disabled={isActivating}
                className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 hover:bg-red-50"
              >
                {isActivating ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldAlert className="mr-2 h-3.5 w-3.5" />
                )}
                Dezaktywuj
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleActivate}
                disabled={isActivating || hasUnsavedChanges || !initialTemplate}
                className="bg-green-600 hover:bg-green-700"
              >
                {isActivating ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-3.5 w-3.5" />
                )}
                Zatwierdź i aktywuj
              </Button>
            )}

            {hasUnsavedChanges && (
              <span className="text-xs text-amber-600 ml-1">• Niezapisane zmiany</span>
            )}

            <div className="ml-auto">
              <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                Zamknij
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
