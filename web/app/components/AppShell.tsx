'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Table2,
  UploadCloud,
  Users,
} from 'lucide-react';

type UserRole = 'admin' | 'super_admin' | string;

const navItems = [
  { label: 'Обзор', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Сотрудники', href: '/dashboard#employees', icon: Users },
  { label: 'Графики', href: '/dashboard#charts', icon: CalendarDays },
  { label: 'Табель', href: '/dashboard#timesheet', icon: Table2 },
  { label: 'Отчеты', href: '/dashboard#reports', icon: FileBarChart },
  { label: 'Аналитика', href: '/dashboard#analytics', icon: BarChart3 },
];

const adminOnlyItems = [
  { label: 'Импорт', href: '/import', icon: UploadCloud },
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
  const [role, setRole] = useState<UserRole>('admin');

  useEffect(() => {
    fetch('/api/me', { credentials: 'include', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.role) setRole(data.role);
      })
      .catch(() => setRole('admin'));
  }, []);

  const menu = useMemo(
    () => (role === 'super_admin' ? [...navItems, ...adminOnlyItems] : navItems),
    [role],
  );

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="НОКС: перейти к обзору">
          <img src="/noks-icon.svg" width={42} height={42} alt="" className="brand-logo" />
          <div>
            <div className="brand-title">НОКС</div>
            <div className="brand-subtitle">Учет рабочего времени</div>
          </div>
        </Link>

        <nav className="sidebar-nav" aria-label="Основное меню">
          {menu.map((item) => {
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
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
          </div>
          <div className="topbar-meta">
            <div className="status-pill">Ручная выгрузка</div>
            <div className="meta-card">
              <span>Последний импорт</span>
              <strong>{lastImport}</strong>
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
