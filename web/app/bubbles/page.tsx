'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Row = {
  Сотрудник: string;
  net_seconds?: number;
};

type EmployeeBubble = {
  name: string;
  hours: number;
};

export default function BubblesPage() {
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

  const bubbles = useMemo<EmployeeBubble[]>(() => {
    const map = new Map<string, number>();
    data.forEach((row) => {
      const name = row['Сотрудник'];
      if (!name) return;
      const sec = row.net_seconds || 0;
      map.set(name, (map.get(name) || 0) + sec);
    });
    return Array.from(map.entries())
      .map<EmployeeBubble>(([name, sec]) => ({
        name,
        hours: sec / 3600,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [data]);

  const maxHours = useMemo(
    () => (bubbles.length ? Math.max(...bubbles.map((b) => b.hours)) : 0),
    [bubbles]
  );

  const minSize = 80;
  const maxSize = 260;

  const hoursToColor = (h: number) => {
    const ratio = Math.min(1, Math.max(0, h / 8)); // 8 часов — зелёный
    const r = Math.round(220 - 186 * ratio);
    const g = Math.round(38 + 159 * ratio);
    const b = Math.round(38 + 56 * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  };

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
    <div className="app bubble-page">
      <header className="app-header">
        <div>
          <h1>Bubble‑карта рабочего времени</h1>
          <p className="subtitle">
            Каждый круг — сотрудник, размер и цвет зависят от общего количества отработанных часов
            за весь период. 8 часов и больше — зелёный, меньше — ближе к красному.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="logout-btn"
            onClick={() => router.push('/dashboard')}
          >
            К таблице и графику
          </button>
        </div>
      </header>

      <section className="bubble-legend">
        <div className="bubble-legend-item">
          <span className="bubble-legend-color bubble-legend-low" />
          <span>Мало часов</span>
        </div>
        <div className="bubble-legend-item">
          <span className="bubble-legend-color bubble-legend-mid" />
          <span>Около 8 часов</span>
        </div>
        <div className="bubble-legend-item">
          <span className="bubble-legend-color bubble-legend-high" />
          <span>Больше 8 часов</span>
        </div>
      </section>

      <section className="bubble-grid">
        {bubbles.map((b) => {
          const ratio = maxHours > 0 ? b.hours / maxHours : 0;
          const size = minSize + ratio * (maxSize - minSize);
          const bg = hoursToColor(b.hours);

          return (
            <div
              key={b.name}
              className="bubble"
              style={{
                width: size,
                height: size,
                background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 55%), ${bg}`,
              }}
            >
              <div className="bubble-name">{b.name}</div>
              <div className="bubble-hours">
                {b.hours.toFixed(1)} ч
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

