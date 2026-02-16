import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'work_summary.json');
    const data = await readFile(filePath, 'utf-8');
    const json = JSON.parse(data);
    return NextResponse.json(json);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Данные не найдены' },
      { status: 404 }
    );
  }
}
