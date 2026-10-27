import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible } from 'next/font/google';

import AppShell from '@/components/AppShell';
import ServiceWorker from '@/components/ServiceWorker';

import './globals.css';

// Made for low-vision readers: distinct letter shapes, big counters.
const body = Atkinson_Hyperlegible({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'Meals',
  description: 'Meal ideas that fit her plan: carbs, pairing, sodium and cholesterol checked for every meal.',
  // Saved to an iPhone's home screen from Safari, it opens full screen with
  // this name and icon.
  appleWebApp: { capable: true, title: 'Meals', statusBarStyle: 'default' },
  icons: { apple: '/icons/apple-touch-icon.png', icon: '/icons/icon-192.png' },
  formatDetection: { telephone: false },
  // Next writes only the standard mobile-web-app-capable; older iOS wants its own.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#f4f5f1',
  width: 'device-width',
  initialScale: 1,
  // Draw to the screen's edges; the notch and home bar are padded in CSS.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={body.variable}>
      <body>
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
