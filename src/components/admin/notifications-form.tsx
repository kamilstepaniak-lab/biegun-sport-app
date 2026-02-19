'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Send, Users, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

import { notificationSchema, type NotificationInput } from '@/lib/validations/notification';
import { createNotification, approveNotification, sendNotification } from '@/lib/actions/notifications';
import type { Group, Trip } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Badge } from '@/components/ui/badge';

interface NotificationsFormProps {
  groups: Group[];
  trips: Trip[];
  onSuccess?: () => void;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  payment_reminder: 'Przypomnienie o płatności',
  new_trip: 'Nowy wyjazd',
  trip_update: 'Aktualizacja wyjazdu',
  custom: 'Własna wiadomość',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  all: 'Wszyscy rodzice',
  group: 'Konkretna grupa',
  trip: 'Uczestnicy wyjazdu',
  individual: 'Indywidualny rodzic',
};

export function NotificationsForm({ groups, trips, onSuccess }: NotificationsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<'compose' | 'preview'>('compose');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendResult, setSendResult] = useState<{ sentCount: number; failedCount: number } | null>(null);

  const form = useForm<NotificationInput>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      notification_type: 'custom',
      target_type: 'all',
      channel: 'email',
      subject: '',
      body: '',
    },
  });

  const targetType = form.watch('target_type');

  function onSubmitDraft(data: NotificationInput) {
    startTransition(async () => {
      const result = await createNotification(data);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDraftId(result.id!);
      setRecipientCount(result.recipientCount!);
      setStep('preview');
    });
  }

  function onApproveAndSend() {
    setShowSendConfirm(true);
  }

  function onConfirmSend() {
    if (!draftId) return;
    setShowSendConfirm(false);

    startTransition(async () => {
      // Zatwierdź
      const approveResult = await approveNotification(draftId);
      if (approveResult.error) {
        toast.error(approveResult.error);
        return;
      }

      // Wyślij
      const sendResult = await sendNotification(draftId);
      if (sendResult.error) {
        toast.error(sendResult.error);
        return;
      }

      setSendResult({ sentCount: sendResult.sentCount!, failedCount: sendResult.failedCount! });
      toast.success(`Wysłano ${sendResult.sentCount} emaili`);
      onSuccess?.();
    });
  }

  function resetForm() {
    form.reset();
    setStep('compose');
    setDraftId(null);
    setRecipientCount(null);
    setSendResult(null);
  }

  // Wynik wysyłki
  if (sendResult) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <h3 className="text-lg font-semibold">Wysyłka zakończona</h3>
        <div className="flex gap-3">
          <Badge variant="default">{sendResult.sentCount} wysłanych</Badge>
          {sendResult.failedCount > 0 && (
            <Badge variant="destructive">{sendResult.failedCount} błędów</Badge>
          )}
        </div>
        <Button variant="outline" onClick={resetForm}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Nowe powiadomienie
        </Button>
      </div>
    );
  }

  // Podgląd przed wysłaniem
  if (step === 'preview') {
    const data = form.getValues();
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <h3 className="font-semibold">Podgląd powiadomienia</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Typ:</span>
            <span>{NOTIFICATION_TYPE_LABELS[data.notification_type]}</span>
            <span className="text-muted-foreground">Odbiorcy:</span>
            <span>{TARGET_TYPE_LABELS[data.target_type]}</span>
            <span className="text-muted-foreground">Kanał:</span>
            <span className="capitalize">{data.channel === 'email' ? 'Email (Gmail)' : data.channel}</span>
            <span className="text-muted-foreground">Liczba odbiorców:</span>
            <span className="font-semibold text-primary">{recipientCount ?? '—'}</span>
          </div>
          <hr />
          <div className="space-y-1">
            <p className="text-sm font-medium">Temat: {data.subject}</p>
            <div className="whitespace-pre-wrap rounded border bg-background p-3 text-sm">
              {data.body}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep('compose')} disabled={isPending}>
            Wróć do edycji
          </Button>
          <Button onClick={onApproveAndSend} disabled={isPending || recipientCount === 0}>
            {isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wysyłanie…</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Wyślij do {recipientCount} odbiorców</>
            )}
          </Button>
        </div>

        {recipientCount === 0 && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <XCircle className="h-4 w-4" />
            Brak odbiorców dla wybranych kryteriów.
          </p>
        )}

        <AlertDialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Potwierdź wysyłkę</AlertDialogTitle>
              <AlertDialogDescription>
                Wyślesz email do <strong>{recipientCount}</strong> odbiorców. Tej operacji nie można cofnąć.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirmSend}>
                <Send className="mr-2 h-4 w-4" />
                Wyślij
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Formularz tworzenia
  return (
    <form onSubmit={form.handleSubmit(onSubmitDraft)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Typ powiadomienia */}
        <div className="space-y-1.5">
          <Label>Typ powiadomienia</Label>
          <Select
            value={form.watch('notification_type')}
            onValueChange={(v) => form.setValue('notification_type', v as NotificationInput['notification_type'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanał */}
        <div className="space-y-1.5">
          <Label>Kanał wysyłki</Label>
          <Select
            value={form.watch('channel')}
            onValueChange={(v) => form.setValue('channel', v as NotificationInput['channel'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email (Gmail)</SelectItem>
              <SelectItem value="sms" disabled>SMS (niedostępny)</SelectItem>
              <SelectItem value="both" disabled>Email + SMS (niedostępny)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Typ odbiorców */}
        <div className="space-y-1.5">
          <Label>Odbiorcy</Label>
          <Select
            value={targetType}
            onValueChange={(v) => {
              form.setValue('target_type', v as NotificationInput['target_type']);
              form.setValue('target_group_id', null);
              form.setValue('target_trip_id', null);
              form.setValue('target_user_id', null);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Wybór grupy */}
        {targetType === 'group' && (
          <div className="space-y-1.5">
            <Label>Grupa</Label>
            <Select
              value={form.watch('target_group_id') ?? ''}
              onValueChange={(v) => form.setValue('target_group_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz grupę" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.target_group_id && (
              <p className="text-xs text-destructive">{form.formState.errors.target_group_id.message}</p>
            )}
          </div>
        )}

        {/* Wybór wyjazdu */}
        {targetType === 'trip' && (
          <div className="space-y-1.5">
            <Label>Wyjazd</Label>
            <Select
              value={form.watch('target_trip_id') ?? ''}
              onValueChange={(v) => form.setValue('target_trip_id', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Wybierz wyjazd" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.target_trip_id && (
              <p className="text-xs text-destructive">{form.formState.errors.target_trip_id.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Temat */}
      <div className="space-y-1.5">
        <Label htmlFor="subject">Temat emaila</Label>
        <Input
          id="subject"
          placeholder="np. Przypomnienie o płatności za obóz letni"
          {...form.register('subject')}
        />
        {form.formState.errors.subject && (
          <p className="text-xs text-destructive">{form.formState.errors.subject.message}</p>
        )}
      </div>

      {/* Treść */}
      <div className="space-y-1.5">
        <Label htmlFor="body">Treść wiadomości</Label>
        <textarea
          id="body"
          rows={8}
          className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          placeholder="Treść emaila wysyłanego do rodziców…"
          {...form.register('body')}
        />
        {form.formState.errors.body && (
          <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Users className="h-3 w-3" />
          Podgląd odbiorców po kliknięciu &quot;Dalej&quot;
        </p>
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Przygotowywanie…</>
          ) : (
            'Dalej – podgląd'
          )}
        </Button>
      </div>
    </form>
  );
}
