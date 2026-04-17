'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createExternalChild } from '@/lib/actions/external-children';
import type { Group } from '@/types';

interface AddExternalChildDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: Group[];
}

interface FormState {
  parent_email: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_phone: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  height_cm: string;
  group_id: string;
}

const INITIAL: FormState = {
  parent_email: '',
  parent_first_name: '',
  parent_last_name: '',
  parent_phone: '',
  first_name: '',
  last_name: '',
  birth_date: '',
  height_cm: '',
  group_id: '',
};

export function AddExternalChildDialog({ open, onOpenChange, groups }: AddExternalChildDialogProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function reset() {
    setForm(INITIAL);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await createExternalChild({
        parent_email: form.parent_email.trim(),
        parent_first_name: form.parent_first_name.trim(),
        parent_last_name: form.parent_last_name.trim(),
        parent_phone: form.parent_phone.trim() || undefined,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        birth_date: form.birth_date,
        height_cm: form.height_cm ? Number(form.height_cm) : null,
        group_id: form.group_id || null,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Dziecko dodane. Rodzic otrzyma email z linkiem do ustawienia hasła.');
        reset();
        onOpenChange(false);
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      toast.error('Wystąpił nieoczekiwany błąd');
    } finally {
      setIsSubmitting(false);
    }
  }

  const isValid =
    form.parent_email.trim() &&
    form.parent_first_name.trim() &&
    form.parent_last_name.trim() &&
    form.first_name.trim().length >= 2 &&
    form.last_name.trim().length >= 2 &&
    form.birth_date;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Dodaj dziecko z zewnątrz
          </DialogTitle>
          <DialogDescription>
            System utworzy konto rodzica i wyśle email z linkiem do ustawienia hasła.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Dane rodzica</h3>
            <div className="space-y-2">
              <Label htmlFor="parent_email">Email *</Label>
              <Input
                id="parent_email"
                type="email"
                required
                value={form.parent_email}
                onChange={(e) => update('parent_email', e.target.value)}
                placeholder="rodzic@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="parent_first_name">Imię *</Label>
                <Input
                  id="parent_first_name"
                  required
                  value={form.parent_first_name}
                  onChange={(e) => update('parent_first_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parent_last_name">Nazwisko *</Label>
                <Input
                  id="parent_last_name"
                  required
                  value={form.parent_last_name}
                  onChange={(e) => update('parent_last_name', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_phone">Telefon</Label>
              <Input
                id="parent_phone"
                type="tel"
                value={form.parent_phone}
                onChange={(e) => update('parent_phone', e.target.value)}
                placeholder="+48 ..."
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Dane dziecka</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="child_first_name">Imię *</Label>
                <Input
                  id="child_first_name"
                  required
                  value={form.first_name}
                  onChange={(e) => update('first_name', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="child_last_name">Nazwisko *</Label>
                <Input
                  id="child_last_name"
                  required
                  value={form.last_name}
                  onChange={(e) => update('last_name', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="birth_date">Data urodzenia *</Label>
                <Input
                  id="birth_date"
                  type="date"
                  required
                  value={form.birth_date}
                  onChange={(e) => update('birth_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height_cm">Wzrost (cm)</Label>
                <Input
                  id="height_cm"
                  type="number"
                  min="0"
                  max="250"
                  value={form.height_cm}
                  onChange={(e) => update('height_cm', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="group_id">Grupa</Label>
              <select
                id="group_id"
                value={form.group_id}
                onChange={(e) => update('group_id', e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-white ring-1 ring-gray-200 border-0 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
              >
                <option value="">— Brak (jednorazowy event) —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                Pozostaw puste dla dzieci biorących udział tylko w jednorazowych eventach.
              </p>
            </div>
          </section>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Dodaj dziecko
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
