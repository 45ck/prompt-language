import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NightOwl — Sleep Tracking for Knowledge Workers',
  description:
    'NightOwl connects your sleep quality to your cognitive performance. The sleep platform built for knowledge workers — engineers, researchers, writers, and managers who need their brain at its best.',
  keywords: [
    'sleep tracking for knowledge workers',
    'sleep and cognitive performance',
    'sleep productivity correlation',
    'sleep tracker for engineers',
    'work performance sleep data',
  ],
  openGraph: {
    title: 'NightOwl — Sleep Smarter, Think Sharper',
    description:
      'Track what happens at night. Understand what it does to your day. NightOwl connects sleep data to work performance for knowledge workers.',
    type: 'website',
    url: 'https://nightowl.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NightOwl — Sleep Smarter, Think Sharper',
    description:
      'The sleep platform built for knowledge workers. Integrates with GitHub, Linear, Notion, and more.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
