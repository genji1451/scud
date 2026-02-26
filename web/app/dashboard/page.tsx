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
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 сек таймаут

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
        const msg = err.name === 'AbortError' ? 'Таймаут загрузки. Проверьте интернет и обновите страницу.' : (err.message || 'Ошибка загрузки данных');
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
        <p>Загрузка данных...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app" style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}
        >
          Обновить страницу
        </button>
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

  // Группируем недели по месяцам, чтобы показывать «1 неделя февраля», «2 неделя февраля» и т.д.
  const weeksByMonth: Record<string, string[]> = {};
  rawData.forEach((r) => {
    const dateStr = r['Дата'] as string;
    const monthKey = dateStr.slice(3); // "MM.YYYY"
    const wk = getYearWeek(dateStr);   // "YYYY-Www"
    if (!weeksByMonth[monthKey]) weeksByMonth[monthKey] = [];
    if (!weeksByMonth[monthKey].includes(wk)) weeksByMonth[monthKey].push(wk);
  });
  Object.keys(weeksByMonth).forEach((mk) => {
    weeksByMonth[mk].sort((a, b) => {
      const wa = Number(a.split('-W')[1] || '0');
      const wb = Number(b.split('-W')[1] || '0');
      return wa - wb;
    });
  });

  const allWeekKeys = Array.from(
    new Set(Object.values(weeksByMonth).flat())
  ).sort((a, b) => {
    const wa = Number(a.split('-W')[1] || '0');
    const wb = Number(b.split('-W')[1] || '0');
    return wa - wb;
  });

  const [selectedEmployee, setSelectedEmployee] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedWeek, setSelectedWeek] = useState('ALL');

  const visibleWeekKeys =
    selectedMonth === 'ALL' ? allWeekKeys : weeksByMonth[selectedMonth] || [];

  const monthKeyToLabelGenitive = (monthKey: string): string => {
    const [mStr, year] = monthKey.split('.');
    const m = Number(mStr);
    const names: Record<number, string> = {
      1: 'января',
      2: 'февраля',
      3: 'марта',
      4: 'апреля',
      5: 'мая',
      6: 'июня',
      7: 'июля',
      8: 'августа',
      9: 'сентября',
      10: 'октября',
      11: 'ноября',
      12: 'декабря',
    };
    const base = names[m] || monthKey;
    return `${base} ${year}`;
  };

  const weekLabel = (weekKey: string): string => {
    if (!weekKey) return '';

    if (selectedMonth === 'ALL') {
      const monthKey = Object.keys(weeksByMonth).find((mk) =>
        weeksByMonth[mk]?.includes(weekKey)
      );
      if (!monthKey) return weekKey.replace('-', ' / ');
      const index = (weeksByMonth[monthKey] || []).indexOf(weekKey);
      if (index === -1) return weekKey.replace('-', ' / ');
      return `${index + 1} неделя ${monthKeyToLabelGenitive(monthKey)}`;
    }

    const monthWeeks = weeksByMonth[selectedMonth];
    if (!monthWeeks) return weekKey.replace('-', ' / ');
    const index = monthWeeks.indexOf(weekKey);
    if (index === -1) return weekKey.replace('-', ' / ');
    return `${index + 1} неделя ${monthKeyToLabelGenitive(selectedMonth)}`;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !rawData.length || typeof window === 'undefined') return;
    updateDashboardView(rawData, chartRef, chartInstanceRef, selectedEmployee, selectedMonth, selectedWeek);
  }, [mounted, rawData, chartRef, selectedEmployee, selectedMonth, selectedWeek]);

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Отчет по рабочему времени сотрудников</h1>
          <p className="subtitle">
            Период: декабрь–февраль, только рабочие дни (пн–пт). Данные загружаются из файла
            <code> nov-feb 11.xlsx</code> и рассчитываются скриптом <code>generate_report.py</code>.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="header-badge">
            <span className="badge-label">Всего сотрудников</span>
            <span className="badge-value">{employees.length}</span>
          </div>
          <button type="button" className="logout-btn" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>

      <section className="controls">
        <div className="control-group">
          <label htmlFor="employeeSelect">Сотрудник:</label>
          <select
            id="employeeSelect"
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="ALL">Все сотрудники</option>
            {employees.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="monthSelect">Месяц:</label>
          <select
            id="monthSelect"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setSelectedWeek('ALL');
            }}
          >
            <option value="ALL">Все месяцы</option>
            {monthKeys.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="control-group">
          <label htmlFor="weekSelect">Неделя:</label>
          <select
            id="weekSelect"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
          >
            <option value="ALL">Все недели</option>
            {visibleWeekKeys.map((w) => (
              <option key={w} value={w}>
                {weekLabel(w)}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="summary-cards">
        <div className="card">
          <div className="card-title">Всего часов за период</div>
          <div className="card-value" id="totalHours">0 ч</div>
        </div>
        <div className="card">
          <div className="card-title">Среднее количество часов в день</div>
          <div className="card-value" id="avgPerDay">0 ч</div>
        </div>
        <div className="card">
          <div className="card-title">Максимум часов в день</div>
          <div className="card-value" id="maxPerDay">0 ч</div>
        </div>
        <div className="card">
          <div className="card-title">Количество рабочих дней в выборке</div>
          <div className="card-value" id="workDaysCount">0</div>
        </div>
        <div className="card">
          <div className="card-title">Лидер по часам (по фильтру)</div>
          <div className="card-value" id="topEmployee">—</div>
        </div>
        <div className="card highlight-card">
          <div className="card-title">Чистое рабочее время (минус все перерывы)</div>
          <div className="card-value" id="netWorkHours">0 ч</div>
        </div>
        <div className="card highlight-card">
          <div className="card-title">Время работы минус обед</div>
          <div className="card-value" id="workMinusLunch">0 ч</div>
        </div>
        <div className="card highlight-card">
          <div className="card-title">Время работы минус перекуры</div>
          <div className="card-value" id="workMinusSmoke">0 ч</div>
        </div>
      </section>

      <section className="charts">
        <div className="chart-container">
          <h2 id="chartTitle">Часы работы по дням</h2>
          <p className="chart-subtitle">
            График показывает суммарное чистое рабочее время по выбранному периоду и сотруднику
            (или по всем сотрудникам, если выбран параметр «Все сотрудники»).
          </p>
          <canvas ref={chartRef as React.Ref<HTMLCanvasElement>} id="workChart" />
        </div>
      </section>

      <section className="table-section">
        <h2>Детальная сводка по выбранному фильтру</h2>
        <table id="dataTable">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Дата</th>
              <th>Пришел</th>
              <th>Ушел</th>
              <th>Чистое время (минус все)</th>
              <th>Минус обед</th>
              <th>Минус перекуры</th>
              <th>Перерывы</th>
            </tr>
          </thead>
          <tbody />
        </table>
      </section>

      <section className="breaks-section" id="breaksSection" style={{ display: 'none' }}>
        <h2>Детализация перерывов</h2>
        <table id="breaksTable">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Дата</th>
              <th>Тип</th>
              <th>Время выхода</th>
              <th>Время возвращения</th>
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
  selectedWeek: string
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
  if (emp !== 'ALL') {
    data = data.filter((r) => r['Сотрудник'] === emp);
  }
  if (selectedMonth && selectedMonth !== 'ALL') {
    data = data.filter((r) => (r['Дата'] as string).slice(3) === selectedMonth);
  }
  if (selectedWeek && selectedWeek !== 'ALL') {
    data = data.filter((r) => getYearWeek(r['Дата'] as string) === selectedWeek);
  }

  const grouped = groupByKey(data, (r) => r['Дата'] as string)
      .map((g) => {
        const totalSeconds = g.items.reduce((sum, r) => sum + ((r.net_seconds as number) || 0), 0);
        return { key: g.key, hours: totalSeconds / 3600, items: g.items };
      })
      .sort((a, b) => a.key.localeCompare(b.key));

    // Summary
    const totalHours = grouped.reduce((sum, g) => sum + g.hours, 0);
    const avgPerDay = grouped.length ? totalHours / grouped.length : 0;
    const maxPerDay = grouped.reduce((max, g) => Math.max(max, g.hours), 0);

    const el = (id: string, text: string) => {
      const e = document.getElementById(id);
      if (e) e.textContent = text;
    };
    el('totalHours', formatHours(totalHours));
    el('avgPerDay', formatHours(avgPerDay));
    el('maxPerDay', formatHours(maxPerDay));
    el('workDaysCount', String(grouped.length));

    let totalNetHours = 0;
    let totalMinusLunchHours = 0;
    let totalMinusSmokeHours = 0;
    if (data.length > 0) {
      totalNetHours = data.reduce((sum, r) => sum + ((r.net_seconds as number) || 0), 0) / 3600;
      totalMinusLunchHours = data.reduce((sum, r) => sum + ((r.net_minus_lunch_seconds as number) || 0), 0) / 3600;
      totalMinusSmokeHours = data.reduce((sum, r) => sum + ((r.net_minus_smoke_seconds as number) || 0), 0) / 3600;
    }
    el('netWorkHours', formatHours(totalNetHours));
    el('workMinusLunch', formatHours(totalMinusLunchHours));
    el('workMinusSmoke', formatHours(totalMinusSmokeHours));

    const byEmployee = groupByKey(data, (r) => r['Сотрудник'] as string)
      .map((g) => ({
        name: g.key,
        hours: g.items.reduce((sum, r) => sum + ((r.net_seconds as number) || 0), 0) / 3600,
      }))
      .sort((a, b) => b.hours - a.hours);
    el('topEmployee', byEmployee[0]?.hours > 0 ? `${byEmployee[0].name} (${formatHours(byEmployee[0].hours)})` : '—');

    // Table
    const tbody = document.querySelector('#dataTable tbody');
    if (tbody) {
      tbody.innerHTML = '';
      grouped.forEach((g) => {
        const tr = document.createElement('tr');
        let firstIn = '-';
        let lastOut = '-';
        let breaksText = '-';
        let netHours = g.hours;
        let minusLunchHours = 0;
        let minusSmokeHours = 0;
        if (emp !== 'ALL' && g.items.length > 0) {
          const item = g.items[0];
          firstIn = (item['Первый вход'] as string) || '-';
          lastOut = (item['Последний выход'] as string) || '-';
          netHours = ((item.net_seconds as number) || 0) / 3600;
          minusLunchHours = ((item.net_minus_lunch_seconds as number) || 0) / 3600;
          minusSmokeHours = ((item.net_minus_smoke_seconds as number) || 0) / 3600;
          const breaks = (item.breaks as Array<Record<string, string>>) || [];
          if (breaks.length > 0) {
            breaksText = breaks.map((b) => `${b['Тип'] === 'Обед' ? '🍽️' : '🚬'} ${b['Время выхода']}-${b['Время возвращения']}`).join(', ');
          }
        } else {
          const totalNetSec = g.items.reduce((sum, r) => sum + ((r.net_seconds as number) || 0), 0);
          const totalMinusLunchSec = g.items.reduce((sum, r) => sum + ((r.net_minus_lunch_seconds as number) || 0), 0);
          const totalMinusSmokeSec = g.items.reduce((sum, r) => sum + ((r.net_minus_smoke_seconds as number) || 0), 0);
          netHours = totalNetSec / 3600;
          minusLunchHours = totalMinusLunchSec / 3600;
          minusSmokeHours = totalMinusSmokeSec / 3600;
        }
        tr.innerHTML = `
          <td>${emp === 'ALL' ? 'Все сотрудники' : emp}</td>
          <td>${g.key}</td>
          <td>${firstIn}</td>
          <td>${lastOut}</td>
          <td>${formatHours(netHours)}</td>
          <td>${formatHours(minusLunchHours)}</td>
          <td>${formatHours(minusSmokeHours)}</td>
          <td style="font-size:12px">${breaksText}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Breaks section
    const breaksSection = document.getElementById('breaksSection');
    const breaksTbody = document.querySelector('#breaksTable tbody');
    if (breaksSection && breaksTbody) {
      breaksTbody.innerHTML = '';
      if (emp === 'ALL') {
        breaksSection.style.display = 'none';
      } else {
        const allBreaks: Array<Record<string, unknown>> = [];
        data.forEach((item) => {
          const breaks = (item.breaks as Array<Record<string, unknown>>) || [];
          breaks.forEach((b) => {
            allBreaks.push({
              Сотрудник: item['Сотрудник'],
              Дата: item['Дата'],
              ...b,
            });
          });
        });
        if (allBreaks.length === 0) {
          breaksSection.style.display = 'none';
        } else {
          breaksSection.style.display = 'block';
          allBreaks.forEach((b) => {
            const tr = document.createElement('tr');
            const icon = b['Тип'] === 'Обед' ? '🍽️' : '🚬';
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

  // Chart — градиент: 8 ч = зелёный, меньше 8 = к красному
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
            label: 'Часы работы',
            data: grouped.map((g) => g.hours),
            backgroundColor: grouped.map((g) => hoursToColor(g.hours)),
          }],
        },
        options: {
          responsive: true,
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Часы' } } },
        },
      });
      chartInstanceRef.current = ch;
    }
  }
}
