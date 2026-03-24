export type ManualOverride = {
  employee: string;
  date: string; // DD.MM.YYYY
  firstIn?: string;
  lastOut?: string;
  netSeconds?: number;
  netMinusLunchSeconds?: number;
  netMinusSmokeSeconds?: number;
};

export const MANUAL_OVERRIDES_KEY = 'work_report_manual_overrides_v1';

export function getManualOverrides(): ManualOverride[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MANUAL_OVERRIDES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ManualOverride[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveManualOverrides(items: ManualOverride[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(MANUAL_OVERRIDES_KEY, JSON.stringify(items));
}

export function upsertManualOverride(item: ManualOverride) {
  const current = getManualOverrides();
  const idx = current.findIndex(
    (x) => x.employee === item.employee && x.date === item.date
  );
  if (idx >= 0) current[idx] = item;
  else current.push(item);
  saveManualOverrides(current);
}

export function removeManualOverride(employee: string, date: string) {
  const current = getManualOverrides();
  const next = current.filter((x) => !(x.employee === employee && x.date === date));
  saveManualOverrides(next);
}

export function applyManualOverrides<T extends Record<string, unknown>>(rows: T[]): T[] {
  const overrides = getManualOverrides();
  if (!overrides.length) return rows;

  const byKey = new Map<string, ManualOverride>();
  overrides.forEach((o) => byKey.set(`${o.employee}__${o.date}`, o));

  return rows.map((row) => {
    const employee = String(row['Сотрудник'] || '');
    const date = String(row['Дата'] || '');
    const hit = byKey.get(`${employee}__${date}`);
    if (!hit) return row;
    return {
      ...row,
      ...(hit.firstIn ? { 'Первый вход': hit.firstIn } : {}),
      ...(hit.lastOut ? { 'Последний выход': hit.lastOut } : {}),
      ...(typeof hit.netSeconds === 'number' ? { net_seconds: hit.netSeconds } : {}),
      ...(typeof hit.netMinusLunchSeconds === 'number'
        ? { net_minus_lunch_seconds: hit.netMinusLunchSeconds }
        : {}),
      ...(typeof hit.netMinusSmokeSeconds === 'number'
        ? { net_minus_smoke_seconds: hit.netMinusSmokeSeconds }
        : {}),
    } as T;
  });
}

