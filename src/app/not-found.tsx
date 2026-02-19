import Link from 'next/link';
import { MapPin, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fb]">
      <div className="text-center space-y-6 px-4">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-purple-100">
            <MapPin className="h-10 w-10 text-purple-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">404</h1>
          <h2 className="text-xl font-semibold text-gray-700">Strona nie istnieje</h2>
          <p className="text-gray-500 max-w-sm mx-auto">
            Nie znaleziono strony którą próbujesz otworzyć.
            Mogła zostać przeniesiona lub usunięta.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Wróć do strony głównej
          </Link>
        </Button>
      </div>
    </div>
  );
}
