import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { SmoothScroll } from '@/components/layout/SmoothScroll';
import { PageTransition } from '@/components/layout/PageTransition';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TerraSentinel',
  description: 'Smart AI-powered Emergency Resource Allocation Platform for NGOs and Volunteers',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className="min-h-screen bg-surface-1 text-gray-900 antialiased dark:bg-ink-950 dark:text-white"
        suppressHydrationWarning
      >
        <Providers>
          <SmoothScroll>
            <PageTransition>{children}</PageTransition>
          </SmoothScroll>
        </Providers>
      </body>
    </html>
  );
}
