'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppShell } from '@/app/components/AppShell';
import { ImportStatusCard } from '@/app/components/DashboardParts';
import { enrichRows, getPeriodLabel, parseDate } from '@/app/components/dashboardUtils';
import { applyManualOverrides } from '@/lib/manualOverrides';
import type { WorkRow } from '@/app/components/types';

export default function ImportPage() {
  const router = useRouter();
  const [rawData, setRawData] = useState<WorkRow[]>([]);

  useEffect(() => {
    fetch('/api/data', { credentials: 'include' })
      .then((response) => response.json())
      .then((data: WorkRow[]) => setRawData(applyManualOverrides(data)))
      .catch(() => setRawData([]));
  }, []);

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    router.push('/login');
    router.refresh();
  }

  const meta = useMemo(() => {
    const rows = enrichRows(rawData);
    const lastImport = rows.length
      ? rows.map((row) => parseDate(row.Дата)).sort((a, b) => b.getTime() - a.getTime())[0].toLocaleDateString('ru-RU')
      : 'Нет данных';
    return {
      rows,
      lastImport,
      employees: new Set(rows.map((row) => row.Сотрудник)).size,
      period: getPeriodLabel(rows),
    };
  }, [rawData]);

  return (
    <AppShell
      title="Импорт данных"
      subtitle="Ручная загрузка выгрузок СКУД без онлайн-мониторинга сотрудников"
      lastImport={meta.lastImport}
      onLogout={handleLogout}
    >
      <ImportStatusCard
        lastImport={meta.lastImport}
        period={meta.period}
        employees={meta.employees}
        fileName="work_summary.json"
      />

      <motion.section
        className="upload-panel"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="upload-zone">
          <UploadCloud size={42} />
          <h2>Загрузить файл</h2>
          <p>Загрузите Excel/JSON-файл с выгрузкой СКУД.</p>
          <button type="button">Выбрать файл</button>
          <span>UI-заготовка. Полноценный импорт будет подключен к API позже.</span>
        </div>
        <div className="import-instructions">
          <div className="file-icon"><FileSpreadsheet size={24} /></div>
          <h3>Как обновляются данные</h3>
          <p>
            Начальник или администратор вручную выгружает отчет из СКУД и размещает его на сайте.
            Интерфейс показывает состояние последней выгрузки и не является онлайн-мониторингом.
          </p>
          <ul>
            <li>Поддерживаемые форматы: Excel и JSON.</li>
            <li>Текущая версия читает подготовленный файл work_summary.json.</li>
            <li>TODO: подключить серверный обработчик загрузки и валидацию структуры файла.</li>
          </ul>
        </div>
      </motion.section>
    </AppShell>
  );
}
