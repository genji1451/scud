'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type BreakRow = {
  'Время выхода': string;
  'Время возвращения': string;
  Длительность_сек: number;
  Тип: string;
};

type Row = {
  Сотрудник: string;
  Дата: string;
  net_seconds: number;
  net_minus_lunch_seconds: number;
  net_minus_smoke_seconds: number;
  breaks: BreakRow[];
};

type EmployeeKpi = {
  name: string;
  days: number;
  avgHours: number;
  daysOk: number;
  daysLow: number;
  okShare: number;
  lowShare: number;
  avgSmokes: number;
  avgSmokeDurationMin: number;
  daysMoreThanTwoSmokes: number;
  daysNoLunch: number;
};

export default function InsightsPage() {
  const router = useRouter();
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/data', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error('Данные не загружены');
        return r.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Ошибка загрузки данных');
        setLoading(false);
      });
  }, []);

  const kpis = useMemo<EmployeeKpi[]>(() => {
    const byEmployee = new Map<string, Row[]>();
    data.forEach((row) => {
      const name = row['Сотрудник'];
      if (!byEmployee.has(name)) byEmployee.set(name, []);
      byEmployee.get(name)!.push(row);
    });

    const result: EmployeeKpi[] = [];

    byEmployee.forEach((rows, name) => {
      const days = rows.length;
      if (!days) return;
      const hoursPerDay = rows.map((r) => (r.net_seconds || 0) / 3600);
      const totalHours = hoursPerDay.reduce((a, b) => a + b, 0);
      const daysOk = hoursPerDay.filter((h) => h >= 8).length;
      const daysLow = hoursPerDay.filter((h) => h < 7).length;

      let totalSmokes = 0;
      let totalSmokeSeconds = 0;
      let daysMoreThanTwoSmokes = 0;
      let daysNoLunch = 0;

      rows.forEach((r) => {
        const smokes = (r.breaks || []).filter((b) => b.Тип === 'Перекур');
        const lunch = (r.breaks || []).some((b) => b.Тип === 'Обед');
        const smokeCount = smokes.length;
        const smokeSec = smokes.reduce((s, b) => s + (b.Длительность_сек || 0), 0);

        totalSmokes += smokeCount;
        totalSmokeSeconds += smokeSec;
        if (smokeCount > 2) daysMoreThanTwoSmokes += 1;
        if (!lunch && r.net_seconds > 0) daysNoLunch += 1;
      });

      const avgSmokes = totalSmokes / days;
      const avgSmokeDurationMin =
        totalSmokes > 0 ? totalSmokeSeconds / 60 / totalSmokes : 0;

      result.push({
        name,
        days,
        avgHours: totalHours / days,
        daysOk,
        daysLow,
        okShare: daysOk / days,
        lowShare: daysLow / days,
        avgSmokes,
        avgSmokeDurationMin,
        daysMoreThanTwoSmokes,
        daysNoLunch,
      });
    });

    return result.sort((a, b) => b.avgHours - a.avgHours);
  }, [data]);

  const worstDays = useMemo(() => {
    return [...data]
      .filter((r) => (r.net_seconds || 0) < 6 * 3600)
      .sort((a, b) => (a.net_seconds || 0) - (b.net_seconds || 0))
      .slice(0, 30);
  }, [data]);

  const heavySmokers = useMemo(() => {
    return kpis
      .filter((k) => k.avgSmokes > 2)
      .sort((a, b) => b.avgSmokes - a.avgSmokes)
      .slice(0, 20);
  }, [kpis]);

  const noLunch = useMemo(() => {
    return kpis
      .filter((k) => k.daysNoLunch > 0)
      .sort((a, b) => b.daysNoLunch - a.daysNoLunch)
      .slice(0, 20);
  }, [kpis]);

  const formatPercent = (v: number) =>
    `${Math.round((v || 0) * 100)}%`;

  const formatHours = (h: number) => `${h.toFixed(1)} ч`;

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
    <div className="app">
      <header className="app-header">
        <div>
          <h1>KPI и статистика по рабочему времени</h1>
          <p className="subtitle">
            8 часов — целевая норма, до 2 перекуров в день. Здесь видно, кто стабильно держит
            норму, а где есть недобор по часам или избыток перерывов.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="logout-btn"
            onClick={() => router.push('/dashboard')}
          >
            Таблица и график
          </button>
          <button
            type="button"
            className="logout-btn"
            onClick={() => router.push('/bubbles')}
          >
            Bubble‑карта
          </button>
        </div>
      </header>

      <section className="table-section insights-section">
        <h2>KPI по сотрудникам</h2>
        <p className="chart-subtitle">
          Зелёный — норма выполняется (много дней ≥ 8 часов и не больше 2 перекуров в среднем),
          красный — частый недобор или много перекуров.
        </p>
        <div className="insights-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Рабочих дней</th>
                <th>Среднее чистое время</th>
                <th>Дней ≥ 8 ч</th>
                <th>% дней ≥ 8 ч</th>
                <th>Дней &lt; 7 ч</th>
                <th>Сред. перекуров/день</th>
                <th>Сред. длительность перекура</th>
                <th>Дней &gt; 2 перекуров</th>
                <th>Дней без обеда</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => {
                const status =
                  k.okShare >= 0.7 && k.avgSmokes <= 2
                    ? 'ok'
                    : k.okShare >= 0.5
                    ? 'warn'
                    : 'bad';
                const label =
                  status === 'ok'
                    ? 'OK'
                    : status === 'warn'
                    ? 'Внимание'
                    : 'Проблема';
                return (
                  <tr key={k.name}>
                    <td>{k.name}</td>
                    <td>{k.days}</td>
                    <td>{formatHours(k.avgHours)}</td>
                    <td>{k.daysOk}</td>
                    <td>{formatPercent(k.okShare)}</td>
                    <td>{k.daysLow}</td>
                    <td>{k.avgSmokes.toFixed(1)}</td>
                    <td>
                      {k.avgSmokeDurationMin > 0
                        ? `${k.avgSmokeDurationMin.toFixed(1)} мин`
                        : '—'}
                    </td>
                    <td>{k.daysMoreThanTwoSmokes}</td>
                    <td>{k.daysNoLunch}</td>
                    <td>
                      <span className={`kpi-status kpi-status-${status}`}>
                        {label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-section insights-section">
        <h2>Дни с недобором часов (&lt; 6 ч)</h2>
        <p className="chart-subtitle">
          Список максимум из 30 самых коротких рабочих дней по всем сотрудникам.
        </p>
        <div className="insights-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Дата</th>
                <th>Чистое время</th>
              </tr>
            </thead>
            <tbody>
              {worstDays.map((r) => (
                <tr key={`${r.Сотрудник}-${r.Дата}-low`}>
                  <td>{r.Сотрудник}</td>
                  <td>{r.Дата}</td>
                  <td>{formatHours((r.net_seconds || 0) / 3600)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-section insights-section">
        <h2>Много перекуров</h2>
        <p className="chart-subtitle">
          Сотрудники, у которых в среднем больше 2 перекуров в день.
        </p>
        <div className="insights-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Рабочих дней</th>
                <th>Сред. перекуров/день</th>
                <th>Сред. длительность перекура</th>
                <th>Дней &gt; 2 перекуров</th>
              </tr>
            </thead>
            <tbody>
              {heavySmokers.map((k) => (
                <tr key={`${k.name}-smoke`}>
                  <td>{k.name}</td>
                  <td>{k.days}</td>
                  <td>{k.avgSmokes.toFixed(1)}</td>
                  <td>
                    {k.avgSmokeDurationMin > 0
                      ? `${k.avgSmokeDurationMin.toFixed(1)} мин`
                      : '—'}
                  </td>
                  <td>{k.daysMoreThanTwoSmokes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="table-section insights-section">
        <h2>Дни без обеда</h2>
        <p className="chart-subtitle">
          Сотрудники, у которых есть дни с отсутствующим обедом (нет перерыва ≥ 30 минут).
        </p>
        <div className="insights-table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Рабочих дней</th>
                <th>Дней без обеда</th>
              </tr>
            </thead>
            <tbody>
              {noLunch.map((k) => (
                <tr key={`${k.name}-nolunch`}>
                  <td>{k.name}</td>
                  <td>{k.days}</td>
                  <td>{k.daysNoLunch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

