import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('work_report_auth', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
  return response;
}
