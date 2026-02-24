import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Отчет по рабочему времени',
  description: 'Дашборд учета рабочего времени сотрудников',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
