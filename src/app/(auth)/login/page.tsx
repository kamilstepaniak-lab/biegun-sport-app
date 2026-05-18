import Image from 'next/image';
import { LoginForm } from '@/components/auth';

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'Nie udało się dokończyć logowania. Link mógł wygasnąć — spróbuj ponownie.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError = error ? ERROR_MESSAGES[error] ?? null : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex mb-4">
            <Image src="/logo.png" alt="BSAPP" width={80} height={80} className="rounded-2xl object-cover" priority />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">BiegunSport</h1>
          <p className="text-sm text-gray-500">System zarządzania wyjazdami</p>
        </div>
        <LoginForm initialError={initialError} />
      </div>
    </div>
  );
}
