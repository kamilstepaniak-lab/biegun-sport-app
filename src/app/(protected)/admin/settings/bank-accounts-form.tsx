'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateBankAccounts, type BankAccounts } from '@/lib/actions/settings';

export function BankAccountsForm({ initial }: { initial: BankAccounts }) {
  const [pln, setPln] = useState(initial.bank_account_pln);
  const [eur, setEur] = useState(initial.bank_account_eur);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await updateBankAccounts({ bank_account_pln: pln, bank_account_eur: eur });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success('Konta bankowe zapisane');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Wspólne konto dla wszystkich wyjazdów. Numer jest pokazywany rodzicom na stronie płatności
        oraz w mailach i umowach.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="bank-pln">Konto PLN</Label>
        <Input
          id="bank-pln"
          value={pln}
          onChange={(e) => setPln(e.target.value)}
          placeholder="PL00 0000 0000 0000 0000 0000 0000"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bank-eur">Konto EUR</Label>
        <Input
          id="bank-eur"
          value={eur}
          onChange={(e) => setEur(e.target.value)}
          placeholder="PL00 0000 0000 0000 0000 0000 0000"
        />
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Zapisywanie…' : 'Zapisz konta'}
      </Button>
    </div>
  );
}
