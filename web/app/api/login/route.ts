import { NextRequest, NextResponse } from 'next/server';

const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SUPER_ADMIN_LOGIN = process.env.SUPER_ADMIN_LOGIN || 'superadmin';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'superadmin123';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { login, password } = body;

    if (!login || !password) {
      return NextResponse.json(
        { success: false, error: 'Введите логин и пароль' },
        { status: 400 }
      );
    }

    const isSuper = login === SUPER_ADMIN_LOGIN && password === SUPER_ADMIN_PASSWORD;
    const isAdmin = login === ADMIN_LOGIN && password === ADMIN_PASSWORD;

    if (isSuper || isAdmin) {
      const role = isSuper ? 'super_admin' : 'admin';
      const response = NextResponse.json({ success: true, role });
      response.cookies.set('work_report_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 дней
        path: '/',
      });
      response.cookies.set('work_report_role', role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    }

    return NextResponse.json(
      { success: false, error: 'Неверный логин или пароль' },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
