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

  // Jeśli użytkownik jest zalogowany i próbuje uzyskać dostęp do logowania/rejestracji
  // (ale NIE blokujemy /reset-password - użytkownik jest zalogowany przez callback i musi ustawić hasło)
  if (user && (pathname === '/login' || pathname === '/register' || pathname === '/forgot-password')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'admin' ? '/admin/groups' : '/parent/children';
    return NextResponse.redirect(url);
  }

  // Sprawdź dostęp do panelu admina
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/parent/children';
      return NextResponse.redirect(url);
    }
  }

  // Sprawdź dostęp do panelu rodzica
  if (user && pathname.startsWith('/parent')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'admin' && !pathname.includes('parent')) {
      if (pathname === '/parent' || pathname === '/parent/') {
        const url = request.nextUrl.clone();
        url.pathname = '/admin/groups';
        return NextResponse.redirect(url);
      }
    }
  }

  // Przekierowanie z głównej strony
  if (user && pathname === '/') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === 'admin' ? '/admin/groups' : '/parent/children';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
