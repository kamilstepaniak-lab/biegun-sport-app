'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { login } from '@/lib/actions/auth';
import { loginSchema, type LoginInput } from '@/lib/validations/auth';

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
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
      // Jeśli result jest undefined/null to redirect() się wykonał — nie robimy nic
    } catch (err) {
      // Next.js redirect() rzuca wewnętrzny błąd — musimy go przepuścić
      if (err && typeof err === 'object' && 'digest' in err) {
        throw err;
      }
      setError('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.');
      setIsLoading(false);
    }
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
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Zapomniałem hasła
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logowanie...
                </>
              ) : (
                'Zaloguj się'
              )}
            </button>
          </form>
        </Form>
      </div>

      <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 text-center space-y-1">
        <p className="text-sm text-gray-500">
          Logujesz się pierwszy raz?{' '}
          <Link href="/forgot-password" className="text-gray-900 hover:underline font-medium">
            Ustaw hasło
          </Link>
        </p>
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
