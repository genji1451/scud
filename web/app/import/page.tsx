'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rawData, setRawData] = useState<WorkRow[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.role !== 'super_admin') {
          router.replace('/dashboard');
          return;
        }
        setCheckingRole(false);
      })
      .catch(() => router.replace('/dashboard'));
  }, [router]);

  useEffect(() => {
    if (checkingRole) return;
    fetch('/api/data', { credentials: 'include', cache: 'no-store' })
      .then((response) => response.json())
      .then((data: WorkRow[]) => setRawData(applyManualOverrides(data)))
      .catch(() => setRawData([]));
  }, [checkingRole]);

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

  if (checkingRole) {
    return (
      <div className="loading-screen">
        <div className="loader-card">Проверка доступа...</div>
      </div>
    );
  }

  return (
    <AppShell
      title="Импорт данных"
      subtitle="Проверка и подготовка файла выгрузки перед обновлением сайта"
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
          <h2>Выбрать файл выгрузки</h2>
          <p>Выберите Excel или JSON-файл с выгрузкой СКУД для проверки перед запуском скрипта обновления.</p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.json"
            className="visually-hidden"
            onChange={(event) => setSelectedFile(event.target.files?.[0]?.name || '')}
          />
          <button type="button" onClick={() => inputRef.current?.click()}>Выбрать файл</button>
          <span>{selectedFile ? `Выбран файл: ${selectedFile}` : 'Файл пока не выбран'}</span>
        </div>
        <div className="import-instructions">
          <div className="file-icon"><FileSpreadsheet size={24} /></div>
          <h3>Обновление сайта</h3>
          <p>
            Для публикации новой выгрузки используется PowerShell-скрипт из папки automation. Он берет Excel,
            пересобирает отчеты, обновляет JSON для dashboard и отправляет изменения в GitHub.
          </p>
          <ul>
            <li>Форматы для проверки: Excel и JSON.</li>
            <li>Рабочий файл сайта: web/data/work_summary.json и web/public/work_summary.json.</li>
            <li>Команда: powershell -ExecutionPolicy Bypass -File .\automation\update_scud_data.ps1 -InputFile "путь-к-файлу.xlsx"</li>
          </ul>
        </div>
      </motion.section>
    </AppShell>
  );
}
