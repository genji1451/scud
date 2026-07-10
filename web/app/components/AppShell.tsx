'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CalendarDays,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Settings,
  Table2,
  UploadCloud,
  Users,
} from 'lucide-react';

const navItems = [
  { label: 'Обзор', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Сотрудники', href: '/dashboard#employees', icon: Users },
  { label: 'Отделы', href: '/dashboard#departments', icon: Building2 },
  { label: 'Отчеты', href: '/dashboard#reports', icon: FileBarChart },
  { label: 'Графики работы', href: '/dashboard#charts', icon: CalendarDays },
  { label: 'Табель', href: '/dashboard#timesheet', icon: Table2 },
  { label: 'Аналитика', href: '/dashboard#analytics', icon: BarChart3 },
  { label: 'Импорт данных', href: '/import', icon: UploadCloud },
  { label: 'Настройки', href: '/dashboard#settings', icon: Settings },
];

type AppShellProps = {
  title: string;
  subtitle?: string;
  lastImport: string;
  onLogout?: () => void;
  children: React.ReactNode;
};

export function AppShell({ title, subtitle, lastImport, onLogout, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Н</div>
          <div>
            <div className="brand-title">НОКС</div>
            <div className="brand-subtitle">Учет рабочего времени</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/dashboard' ? pathname === '/dashboard' : pathname === item.href;
            return (
              <Link key={item.label} href={item.href} className={`nav-item ${active ? 'active' : ''}`}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-note">
          <span>Режим данных</span>
          <strong>Ручная выгрузка</strong>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Панель начальника</p>
            <h1>{title}</h1>
            {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
          </div>
          <div className="topbar-meta">
            <div className="status-pill">Данные загружены вручную</div>
            <div className="meta-card">
              <span>Последний импорт</span>
              <strong>{lastImport}</strong>
            </div>
            <div className="user-card">
              <span>Пользователь</span>
              <strong>Начальник</strong>
            </div>
            {onLogout && (
              <button type="button" className="icon-button" onClick={onLogout} aria-label="Выйти">
                <LogOut size={18} />
              </button>
            )}
          </div>
        </header>
        <main className="content-area">{children}</main>
      </div>
    </div>
  );
}
