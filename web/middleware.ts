import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE = 'work_report_auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Разрешаем только страницу входа и API логина/выхода — всё остальное требует авторизации
  if (pathname === '/login' || pathname === '/api/login' || pathname === '/api/logout') {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get(AUTH_COOKIE)?.value;

  if (!authCookie || authCookie !== 'authenticated') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Защищаем все маршруты кроме статики Next.js.
     * Важно: паттерн должен совпадать с "/" и всеми страницами.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
