'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Calendar, ChevronDown, Clock, UploadCloud } from 'lucide-react';
import type { PeriodMode } from './types';

export function FilterBar({
  periodMode,
  onPeriodModeChange,
  employee,
  onEmployeeChange,
  employees,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  periodMode: PeriodMode;
  onPeriodModeChange: (value: PeriodMode) => void;
  employee: string;
  onEmployeeChange: (value: string) => void;
  employees: string[];
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  const periods: Array<{ label: string; value: PeriodMode }> = [
    { label: 'День', value: 'day' },
    { label: 'Неделя', value: 'week' },
    { label: 'Месяц', value: 'month' },
    { label: 'Квартал', value: 'quarter' },
    { label: 'Период', value: 'custom' },
  ];

  return (
    <section className="filter-bar" aria-label="Фильтры отчета">
      <div className="segmented-control">
        {periods.map((item) => (
          <button
            key={item.value}
            type="button"
            className={periodMode === item.value ? 'active' : ''}
            onClick={() => onPeriodModeChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {periodMode === 'custom' && (
        <div className="date-range">
          <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
          <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
        </div>
      )}

      <label className="select-wrap">
        <span>Сотрудник</span>
        <select value={employee} onChange={(event) => onEmployeeChange(event.target.value)}>
          <option value="ALL">Все сотрудники</option>
          {employees.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </label>
    </section>
  );
}

export function StatCard({ label, value, note, tone = 'default', delay = 0 }: {
  label: string;
  value: string;
  note?: string;
  tone?: 'default' | 'accent';
  delay?: number;
}) {
  return (
    <motion.div
      className={`stat-card ${tone === 'accent' ? 'accent' : ''}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div className="stat-topline">
        <span>{label}</span>
        <ArrowUpRight size={16} />
      </div>
      <strong>{value}</strong>
      {note && <p>{note}</p>}
    </motion.div>
  );
}

export function ChartCard({ title, subtitle, children, wide = false, id }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      className={`chart-card ${wide ? 'wide' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="chart-body">{children}</div>
    </motion.section>
  );
}

export function DataTable<T extends Record<string, React.ReactNode>>({
  title,
  subtitle,
  columns,
  rows,
  id,
}: {
  title: string;
  subtitle?: string;
  columns: Array<{ key: keyof T; label: string }>;
  rows: T[];
  id?: string;
}) {
  return (
    <section className="table-card" id={id}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={String(column.key)}>{column.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => <td key={String(column.key)}>{row[column.key]}</td>)}
              </tr>
            )) : (
              <tr>
                <td colSpan={columns.length}>Нет данных для выбранных фильтров</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ImportStatusCard({
  lastImport,
  period,
  employees,
  fileName,
}: {
  lastImport: string;
  period: string;
  employees: number;
  fileName: string;
}) {
  return (
    <section className="import-status-card">
      <div className="import-icon"><UploadCloud size={24} /></div>
      <div>
        <p className="eyebrow">Последняя выгрузка</p>
        <h2>{fileName}</h2>
        <div className="import-grid">
          <span><Calendar size={15} /> {lastImport}</span>
          <span><Clock size={15} /> {period}</span>
          <span>{employees} сотрудников</span>
        </div>
      </div>
    </section>
  );
}
