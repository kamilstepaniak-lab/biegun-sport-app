import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const type = searchParams.get('type'); // 'recovery', 'magiclink', 'signup' etc

  // Walidacja next — zapobieganie open redirect
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Jeśli reset hasła — przekieruj na stronę zmiany hasła
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      // Pobierz profil (trigger automatycznie go tworzy przy nowym koncie)
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, first_name')
        .eq('id', data.user.id)
        .single();

      // Nowy użytkownik przez Google OAuth — uzupełnij imię/nazwisko z metadanych
      if (data.user.app_metadata?.provider === 'google' && !profile?.first_name) {
        const meta = data.user.user_metadata;
        const fullName: string = meta?.full_name || meta?.name || '';
        const nameParts = fullName.split(' ');
        const firstName = meta?.given_name || nameParts[0] || '';
        const lastName = meta?.family_name || nameParts.slice(1).join(' ') || '';

        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email!,
          first_name: firstName || null,
          last_name: lastName || null,
          role: profile?.role || 'parent',
        });
      }

      // Przekieruj na właściwą stronę wg roli
      const role = profile?.role || 'parent';
      const redirectPath =
        safeNext !== '/'
          ? safeNext
          : role === 'admin'
            ? '/admin/groups'
            : '/parent/children';

      return NextResponse.redirect(`${origin}${redirectPath}`);
    }

    if (error) {
      console.error('Auth callback error:', error);
    }
  }

  // Jeśli błąd lub brak kodu - przekieruj na stronę logowania
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
