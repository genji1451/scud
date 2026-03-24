'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ManualOverride,
  applyManualOverrides,
  getManualOverrides,
  removeManualOverride,
  upsertManualOverride,
} from '@/lib/manualOverrides';

type DataRow = {
  Сотрудник: string;
  Дата: string;
  'Первый вход': string;
  'Последний выход': string;
  net_seconds: number;
  net_minus_lunch_seconds: number;
  net_minus_smoke_seconds: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState<string>('');
  const [rows, setRows] = useState<DataRow[]>([]);
  const [employee, setEmployee] = useState('');
  const [date, setDate] = useState('');
  const [firstIn, setFirstIn] = useState('');
  const [lastOut, setLastOut] = useState('');
  const [netHours, setNetHours] = useState('');
  const [minusLunchHours, setMinusLunchHours] = useState('');
  const [minusSmokeHours, setMinusSmokeHours] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Не авторизован'))))
      .then((me) => {
        setRole(me.role || 'admin');
        if (me.role !== 'super_admin') {
          setMessage('Доступ только для super admin');
        }
      })
      .catch(() => setMessage('Не удалось проверить права'));
  }, []);

  useEffect(() => {
    fetch('/api/data', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Ошибка загрузки'))))
      .then((json) => {
        setRows(applyManualOverrides(json));
      })
      .catch(() => setMessage('Не удалось загрузить данные'));
  }, []);

  const employees = useMemo(
    () => Array.from(new Set(rows.map((r) => r['Сотрудник']))).sort(),
    [rows]
  );

  const dates = useMemo(
    () =>
      Array.from(
        new Set(rows.filter((r) => !employee || r['Сотрудник'] === employee).map((r) => r['Дата']))
      ).sort(),
    [rows, employee]
  );

  const current = useMemo(
    () =>
      rows.find((r) => r['Сотрудник'] === employee && r['Дата'] === date),
    [rows, employee, date]
  );

  useEffect(() => {
    if (!current) return;
    setFirstIn(current['Первый вход'] || '');
    setLastOut(current['Последний выход'] || '');
    setNetHours(((current.net_seconds || 0) / 3600).toFixed(2));
    setMinusLunchHours(((current.net_minus_lunch_seconds || 0) / 3600).toFixed(2));
    setMinusSmokeHours(((current.net_minus_smoke_seconds || 0) / 3600).toFixed(2));
  }, [current]);

  const overrides = useMemo(() => getManualOverrides(), [message, rows]);

  const save = () => {
    if (!employee || !date) {
      setMessage('Выберите сотрудника и дату');
      return;
    }
    const toSec = (hoursText: string) => Math.max(0, Math.round((Number(hoursText) || 0) * 3600));
    const item: ManualOverride = {
      employee,
      date,
      firstIn,
      lastOut,
      netSeconds: toSec(netHours),
      netMinusLunchSeconds: toSec(minusLunchHours),
      netMinusSmokeSeconds: toSec(minusSmokeHours),
    };
    upsertManualOverride(item);
    setRows((prev) =>
      applyManualOverrides(
        prev.map((r) =>
          r['Сотрудник'] === employee && r['Дата'] === date
            ? {
                ...r,
                'Первый вход': firstIn,
                'Последний выход': lastOut,
                net_seconds: item.netSeconds || 0,
                net_minus_lunch_seconds: item.netMinusLunchSeconds || 0,
                net_minus_smoke_seconds: item.netMinusSmokeSeconds || 0,
              }
            : r
        )
      )
    );
    setMessage('Сохранено. Правки применены на сайте в этом браузере.');
  };

  const remove = (e: string, d: string) => {
    removeManualOverride(e, d);
    window.location.reload();
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Super admin: ручные правки</h1>
          <p className="subtitle">
            Меняйте время сотрудника на конкретный день. Используется, когда сотрудник не отметился.
          </p>
        </div>
        <button type="button" className="logout-btn" onClick={() => router.push('/dashboard')}>
          На дашборд
        </button>
      </header>

      {role !== 'super_admin' ? (
        <section className="table-section">
          <p>{message || 'Нет доступа'}</p>
        </section>
      ) : (
        <>
          <section className="table-section">
            <h2>Редактирование дня</h2>
            <div className="controls">
              <div className="control-group">
                <label>Сотрудник</label>
                <select value={employee} onChange={(e) => { setEmployee(e.target.value); setDate(''); }}>
                  <option value="">Выберите</option>
                  {employees.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
              <div className="control-group">
                <label>Дата</label>
                <select value={date} onChange={(e) => setDate(e.target.value)}>
                  <option value="">Выберите</option>
                  {dates.map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="controls">
              <div className="control-group"><label>Первый вход</label><input value={firstIn} onChange={(e) => setFirstIn(e.target.value)} /></div>
              <div className="control-group"><label>Последний выход</label><input value={lastOut} onChange={(e) => setLastOut(e.target.value)} /></div>
              <div className="control-group"><label>Чистые часы</label><input value={netHours} onChange={(e) => setNetHours(e.target.value)} /></div>
              <div className="control-group"><label>Минус обед (ч)</label><input value={minusLunchHours} onChange={(e) => setMinusLunchHours(e.target.value)} /></div>
              <div className="control-group"><label>Минус перекуры (ч)</label><input value={minusSmokeHours} onChange={(e) => setMinusSmokeHours(e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" className="logout-btn" onClick={save}>Сохранить правку</button>
            </div>
            {message && <p className="chart-subtitle" style={{ marginTop: 12 }}>{message}</p>}
          </section>

          <section className="table-section insights-section">
            <h2>Сохранённые ручные правки</h2>
            <table>
              <thead>
                <tr><th>Сотрудник</th><th>Дата</th><th>Действие</th></tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={`${o.employee}-${o.date}`}>
                    <td>{o.employee}</td>
                    <td>{o.date}</td>
                    <td><button type="button" className="logout-btn" onClick={() => remove(o.employee, o.date)}>Удалить</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

