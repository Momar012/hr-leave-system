import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Public routes that don't need auth
  const publicRoutes = ['/login', '/auth/callback'];
  if (publicRoutes.some(r => path.startsWith(r))) {
    if (user) {
      // Already logged in, redirect to appropriate page
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'manager') {
        return NextResponse.redirect(new URL('/manager/dashboard', request.url));
      }
      return NextResponse.redirect(new URL('/employee/chat', request.url));
    }
    return supabaseResponse;
  }

  // Protected routes - require auth
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Role-based routing
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect employee trying to access manager routes
  if (path.startsWith('/manager') && profile.role !== 'manager') {
    return NextResponse.redirect(new URL('/employee/chat', request.url));
  }

  // Redirect manager trying to access employee routes
  if (path.startsWith('/employee') && profile.role !== 'employee') {
    return NextResponse.redirect(new URL('/manager/dashboard', request.url));
  }

  // Redirect root to appropriate dashboard
  if (path === '/') {
    if (profile.role === 'manager') {
      return NextResponse.redirect(new URL('/manager/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/employee/chat', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
