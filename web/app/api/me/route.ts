import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const store = cookies();
  const auth = store.get('work_report_auth')?.value;
  const role = store.get('work_report_role')?.value || 'admin';
  if (auth !== 'authenticated') {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, role });
}

