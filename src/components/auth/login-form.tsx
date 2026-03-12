'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Loader2, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { login, signInWithGoogle, sendMagicLink } from '@/lib/actions/auth';
import { loginSchema, type LoginInput } from '@/lib/validations/auth';

type View = 'login' | 'magic-link' | 'magic-link-sent';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [view, setView] = useState<View>('login');
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setError(null);
    try {
      const result = await login(data);
      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'digest' in err) throw err;
      setError('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
      setIsLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (err && typeof err === 'object' && 'digest' in err) throw err;
      setError('Nie udało się zalogować przez Google');
      setIsGoogleLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!magicEmail) return;
    setMagicLoading(true);
    setMagicError(null);
    const result = await sendMagicLink(magicEmail);
    setMagicLoading(false);
    if (result?.error) {
      setMagicError(result.error);
    } else {
      setView('magic-link-sent');
    }
  }

  if (view === 'magic-link-sent') {
    return (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
        <div className="p-8 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sprawdź swoją skrzynkę</h2>
          <p className="text-sm text-gray-500 mb-1">Wysłaliśmy link do logowania na adres:</p>
          <p className="text-sm font-medium text-gray-900 mb-4">{magicEmail}</p>
          <p className="text-xs text-gray-400 mb-6">
            Link jest ważny przez 1 godzinę. Sprawdź też folder SPAM.
          </p>
          <button
            onClick={() => { setView('login'); setMagicEmail(''); }}
            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 mx-auto transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć do logowania
          </button>
        </div>
      </div>
    );
  }

  if (view === 'magic-link') {
    return (
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
        <div className="p-8">
          <button
            onClick={() => { setView('login'); setMagicError(null); }}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Wróć
          </button>
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Link do logowania</h2>
            <p className="text-sm text-gray-500 mt-1">
              Wyślemy Ci link, którym zalogujesz się bez hasła
            </p>
          </div>
          <form onSubmit={handleMagicLink} className="space-y-4">
            {magicError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {magicError}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
              <Input
                type="email"
                placeholder="jan.kowalski@email.com"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                disabled={magicLoading}
                required
                className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={magicLoading || !magicEmail}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {magicLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Wysyłanie...</>
              ) : 'Wyślij link'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-200/60 overflow-hidden">
      <div className="p-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">Zaloguj się</h2>
          <p className="text-sm text-gray-500 mt-1">
            Wprowadź swoje dane, aby uzyskać dostęp do konta
          </p>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isGoogleLoading || isLoading}
          className="w-full h-11 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mb-3"
        >
          {isGoogleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Zaloguj się przez Google
        </button>

        {/* Magic Link */}
        <button
          type="button"
          onClick={() => setView('magic-link')}
          disabled={isGoogleLoading || isLoading}
          className="w-full h-11 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 mb-4"
        >
          <Mail className="h-4 w-4 text-gray-500" />
          Zaloguj się przez email (bez hasła)
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400">lub</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="jan.kowalski@email.com"
                      autoComplete="email"
                      disabled={isLoading}
                      className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Hasło</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        disabled={isLoading}
                        className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                Zapomniałem hasła
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Logowanie...</>
              ) : 'Zaloguj się'}
            </button>
          </form>
        </Form>
      </div>

      <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Nie masz konta?{' '}
          <Link href="/register" className="text-gray-900 hover:underline font-medium">
            Zarejestruj się
          </Link>
        </p>
      </div>
    </div>
  );
}
