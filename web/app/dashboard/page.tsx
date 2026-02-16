'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

declare global {
  interface Window {
    Chart?: new (ctx: HTMLCanvasElement | CanvasRenderingContext2D, config: object) => { destroy: () => void };
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const [rawData, setRawData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    fetch('/api/data', { credentials: 'include', signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error('Данные не загружены');
        return r.json();
      })
      .then((data) => {
        setRawData(data);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        const msg = err.name === 'AbortError' ? 'Таймаут загрузки. Обновите страницу.' : (err.message || 'Ошибка загрузки данных');
        setError(msg);
        setLoading(false);
      });
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading-state" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error-state">
          <p style={{ color: 'var(--danger)' }}>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>Обновить</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/chart.js" strategy="afterInteractive" />
      <DashboardContent rawData={rawData} chartRef={chartRef} onLogout={handleLogout} />
    </>
  );
}

function getYearWeek(dateStr: string): string {
  const parts = dateStr.split('.').map(Number);
  const [d, m, y] = parts;
  const dt = new Date(y, m - 1, d);
  const onejan = new Date(dt.getFullYear(), 0, 1);
  const week = Math.ceil((((dt.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
  return `${y}-W${String(week).padStart(2, '0')}`;
}

function parseDate(dateStr: string): { d: number; m: number; y: number } {
  const parts = dateStr.split('.').map(Number);
  return { d: parts[0], m: parts[1], y: parts[2] };
}

function DashboardContent({
  rawData,
  chartRef,
  onLogout,
}: {
  rawData: Record<string, unknown>[];
  chartRef: React.RefObject<HTMLCanvasElement | null>;
  onLogout: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const chartInstanceRef = useRef<{ destroy: () => void } | null>(null);

  const employees = Array.from(new Set(rawData.map((r) => r['Сотрудник'] as string))).sort();
  const monthKeys = Array.from(new Set(rawData.map((r) => (r['Дата'] as string).slice(3)))).sort(
    (a, b) => {
      const [ma, ya] = a.split('.').map(Number);
      const [mb, yb] = b.split('.').map(Number);
      return ya !== yb ? ya - yb : ma - mb;
    }
  );
  const weekKeys = Array.from(new Set(rawData.map((r) => getYearWeek(r['Дата'] as string)))).sort();

  const [selectedEmployee, setSelectedEmployee] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedWeek, setSelectedWeek] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !rawData.length || typeof window === 'undefined') return;
    updateDashboardView(rawData, chartRef, chartInstanceRef, selectedEmployee, selectedMonth, selectedWeek, selectedDate);
  }, [mounted, rawData, chartRef, selectedEmployee, selectedMonth, selectedWeek, selectedDate]);

  const calendarMonth = selectedMonth !== 'ALL' ? selectedMonth : (monthKeys[0] || '12.2025');
  const [calM, calY] = calendarMonth.split('.').map(Number);
  const daysInMonth = new Date(calY, calM, 0).getDate();
  const firstDayRaw = new Date(calY, calM - 1, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  const hoursByDate = new Map<string, number>();
  let filteredForCal = [...rawData];
  if (selectedEmployee !== 'ALL') filteredForCal = filteredForCal.filter((r) => r['Сотрудник'] === selectedEmployee);
  if (selectedWeek !== 'ALL') filteredForCal = filteredForCal.filter((r) => getYearWeek(r['Дата'] as string) === selectedWeek);
  filteredForCal.forEach((r) => {
    const dt = r['Дата'] as string;
    const { m, y } = parseDate(dt);
    if (m === calM && y === calY) {
      const hrs = ((r.net_seconds as number) || 0) / 3600;
      hoursByDate.set(dt, (hoursByDate.get(dt) || 0) + hrs);
    }
  });

  const getDayColor = (day: number) => {
    const dateStr = `${String(day).padStart(2, '0')}.${String(calM).padStart(2, '0')}.${calY}`;
    const hrs = hoursByDate.get(dateStr) ?? 0;
    const ratio = Math.min(1, Math.max(0, hrs / 8));
    const r = Math.round(220 - 186 * ratio);
    const g = Math.round(38 + 159 * ratio);
    const b = Math.round(38 + 56 * ratio);
    const dow = new Date(calY, calM - 1, day).getDay();
    return { bg: `rgb(${r}, ${g}, ${b})`, isWeekend: dow === 0 || dow === 6 };
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Учёт рабочего времени</h1>
        <button type="button" className="logout-btn" onClick={onLogout}>Выйти</button>
      </header>

      <section className="controls">
        <div className="control-group">
          <label htmlFor="employeeSelect">Сотрудник</label>
          <select id="employeeSelect" value={selectedEmployee} onChange={(e) => { setSelectedEmployee(e.target.value); setSelectedDate(null); }}>
            <option value="ALL">Все</option>
            {employees.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="monthSelect">Месяц</label>
          <select id="monthSelect" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(null); }}>
            <option value="ALL">Все</option>
            {monthKeys.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="weekSelect">Неделя</label>
          <select id="weekSelect" value={selectedWeek} onChange={(e) => { setSelectedWeek(e.target.value); setSelectedDate(null); }}>
            <option value="ALL">Все</option>
            {weekKeys.map((w) => (
              <option key={w} value={w}>{w.replace('-', ' / ')}</option>
            ))}
          </select>
        </div>
        {selectedDate && (
          <button type="button" className="logout-btn" onClick={() => setSelectedDate(null)} style={{ marginLeft: 8 }}>
            Сбросить дату
          </button>
        )}
      </section>

      <section className="summary-cards">
        <div className="card">
          <div className="card-title">Часов за период</div>
          <div className="card-value" id="totalHours">0 ч</div>
        </div>
        <div className="card highlight">
          <div className="card-title">Чистое время</div>
          <div className="card-value" id="netWorkHours">0 ч</div>
        </div>
        <div className="card">
          <div className="card-title">Рабочих дней</div>
          <div className="card-value" id="workDaysCount">0</div>
        </div>
        <div className="card success">
          <div className="card-title">Лидер</div>
          <div className="card-value" id="topEmployee">—</div>
        </div>
      </section>

      <section className="calendar-section">
        <h3>Календарь — {calendarMonth}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 8 }}>
          {weekdays.map((w) => (
            <div key={w} className="calendar-weekday">{w}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`e-${i}`} className="calendar-day empty" />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const { bg, isWeekend } = getDayColor(day);
            const dateStr = `${String(day).padStart(2, '0')}.${String(calM).padStart(2, '0')}.${calY}`;
            const isSelected = selectedDate === dateStr;
            return (
              <div
                key={day}
                className={`calendar-day has-data ${isWeekend ? 'weekend' : ''} ${isSelected ? 'selected' : ''}`}
                style={{ background: isWeekend ? 'var(--bg-dark)' : bg }}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                title={`${dateStr} — ${(hoursByDate.get(dateStr) ?? 0).toFixed(1)} ч`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </section>

      <section className="chart-container">
        <h3>Часы по дням</h3>
        <canvas ref={chartRef as React.Ref<HTMLCanvasElement>} id="workChart" />
      </section>

      <section className="table-section">
        <h3>Детализация</h3>
        <table id="dataTable">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Дата</th>
              <th>Пришел</th>
              <th>Ушел</th>
              <th>Часы</th>
              <th>Перерывы</th>
            </tr>
          </thead>
          <tbody />
        </table>
      </section>

      <section className="breaks-section" id="breaksSection" style={{ display: 'none' }}>
        <h3>Перерывы</h3>
        <table id="breaksTable">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Дата</th>
              <th>Тип</th>
              <th>Выход</th>
              <th>Возврат</th>
              <th>Длительность</th>
            </tr>
          </thead>
          <tbody />
        </table>
      </section>
    </div>
  );
}

function updateDashboardView(
  rawData: Record<string, unknown>[],
  chartRef: React.RefObject<HTMLCanvasElement | null>,
  chartInstanceRef: React.MutableRefObject<{ destroy: () => void } | null>,
  selectedEmployee: string,
  selectedMonth: string,
  selectedWeek: string,
  selectedDate: string | null
) {
  if (!rawData || !Array.isArray(rawData)) return;

  const formatHours = (h: number) => {
    const totalMinutes = Math.round(h * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0 && minutes === 0) return '0 ч';
    if (minutes === 0) return `${hours} ч`;
    return `${hours} ч ${minutes} м`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
  };

  const groupByKey = (data: Record<string, unknown>[], keyFn: (r: Record<string, unknown>) => string) => {
    const map = new Map<string, Record<string, unknown>[]>();
    data.forEach((r) => {
      const key = keyFn(r);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
  };

  const emp = selectedEmployee || 'ALL';
  let data = [...rawData];
  if (emp !== 'ALL') data = data.filter((r) => r['Сотрудник'] === emp);
  if (selectedMonth && selectedMonth !== 'ALL') data = data.filter((r) => (r['Дата'] as string).slice(3) === selectedMonth);
  if (selectedWeek && selectedWeek !== 'ALL') data = data.filter((r) => getYearWeek(r['Дата'] as string) === selectedWeek);
  if (selectedDate) data = data.filter((r) => r['Дата'] === selectedDate);

  const grouped = groupByKey(data, (r) => r['Дата'] as string)
    .map((g) => ({
      key: g.key,
      hours: g.items.reduce((sum, r) => sum + ((r.net_seconds as number) || 0), 0) / 3600,
      items: g.items,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

  const totalHours = grouped.reduce((sum, g) => sum + g.hours, 0);
  const totalNetHours = data.length > 0 ? data.reduce((sum, r) => sum + ((r.net_seconds as number) || 0), 0) / 3600 : 0;
  const byEmployee = groupByKey(data, (r) => r['Сотрудник'] as string)
    .map((g) => ({ name: g.key, hours: g.items.reduce((sum, r) => sum + ((r.net_seconds as number) || 0), 0) / 3600 }))
    .sort((a, b) => b.hours - a.hours);

  const el = (id: string, text: string) => {
    const e = document.getElementById(id);
    if (e) e.textContent = text;
  };
  el('totalHours', formatHours(totalHours));
  el('netWorkHours', formatHours(totalNetHours));
  el('workDaysCount', String(grouped.length));
  el('topEmployee', byEmployee[0]?.hours > 0 ? `${byEmployee[0].name} (${formatHours(byEmployee[0].hours)})` : '—');

  const tbody = document.querySelector('#dataTable tbody');
  if (tbody) {
    tbody.innerHTML = '';
    grouped.forEach((g) => {
      const tr = document.createElement('tr');
      let firstIn = '-', lastOut = '-', breaksText = '-';
      let netHours = g.hours;
      if (emp !== 'ALL' && g.items.length > 0) {
        const item = g.items[0];
        firstIn = (item['Первый вход'] as string) || '-';
        lastOut = (item['Последний выход'] as string) || '-';
        netHours = ((item.net_seconds as number) || 0) / 3600;
        const breaks = (item.breaks as Array<Record<string, string>>) || [];
        if (breaks.length) breaksText = breaks.map((b) => `${b['Тип'] === 'Обед' ? '🍽' : '☕'} ${b['Время выхода']}-${b['Время возвращения']}`).join(', ');
      } else {
        const totalNetSec = g.items.reduce((sum, r) => sum + ((r.net_seconds as number) || 0), 0);
        netHours = totalNetSec / 3600;
      }
      tr.innerHTML = `
        <td>${emp === 'ALL' ? 'Все' : emp}</td>
        <td>${g.key}</td>
        <td>${firstIn}</td>
        <td>${lastOut}</td>
        <td>${formatHours(netHours)}</td>
        <td style="font-size:12px">${breaksText}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  const breaksSection = document.getElementById('breaksSection');
  const breaksTbody = document.querySelector('#breaksTable tbody');
  if (breaksSection && breaksTbody) {
    breaksTbody.innerHTML = '';
    if (emp === 'ALL') {
      breaksSection.style.display = 'none';
    } else {
      const allBreaks: Array<Record<string, unknown>> = [];
      data.forEach((item) => {
        ((item.breaks as Array<Record<string, unknown>>) || []).forEach((b) => {
          allBreaks.push({ Сотрудник: item['Сотрудник'], Дата: item['Дата'], ...b });
        });
      });
      if (allBreaks.length === 0) {
        breaksSection.style.display = 'none';
      } else {
        breaksSection.style.display = 'block';
        allBreaks.forEach((b) => {
          const tr = document.createElement('tr');
          const icon = b['Тип'] === 'Обед' ? '🍽' : '☕';
          const cls = b['Тип'] === 'Обед' ? 'lunch' : 'smoke';
          tr.innerHTML = `
            <td>${b['Сотрудник']}</td>
            <td>${b['Дата']}</td>
            <td><span class="break-type ${cls}">${icon} ${b['Тип']}</span></td>
            <td>${b['Время выхода']}</td>
            <td>${b['Время возвращения']}</td>
            <td>${formatDuration((b['Длительность_сек'] as number) || 0)}</td>
          `;
          breaksTbody.appendChild(tr);
        });
      }
    }
  }

  const hoursToColor = (h: number) => {
    const ratio = Math.min(1, Math.max(0, h / 8));
    const r = Math.round(220 - 186 * ratio);
    const g = Math.round(38 + 159 * ratio);
    const b = Math.round(38 + 56 * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

  if (chartInstanceRef.current) {
    chartInstanceRef.current.destroy();
    chartInstanceRef.current = null;
  }
  if (typeof window !== 'undefined' && window.Chart && chartRef?.current) {
    const ctx = chartRef.current.getContext('2d');
    if (ctx) {
      const ch = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: grouped.map((g) => g.key),
          datasets: [{
            label: 'Часы',
            data: grouped.map((g) => g.hours),
            backgroundColor: grouped.map((g) => hoursToColor(g.hours)),
            borderRadius: 6,
          }],
        },
        options: {
          responsive: true,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1a2332',
              titleColor: '#e8eef4',
              bodyColor: '#e8eef4',
              borderColor: '#2d3a4f',
              borderWidth: 1,
              padding: 12,
              callbacks: {
                label: (ctx: { raw: number }) => ` ${ctx.raw.toFixed(1)} ч`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: '#2d3a4f' },
              ticks: { color: '#8b9cb3', maxRotation: 45 },
            },
            y: {
              beginAtZero: true,
              grid: { color: '#2d3a4f' },
              ticks: { color: '#8b9cb3' },
              title: { display: true, text: 'Часы', color: '#8b9cb3' },
            },
          },
          animation: { duration: 400 },
        },
      });
      chartInstanceRef.current = ch;
    }
  }
}
