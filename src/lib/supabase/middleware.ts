import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Publiczne ścieżki - dostępne bez logowania
  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/'];
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith('/api/auth'));

  // Jeśli użytkownik nie jest zalogowany i próbuje uzyskać dostęp do chronionej ścieżki
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Dla zalogowanego użytkownika — pobierz profil JEDNORAZOWO tylko gdy potrzebny do przekierowania
  const needsProfile =
    user &&
    (pathname === '/' ||
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/forgot-password' ||
      pathname.startsWith('/admin') ||
      pathname === '/parent' ||
      pathname === '/parent/');

  if (needsProfile) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user!.id)
      .single();

    const role = profile?.role;
    const url = request.nextUrl.clone();

    // Przekieruj z auth stron gdy już zalogowany
    // (NIE blokujemy /reset-password - użytkownik jest zalogowany przez callback i musi ustawić hasło)
    if (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password') {
      url.pathname = role === 'admin' ? '/admin/groups' : '/parent/children';
      return NextResponse.redirect(url);
    }

    // Przekieruj z głównej
    if (pathname === '/') {
      url.pathname = role === 'admin' ? '/admin/groups' : '/parent/children';
      return NextResponse.redirect(url);
    }

    // Blokuj dostęp do panelu admina dla nie-adminów
    if (pathname.startsWith('/admin') && role !== 'admin') {
      url.pathname = '/parent/children';
      return NextResponse.redirect(url);
    }

    // Przekieruj admina z /parent lub /parent/ do panelu admina
    if ((pathname === '/parent' || pathname === '/parent/') && role === 'admin') {
      url.pathname = '/admin/groups';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
