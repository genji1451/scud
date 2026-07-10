'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppShell } from '@/app/components/AppShell';
import { ChartCard, DataTable, FilterBar, StatCard } from '@/app/components/DashboardParts';
import {
  enrichRows,
  filterByPeriod,
  formatSeconds,
  getBreakSeconds,
  getPeriodLabel,
  groupBy,
  parseDate,
  sumSeconds,
  toInputDate,
} from '@/app/components/dashboardUtils';
import { applyManualOverrides } from '@/lib/manualOverrides';
import type { EnrichedWorkRow, PeriodMode, WorkRow } from '@/app/components/types';

const COLORS = ['#B0184B', '#EAB308', '#7C3AED', '#64748B'];

export default function DashboardPage() {
  const router = useRouter();
  const [rawData, setRawData] = useState<WorkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedEmployee, setSelectedEmployee] = useState('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const response = await fetch('/api/data', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) throw new Error('Данные не загружены');
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Сессия истекла. Откройте /login и войдите заново.');
        }
        const data = await response.json() as WorkRow[];
        if (!cancelled) hydrateRows(data);
      } catch (apiError) {
        try {
          const fallback = await fetch('/work_summary.json', { cache: 'no-store' });
          if (!fallback.ok) throw apiError;
          const data = await fallback.json() as WorkRow[];
          if (!cancelled) hydrateRows(data);
        } catch (fallbackError) {
          if (!cancelled) {
            const message = fallbackError instanceof Error ? fallbackError.message : 'Ошибка загрузки данных';
            setError(message);
            setLoading(false);
          }
        }
      }
    }

    function hydrateRows(data: WorkRow[]) {
      const rows = applyManualOverrides(data);
      setRawData(rows);
      const completedRows = enrichRows(rows);
      const dates = completedRows.map((row) => parseDate(row.Дата)).sort((a, b) => a.getTime() - b.getTime());
      if (dates.length) {
        setCustomStart(toInputDate(dates[0]));
        setCustomEnd(toInputDate(dates[dates.length - 1]));
      }
      setLoading(false);
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  }

  const rows = useMemo(() => enrichRows(rawData), [rawData]);
  const employees = useMemo(() => Array.from(new Set(rows.map((row) => row.Сотрудник))).sort(), [rows]);

  const filteredRows = useMemo(() => {
    let next = filterByPeriod(rows, periodMode, customStart, customEnd);
    if (selectedEmployee !== 'ALL') next = next.filter((row) => row.Сотрудник === selectedEmployee);
    return next;
  }, [rows, periodMode, customStart, customEnd, selectedEmployee]);

  const analytics = useMemo(() => buildAnalytics(filteredRows, rows), [filteredRows, rows]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader-card">Загрузка выгрузки СКУД...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-screen">
        <div className="loader-card error">
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>Обновить страницу</button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title="Обзор"
      subtitle="Отчет по рабочему времени на основе загруженной выгрузки СКУД"
      lastImport={analytics.lastImport}
      onLogout={handleLogout}
    >
      <FilterBar
        periodMode={periodMode}
        onPeriodModeChange={setPeriodMode}
        employee={selectedEmployee}
        onEmployeeChange={setSelectedEmployee}
        employees={employees}
        customStart={customStart}
        customEnd={customEnd}
        onCustomStartChange={setCustomStart}
        onCustomEndChange={setCustomEnd}
      />

      <section className="stats-grid" id="analytics">
        {analytics.cards.map((card, index) => (
          <StatCard key={card.label} {...card} delay={index * 0.035} />
        ))}
      </section>

      <section className="charts-grid" id="charts">
        <ChartCard title="Сводка по дням" subtitle="Чистое рабочее время по датам" wide>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={analytics.dailyChart}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke="#94A3B8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94A3B8" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(176,24,75,0.12)' }} />
              <Bar dataKey="hours" name="Часы" radius={[10, 10, 4, 4]} fill="#B0184B" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Структура времени" subtitle="Работа, обеды, перекуры и прочие перерывы">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={analytics.timeStructure} dataKey="value" nameKey="name" innerRadius={70} outerRadius={105} paddingAngle={3}>
                {analytics.timeStructure.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatSeconds(Number(value) * 3600)} />
              <Legend iconType="circle" wrapperStyle={{ color: '#CBD5E1' }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Топ сотрудников" subtitle="Суммарные часы в выбранном периоде">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.employeeChart} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
              <XAxis type="number" stroke="#94A3B8" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="employee" stroke="#94A3B8" width={130} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(176,24,75,0.12)' }} />
              <Bar dataKey="hours" name="Часы" radius={[0, 10, 10, 0]} fill="#9A123F" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Динамика рабочего времени" subtitle="Линия тренда по дням" wide>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={analytics.dailyChart}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke="#94A3B8" tickLine={false} axisLine={false} />
              <YAxis stroke="#94A3B8" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="hours" name="Часы" stroke="#F43F5E" strokeWidth={3} dot={{ r: 3, fill: '#F43F5E' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <DataTable
        id="employees"
        title="Сотрудники"
        subtitle="Итоги по каждому сотруднику в выбранном периоде"
        columns={[
          { key: 'employee', label: 'Сотрудник' },
          { key: 'workTime', label: 'Рабочее время' },
          { key: 'breaks', label: 'Перерывы' },
          { key: 'lunches', label: 'Обеды' },
          { key: 'firstIn', label: 'Первый приход' },
          { key: 'lastOut', label: 'Последний уход' },
          { key: 'avgDay', label: 'Среднее в день' },
          { key: 'days', label: 'Дней в периоде' },
        ]}
        rows={analytics.employeeRows}
      />

      <DataTable
        id="timesheet"
        title="Детализация по дням"
        subtitle="Первые 120 строк выбранного периода"
        columns={[
          { key: 'employee', label: 'Сотрудник' },
          { key: 'date', label: 'Дата' },
          { key: 'firstIn', label: 'Пришел' },
          { key: 'lastOut', label: 'Ушел' },
          { key: 'net', label: 'Чистое время' },
          { key: 'minusLunch', label: 'Минус обед' },
          { key: 'minusSmoke', label: 'Минус перекуры' },
          { key: 'breaks', label: 'Перерывы' },
        ]}
        rows={analytics.dailyRows}
      />

      <DataTable
        id="reports"
        title="Детализация перерывов"
        subtitle="Обеды, перекуры и прочие выходы из СКУД"
        columns={[
          { key: 'employee', label: 'Сотрудник' },
          { key: 'date', label: 'Дата' },
          { key: 'type', label: 'Тип' },
          { key: 'out', label: 'Время выхода' },
          { key: 'back', label: 'Время возвращения' },
          { key: 'duration', label: 'Длительность' },
        ]}
        rows={analytics.breakRows}
      />
    </AppShell>
  );
}

function buildAnalytics(filteredRows: EnrichedWorkRow[], allRows: EnrichedWorkRow[]) {
  const totalEmployees = new Set(filteredRows.map((row) => row.Сотрудник)).size;
  const totalWorkSeconds = sumSeconds(filteredRows, (row) => row.net_seconds);
  const lunchSeconds = filteredRows.reduce((sum, row) => sum + getBreakSeconds(row, (type) => type === 'Обед'), 0);
  const smokeSeconds = filteredRows.reduce((sum, row) => sum + getBreakSeconds(row, (type) => type === 'Перекур'), 0);
  const otherBreakSeconds = filteredRows.reduce((sum, row) => sum + getBreakSeconds(row, (type) => type !== 'Обед' && type !== 'Перекур'), 0);
  const breaksSeconds = smokeSeconds + otherBreakSeconds;
  const workingDays = new Set(filteredRows.map((row) => row.Дата)).size;
  const avgDay = workingDays ? totalWorkSeconds / workingDays : 0;
  const lastDate = allRows.length
    ? allRows.map((row) => parseDate(row.Дата)).sort((a, b) => b.getTime() - a.getTime())[0].toLocaleDateString('ru-RU')
    : 'Нет данных';

  const byEmployee = groupBy(filteredRows, (row) => row.Сотрудник)
    .map(({ key, value }) => {
      const firstSorted = [...value].sort((a, b) => a['Первый вход'].localeCompare(b['Первый вход']));
      const lastSorted = [...value].sort((a, b) => b['Последний выход'].localeCompare(a['Последний выход']));
      const work = sumSeconds(value, (row) => row.net_seconds);
      const breaks = value.reduce((sum, row) => sum + getBreakSeconds(row, (type) => type !== 'Обед'), 0);
      const lunches = value.reduce((sum, row) => sum + getBreakSeconds(row, (type) => type === 'Обед'), 0);
      const days = new Set(value.map((row) => row.Дата)).size;
      return {
        employee: key,
        work,
        breaks,
        lunches,
        firstIn: firstSorted[0]?.['Первый вход'] || '-',
        lastOut: lastSorted[0]?.['Последний выход'] || '-',
        days,
      };
    })
    .sort((a, b) => b.work - a.work);

  const productive = byEmployee[0];
  const breakLeader = [...byEmployee].sort((a, b) => b.breaks - a.breaks)[0];

  const dailyChart = groupBy(filteredRows, (row) => row.Дата)
    .map(({ key, value }) => ({
      date: key.slice(0, 5),
      fullDate: key,
      hours: Number((sumSeconds(value, (row) => row.net_seconds) / 3600).toFixed(2)),
    }))
    .sort((a, b) => parseDate(a.fullDate).getTime() - parseDate(b.fullDate).getTime());

  const employeeChart = byEmployee.slice(0, 8).map((item) => ({
    employee: item.employee.split(' ').slice(0, 2).join(' '),
    hours: Number((item.work / 3600).toFixed(2)),
  }));

  return {
    totalEmployees,
    lastImport: lastDate,
    periodLabel: getPeriodLabel(filteredRows),
    cards: [
      { label: 'Всего сотрудников', value: String(totalEmployees), note: 'В выбранной выгрузке' },
      { label: 'Отработано всего', value: formatSeconds(totalWorkSeconds), note: 'Чистое рабочее время', tone: 'accent' as const },
      { label: 'Перерывы всего', value: formatSeconds(breaksSeconds), note: 'Без учета обедов' },
      { label: 'Обеды всего', value: formatSeconds(lunchSeconds), note: 'По отметкам СКУД' },
      { label: 'Средний рабочий день', value: formatSeconds(avgDay), note: `${workingDays} рабочих дней` },
      { label: 'Самый продуктивный сотрудник', value: productive?.employee || '-', note: productive ? formatSeconds(productive.work) : undefined, tone: 'accent' as const },
      { label: 'Максимум перерывов', value: breakLeader?.employee || '-', note: breakLeader ? formatSeconds(breakLeader.breaks) : undefined },
      { label: 'Рабочих дней', value: String(workingDays), note: 'Уникальные даты периода' },
    ],
    dailyChart,
    employeeChart,
    timeStructure: [
      { name: 'Рабочее время', value: Number((totalWorkSeconds / 3600).toFixed(2)) },
      { name: 'Обеды', value: Number((lunchSeconds / 3600).toFixed(2)) },
      { name: 'Перекуры', value: Number((smokeSeconds / 3600).toFixed(2)) },
      { name: 'Прочие перерывы', value: Number((otherBreakSeconds / 3600).toFixed(2)) },
    ].filter((item) => item.value > 0),
    employeeRows: byEmployee.map((item) => ({
      employee: item.employee,
      workTime: formatSeconds(item.work),
      breaks: formatSeconds(item.breaks),
      lunches: formatSeconds(item.lunches),
      firstIn: item.firstIn,
      lastOut: item.lastOut,
      avgDay: formatSeconds(item.days ? item.work / item.days : 0),
      days: String(item.days),
    })),
    dailyRows: [...filteredRows]
      .sort((a, b) => parseDate(b.Дата).getTime() - parseDate(a.Дата).getTime())
      .slice(0, 120)
      .map((row) => ({
        employee: row.Сотрудник,
        date: row.Дата,
        firstIn: row['Первый вход'] || '-',
        lastOut: row['Последний выход'] || '-',
        net: formatSeconds(row.net_seconds),
        minusLunch: formatSeconds(row.net_minus_lunch_seconds),
        minusSmoke: formatSeconds(row.net_minus_smoke_seconds),
        breaks: row.breaks?.length ? `${row.breaks.length} шт.` : '-',
      })),
    breakRows: filteredRows
      .flatMap((row) => (row.breaks || []).map((item) => ({
        employee: row.Сотрудник,
        date: row.Дата,
        type: <span className={`break-chip ${item.Тип === 'Обед' ? 'lunch' : 'break'}`}>{item.Тип}</span>,
        out: item['Время выхода'],
        back: item['Время возвращения'],
        duration: formatSeconds(item.Длительность_сек),
      })))
      .slice(0, 160),
  };
}

const tooltipStyle = {
  background: '#111827',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  color: '#F8FAFC',
};
