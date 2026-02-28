import { LoginForm } from '@/components/auth';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex mb-4">
            <img src="/logo.png" alt="BSAPP" className="h-20 w-20 rounded-2xl object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">BiegunSport</h1>
          <p className="text-sm text-gray-500">System zarządzania wyjazdami</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
