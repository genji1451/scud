export type BreakItem = {
  'Время выхода': string;
  'Время возвращения': string;
  Длительность_сек: number;
  Тип: string;
};

export type WorkRow = {
  Сотрудник: string;
  Дата: string;
  'Первый вход': string;
  'Последний выход': string;
  net_seconds: number;
  net_minus_lunch_seconds: number;
  net_minus_smoke_seconds: number;
  breaks: BreakItem[];
};

export type EnrichedWorkRow = WorkRow & {
  department: string;
};

export type PeriodMode = 'day' | 'week' | 'month' | 'quarter' | 'custom';
