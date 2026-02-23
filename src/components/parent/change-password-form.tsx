'use client';

import { useState, useTransition } from 'react';
import { Eye, EyeOff, KeyRound, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { changePassword } from '@/lib/actions/profile';

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isValid = newPassword.length >= 8 && newPassword === confirmPassword;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    startTransition(async () => {
      const result = await changePassword(newPassword);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Hasło zostało zmienione');
        setNewPassword('');
        setConfirmPassword('');
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Zmiana hasła
        </CardTitle>
        <CardDescription>
          Ustaw nowe hasło do swojego konta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          <div className="space-y-1.5">
            <Label htmlFor="new_password">Nowe hasło</Label>
            <div className="relative">
              <Input
                id="new_password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 znaków"
                disabled={isPending}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword.length > 0 && newPassword.length < 8 && (
              <p className="text-xs text-amber-600">Hasło musi mieć co najmniej 8 znaków</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Potwierdź hasło</Label>
            <div className="relative">
              <Input
                id="confirm_password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Wpisz hasło ponownie"
                disabled={isPending}
                className={`pr-10 ${mismatch ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mismatch && (
              <p className="text-xs text-red-600">Hasła się nie zgadzają</p>
            )}
            {isValid && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" /> Hasła zgodne
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={!isValid || isPending}
          >
            {isPending ? 'Zmieniam...' : 'Zmień hasło'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
