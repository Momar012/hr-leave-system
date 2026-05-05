import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VEONiee: HR Leave Management System',
  description: 'AI-powered leave management for employees and managers',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}
