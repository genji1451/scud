import { NextResponse } from 'next/server';
// Build-time import — работает на Vercel (fs.readFile недоступен в serverless)
import data from '@/data/work_summary.json';

// Убираем избыточные поля (work_hours, lunch_seconds и т.д.) — уменьшает объём на ~30%
type SlimRecord = {
  Сотрудник: string;
  Дата: string;
  'Первый вход': string;
  'Последний выход': string;
  net_seconds: number;
  net_minus_lunch_seconds: number;
  net_minus_smoke_seconds: number;
  breaks: Array<{ 'Время выхода': string; 'Время возвращения': string; Длительность_сек: number; Тип: string }>;
};

function slim(record: Record<string, unknown>): SlimRecord {
  return {
    Сотрудник: record['Сотрудник'] as string,
    Дата: record['Дата'] as string,
    'Первый вход': record['Первый вход'] as string,
    'Последний выход': record['Последний выход'] as string,
    net_seconds: record.net_seconds as number,
    net_minus_lunch_seconds: record.net_minus_lunch_seconds as number,
    net_minus_smoke_seconds: record.net_minus_smoke_seconds as number,
    breaks: (record.breaks as SlimRecord['breaks']) || [],
  };
}

export async function GET() {
  try {
    const slimmed = (data as Record<string, unknown>[]).map(slim);
    return new NextResponse(JSON.stringify(slimmed), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: 'Данные не найдены' },
      { status: 404 }
    );
  }
}
