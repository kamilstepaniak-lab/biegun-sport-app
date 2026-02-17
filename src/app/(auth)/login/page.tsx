import { LoginForm } from '@/components/auth';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 text-white font-bold text-xl mb-4">
            BS
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">BiegunSport</h1>
          <p className="text-sm text-gray-500">System zarządzania wyjazdami</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
