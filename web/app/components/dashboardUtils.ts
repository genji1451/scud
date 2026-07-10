import type { EnrichedWorkRow, PeriodMode, WorkRow } from './types';

export function enrichRows(rows: WorkRow[]): EnrichedWorkRow[] {
  return rows;
}

export function parseDate(value: string) {
  const [day, month, year] = value.split('.').map(Number);
  return new Date(year, month - 1, day);
}

export function toInputDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(value: Date) {
  return value.toLocaleDateString('ru-RU');
}

export function getYearWeek(dateStr: string): string {
  const dt = parseDate(dateStr);
  const onejan = new Date(dt.getFullYear(), 0, 1);
  const week = Math.ceil((((dt.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
  return `${dt.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function getQuarterKey(dateStr: string): string {
  const dt = parseDate(dateStr);
  return `${dt.getFullYear()}-Q${Math.floor(dt.getMonth() / 3) + 1}`;
}

export function getMonthKey(dateStr: string): string {
  const dt = parseDate(dateStr);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function formatHours(hours: number) {
  const totalMinutes = Math.max(0, Math.round(hours * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return '0 ч';
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} м`;
}

export function formatSeconds(seconds: number) {
  return formatHours(seconds / 3600);
}

export function sumSeconds(rows: EnrichedWorkRow[], selector: (row: EnrichedWorkRow) => number) {
  return rows.reduce((sum, row) => sum + (selector(row) || 0), 0);
}

export function getBreakSeconds(row: EnrichedWorkRow, predicate: (type: string) => boolean) {
  return (row.breaks || []).reduce((sum, item) => sum + (predicate(item.Тип) ? item.Длительность_сек || 0 : 0), 0);
}

export function filterByPeriod(rows: EnrichedWorkRow[], mode: PeriodMode, customStart: string, customEnd: string) {
  if (!rows.length) return rows;
  const sorted = [...rows].sort((a, b) => parseDate(a.Дата).getTime() - parseDate(b.Дата).getTime());
  const latest = sorted[sorted.length - 1];

  if (mode === 'day') return rows.filter((row) => row.Дата === latest.Дата);
  if (mode === 'week') {
    const week = getYearWeek(latest.Дата);
    return rows.filter((row) => getYearWeek(row.Дата) === week);
  }
  if (mode === 'month') {
    const month = getMonthKey(latest.Дата);
    return rows.filter((row) => getMonthKey(row.Дата) === month);
  }
  if (mode === 'quarter') {
    const quarter = getQuarterKey(latest.Дата);
    return rows.filter((row) => getQuarterKey(row.Дата) === quarter);
  }
  if (customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    return rows.filter((row) => {
      const date = parseDate(row.Дата);
      return date >= start && date <= end;
    });
  }
  return rows;
}

export function getPeriodLabel(rows: EnrichedWorkRow[]) {
  if (!rows.length) return 'Нет данных';
  const dates = rows.map((row) => parseDate(row.Дата)).sort((a, b) => a.getTime() - b.getTime());
  return `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`;
}

export function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, T[]>();
  items.forEach((item) => {
    const key = getKey(item);
    map.set(key, [...(map.get(key) || []), item]);
  });
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}
