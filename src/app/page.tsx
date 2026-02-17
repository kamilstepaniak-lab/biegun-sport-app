import Link from 'next/link';
import { ArrowRight, Mountain, Users, CreditCard, Calendar } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mountain className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold">BiegunSport</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" asChild>
            <Link href="/login">Zaloguj się</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Zarejestruj się</Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            System zarządzania wyjazdami narciarskimi
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Kompleksowe rozwiązanie dla szkół narciarskich. Zarządzaj uczestnikami,
            wyjazdami i płatnościami w jednym miejscu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">
                Rozpocznij teraz
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">
                Zaloguj się
              </Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Zarządzanie uczestnikami</CardTitle>
              <CardDescription>
                Łatwe dodawanie dzieci, przypisywanie do grup i śledzenie postępów.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Calendar className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Wyjazdy i zapisy</CardTitle>
              <CardDescription>
                Tworzenie wyjazdów, zarządzanie zapisami i automatyczna komunikacja.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CreditCard className="h-10 w-10 text-primary mb-2" />
              <CardTitle>System płatności</CardTitle>
              <CardDescription>
                Raty, karnety, zniżki i pełna historia wpłat w jednym miejscu.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Mountain className="h-10 w-10 text-primary mb-2" />
              <CardTitle>Grupy treningowe</CardTitle>
              <CardDescription>
                Organizacja uczestników w grupy według poziomu zaawansowania.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Groups Preview */}
        <div className="mt-16 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Nasze grupy treningowe</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {['Beeski', 'ProKids', 'Hero', 'SemiPRO', 'PRO'].map((group) => (
              <span
                key={group}
                className="px-4 py-2 rounded-full bg-primary/10 text-primary font-medium"
              >
                {group}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 mt-16 border-t">
        <div className="text-center text-sm text-muted-foreground">
          <p>&copy; 2026 BiegunSport. Wszystkie prawa zastrzeżone.</p>
        </div>
      </footer>
    </div>
  );
}
