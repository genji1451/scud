import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'НОКС | Учет рабочего времени',
  description: 'Dashboard отчетов по рабочему времени сотрудников',
  icons: {
    icon: '/noks-icon.svg',
  },
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
